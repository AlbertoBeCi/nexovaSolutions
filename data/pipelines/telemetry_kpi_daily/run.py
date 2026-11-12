"""Compatibility CLI runner for the telemetry KPI pipeline (`--no-prefect`).

Supports the reference subprocess command from Ticket #DEV-53:
    python -m data.pipelines.telemetry_kpi_daily.run --no-prefect

Delegates to `data.pipelines.pipeline` while running the underlying ETL steps
directly (via `.fn` when `--no-prefect` is passed) so it requires no Prefect API
server and records internal ETL audit rows in `reporting.pipeline_runs`.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.pipelines.pipeline import (  # noqa: E402
    NoPublishableBusinessEvents,
    _resolve_week_start,
    _week_bounds,
    aggregate_weekly_performance,
    extract_telemetry_events,
    finalize_pipeline_run,
    record_extraction_checkpoint,
    record_validation_checkpoint,
    replace_reporting_partition,
    stage_weekly_aggregates,
    start_pipeline_run_and_acquire_lock,
    validate_and_deduplicate_events_task,
    validate_weekly_aggregates_task,
    weekly_office_program_performance_flow,
    write_pipeline_eval_snapshot,
)
from data.process.business_performance import (  # noqa: E402
    aggregate_weekly_performance as aggregate_events_direct,
    validate_and_deduplicate_events as validate_events_direct,
    validate_weekly_aggregates as validate_aggregates_direct,
)

logger = logging.getLogger("telemetry_kpi_daily")


def _monday_for_date(value: date | str | None) -> date | None:
    if value is None:
        return None
    resolved = date.fromisoformat(value) if isinstance(value, str) else value
    return resolved - timedelta(days=resolved.weekday())


def run_without_prefect(
    week_start: date | str | None = None,
    trigger: str = "schedule",
    requested_by: str | None = "nightly_export",
) -> dict[str, Any]:
    """Execute the pipeline tasks directly via `.fn` without spinning up a Prefect server."""
    resolved_week = _resolve_week_start(_monday_for_date(week_start) if week_start else None)
    run_id = str(uuid.uuid4())
    _, end = _week_bounds(resolved_week)
    run_state = start_pipeline_run_and_acquire_lock.fn(
        run_id,
        resolved_week,
        trigger,
        requested_by,
        end,
        None,
    )
    if not run_state["acquired"]:
        return {
            "run_id": run_state.get("owner_run_id"),
            "week_start": resolved_week.isoformat(),
            "status": "Running",
            "message": "Ya hay una corrida activa para esta semana.",
        }

    rows_written = 0
    checkpoint = "extract"
    try:
        source_rows = extract_telemetry_events.fn(resolved_week, run_id)
        record_extraction_checkpoint.fn(run_id, len(source_rows))
        if not source_rows:
            finalize_pipeline_run.fn(run_id, resolved_week, "Completed", "extract", 0)
            return {
                "run_id": run_id,
                "week_start": resolved_week.isoformat(),
                "status": "Completed",
                "events_read": 0,
                "events_valid": 0,
                "rows_written": 0,
            }

        checkpoint = "validate"
        validated = validate_events_direct(source_rows, resolved_week)
        record_validation_checkpoint.fn(run_id, validated)

        checkpoint = "transform"
        aggregates = aggregate_events_direct(validated, resolved_week)
        if not aggregates:
            finalize_pipeline_run.fn(run_id, resolved_week, "Completed", "transform", 0)
            return {
                "run_id": run_id,
                "week_start": resolved_week.isoformat(),
                "status": "Completed",
                "events_read": validated.events_read,
                "events_valid": len(validated.events),
                "rows_written": 0,
            }
        validated_aggregates, output_digest = validate_aggregates_direct(
            aggregates, resolved_week, validated
        )

        checkpoint = "stage"
        stage_weekly_aggregates.fn(
            run_id, resolved_week, validated, validated_aggregates, output_digest
        )

        checkpoint = "load"
        rows_written = replace_reporting_partition.fn(run_id, resolved_week, output_digest)

        checkpoint = "verify"
        finalize_pipeline_run.fn(run_id, resolved_week, "Completed", checkpoint, rows_written)
        try:
            write_pipeline_eval_snapshot.fn(
                run_id, resolved_week, validated, rows_written, output_digest
            )
        except Exception:
            logger.warning("optional_eval_snapshot_failed run_id=%s", run_id)

        return {
            "run_id": run_id,
            "week_start": resolved_week.isoformat(),
            "status": "Completed",
            "events_read": validated.events_read,
            "events_valid": len(validated.events),
            "events_duplicate": validated.events_duplicate,
            "events_rejected": validated.events_rejected,
            "events_pending": validated.events_pending,
            "rows_written": rows_written,
            "input_digest": validated.input_digest,
            "output_digest": output_digest,
        }
    except Exception as exc:
        safe_summary = f"La etapa {checkpoint} fallo ({type(exc).__name__})."
        try:
            finalize_pipeline_run.fn(
                run_id,
                resolved_week,
                "Failed",
                checkpoint,
                rows_written,
                "PIPELINE_STEP_FAILED",
                safe_summary,
            )
        except Exception:
            logger.error("pipeline_failure_audit_unavailable run_id=%s", run_id)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="CLI de ejecucion del pipeline de telemetria KPI"
    )
    parser.add_argument(
        "--no-prefect",
        action="store_true",
        help="Ejecuta las etapas ETL sin requerir servidor Prefect externo",
    )
    parser.add_argument(
        "--target-date",
        default=os.getenv("TARGET_DATE"),
        help="Fecha objetivo YYYY-MM-DD (se resuelve a su lunes ISO para reporting)",
    )
    parser.add_argument(
        "--week-start",
        help="Lunes ISO explicito YYYY-MM-DD",
    )
    parser.add_argument(
        "--trigger",
        choices=("manual", "backfill", "schedule"),
        default="schedule",
    )
    args = parser.parse_args(argv)
    target = args.week_start or args.target_date

    if args.no_prefect:
        result = run_without_prefect(
            week_start=target,
            trigger=args.trigger,
            requested_by="nightly_export",
        )
    else:
        monday = _monday_for_date(target) if target else None
        result = weekly_office_program_performance_flow(
            week_start=monday,
            trigger=args.trigger,
            requested_by="nightly_export",
        )
    print(json.dumps(result, ensure_ascii=False, default=str, sort_keys=True))
    return 0 if result.get("status") in {"Completed", "Running"} else 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(name)s: %(message)s")
    raise SystemExit(main())
