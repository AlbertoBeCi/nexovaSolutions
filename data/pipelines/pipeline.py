"""Resilient Prefect pipeline for the weekly office/program performance report.

Run a manual week with ``python data/pipelines/pipeline.py --week-start 2026-11-02``.
Run the scheduled Prefect serving process with ``python data/pipelines/pipeline.py --serve``.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping

from sqlalchemy import bindparam, create_engine, event as sqlalchemy_event, text
from sqlalchemy.engine import Engine, make_url

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.process.business_performance import (  # noqa: E402
    ValidatedEvents,
    aggregate_weekly_performance as aggregate_events,
    canonical_digest,
    validate_and_deduplicate_events,
    validate_weekly_aggregates as validate_aggregates,
)
from prefect import flow, get_run_logger, task  # noqa: E402
from prefect.context import TaskRunContext  # noqa: E402
from prefect.client.schemas.schedules import CronSchedule  # noqa: E402
from prefect.deployments import run_deployment  # noqa: E402

PIPELINE_NAME = "weekly_office_program_performance_flow"
DEPLOYMENT_NAME = "weekly-office-program-performance"
TRANSFORM_VERSION = "v1"
BATCH_SIZE = 1000
LEASE_MINUTES = 60
# Three bounded retries (2/5/10 seconds, with 20% jitter) give transient
# database/network faults a chance to clear without holding a production run open.
RETRY_DELAYS_SECONDS = [2, 5, 10]
ARTIFACT_ROOT = REPO_ROOT / "data"
RAW_ROOT = ARTIFACT_ROOT / "raw" / "business-performance"
EVAL_ROOT = ARTIFACT_ROOT / "eval" / "business-performance"
logger = logging.getLogger("business-performance-pipeline")


class NoPublishableBusinessEvents(RuntimeError):
    """Protect the last published partition when source activity is unverified."""


def _resolve_week_start(value: date | str | None = None) -> date:
    if isinstance(value, str):
        value = date.fromisoformat(value)
    if value is not None:
        if value.weekday() != 0:
            raise ValueError("week_start debe ser un lunes ISO")
        return value
    today_utc = datetime.now(timezone.utc).date()
    current_monday = today_utc - timedelta(days=today_utc.weekday())
    return current_monday - timedelta(days=7)


def _database_url(purpose: str) -> str:
    if purpose == "telemetry":
        url = os.getenv("TELEMETRY_READONLY_DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")
        message = "Configura TELEMETRY_READONLY_DATABASE_URL (o SUPABASE_DATABASE_URL) para leer telemetría."
    else:
        url = os.getenv("REPORTING_DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL")
        message = "Configura REPORTING_DATABASE_URL (o SUPABASE_DATABASE_URL) para escribir reporting."
    if not url:
        raise RuntimeError(message)
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    parsed = make_url(url)
    if parsed.get_backend_name() == "postgresql" and parsed.drivername == "postgresql":
        parsed = parsed.set(drivername="postgresql+psycopg2")
    return parsed.render_as_string(hide_password=False)


def _engine(purpose: str) -> Engine:
    engine = create_engine(_database_url(purpose), pool_pre_ping=True, future=True)
    if engine.dialect.name == "sqlite":
        if purpose == "reporting":
            schema_path = os.getenv("PIPELINE_SQLITE_REPORTING_SCHEMA_PATH")
            if not schema_path:
                engine.dispose()
                raise RuntimeError("PIPELINE_SQLITE_REPORTING_SCHEMA_PATH solo se requiere para SQLite local.")

            @sqlalchemy_event.listens_for(engine, "connect")
            def attach_reporting_schema(dbapi_connection: Any, _connection_record: Any) -> None:
                dbapi_connection.execute("ATTACH DATABASE ? AS reporting", (schema_path,))
        elif purpose == "telemetry":
            @sqlalchemy_event.listens_for(engine, "connect")
            def make_sqlite_source_read_only(dbapi_connection: Any, _connection_record: Any) -> None:
                dbapi_connection.execute("PRAGMA query_only = ON")
    return engine


def _week_bounds(week_start: date) -> tuple[datetime, datetime]:
    start = datetime.combine(week_start, time.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=7)


def _flow_run_id() -> str | None:
    try:
        from prefect import get_run_context

        context = get_run_context()
        return str(context.flow_run.id) if context.flow_run else None
    except Exception:
        return None


@task(name="start_pipeline_run_and_acquire_lock", retries=3, retry_delay_seconds=RETRY_DELAYS_SECONDS, retry_jitter_factor=0.2)
def start_pipeline_run_and_acquire_lock(
    run_id: str,
    week_start: date,
    trigger: str,
    requested_by: str | None,
    source_window_end: datetime,
    prefect_flow_run_id: str | None,
) -> dict[str, Any]:
    """Persist the audit row and week lease atomically; DB is retried three times."""
    now = datetime.now(timezone.utc)
    lease_expiry = now + timedelta(minutes=LEASE_MINUTES)
    insert_run = text(
        """INSERT INTO reporting.pipeline_runs
        (run_id, pipeline_name, trigger, status, started_at, requested_by, week_start,
         source_window_end, phase, checkpoint, prefect_flow_run_id)
        VALUES (:run_id, :pipeline_name, :trigger, 'Running', :started_at, :requested_by,
                :week_start, :source_window_end, 'start', 'start', :prefect_flow_run_id)"""
    )
    acquire = text(
        """INSERT INTO reporting.pipeline_locks
        (pipeline_name, week_start, owner_run_id, lease_expires_at, heartbeat_at)
        VALUES (:pipeline_name, :week_start, :run_id, :lease_expires_at, :heartbeat_at)
        ON CONFLICT (pipeline_name, week_start) DO UPDATE
        SET owner_run_id = EXCLUDED.owner_run_id,
            lease_expires_at = EXCLUDED.lease_expires_at,
            heartbeat_at = EXCLUDED.heartbeat_at
        WHERE reporting.pipeline_locks.lease_expires_at < :now
        RETURNING owner_run_id"""
    )
    engine = _engine("reporting")
    try:
        with engine.begin() as connection:
            connection.execute(
                insert_run,
                {
                    "run_id": run_id,
                    "pipeline_name": PIPELINE_NAME,
                    "trigger": trigger,
                    "started_at": now,
                    "requested_by": requested_by,
                    "week_start": week_start,
                    "source_window_end": source_window_end,
                    "prefect_flow_run_id": prefect_flow_run_id,
                },
            )
            acquired = connection.execute(
                acquire,
                {
                    "pipeline_name": PIPELINE_NAME,
                    "week_start": week_start,
                    "run_id": run_id,
                    "lease_expires_at": lease_expiry,
                    "heartbeat_at": now,
                    "now": now,
                },
            ).scalar_one_or_none()
            if acquired is None:
                owner = connection.execute(
                    text(
                        "SELECT owner_run_id FROM reporting.pipeline_locks "
                        "WHERE pipeline_name=:pipeline_name AND week_start=:week_start"
                    ),
                    {"pipeline_name": PIPELINE_NAME, "week_start": week_start},
                ).scalar_one_or_none()
                connection.execute(
                    text("DELETE FROM reporting.pipeline_runs WHERE run_id=:run_id"),
                    {"run_id": run_id},
                )
                return {"acquired": False, "owner_run_id": str(owner) if owner else None}
        return {"acquired": True, "owner_run_id": run_id}
    finally:
        engine.dispose()


@task(name="extract_telemetry_events", retries=3, retry_delay_seconds=RETRY_DELAYS_SECONDS, retry_jitter_factor=0.2)
def extract_telemetry_events(week_start: date, run_id: str) -> list[dict[str, Any]]:
    """Read production KPI events in UTC batches; this connection only executes SELECT."""
    start, end = _week_bounds(week_start)
    engine = _engine("telemetry")
    rows: list[dict[str, Any]] = []
    try:
        with engine.connect() as connection:
            dialect = connection.dialect.name
            if dialect == "postgresql":
                # Enforce a read-only transaction even if local fallback credentials
                # also have write privileges. Production should use a read-only role.
                connection.exec_driver_sql("SET TRANSACTION READ ONLY")
            environment_filter = (
                "json_extract(tags, '$.environment') = 'production'"
                if dialect == "sqlite"
                else "tags ->> 'environment' = 'production'"
            )
            query = text(
                f"""SELECT event_id, timestamp, event_type, request_id, tags
                    FROM telemetry_events
                    WHERE timestamp >= :start AND timestamp < :end
                      AND event_type IN :event_types AND {environment_filter}
                    ORDER BY timestamp, event_id"""
            ).bindparams(bindparam("event_types", expanding=True))
            result = connection.execute(
                query,
                {
                    "start": start,
                    "end": end,
                    "event_types": [
                        "inbound_order_created",
                        "outbound_order_created",
                        "stock_threshold_triggered",
                        "kit_cost_variance_detected",
                    ],
                },
            ).mappings()
            while batch := result.fetchmany(BATCH_SIZE):
                for row in batch:
                    item = dict(row)
                    if isinstance(item.get("tags"), str):
                        item["tags"] = json.loads(item["tags"])
                    rows.append(item)
    finally:
        engine.dispose()

    raw_dir = RAW_ROOT / week_start.isoformat()
    raw_dir.mkdir(parents=True, exist_ok=True)
    raw_path = raw_dir / f"{run_id}.jsonl"
    temporary_path = raw_path.with_suffix(".jsonl.tmp")
    with temporary_path.open("w", encoding="utf-8") as output:
        for row in rows:
            output.write(json.dumps(row, default=lambda value: value.isoformat(), sort_keys=True) + "\n")
    temporary_path.replace(raw_path)
    return rows


@task(name="record_extraction_checkpoint", retries=3, retry_delay_seconds=RETRY_DELAYS_SECONDS, retry_jitter_factor=0.2)
def record_extraction_checkpoint(run_id: str, events_read: int) -> None:
    engine = _engine("reporting")
    try:
        with engine.begin() as connection:
            connection.execute(
                text("""UPDATE reporting.pipeline_runs SET phase='extract', checkpoint='extract',
                    events_read=:events_read WHERE run_id=:run_id"""),
                {"events_read": events_read, "run_id": run_id},
            )
    finally:
        engine.dispose()


@task(name="validate_and_deduplicate_events")
def validate_and_deduplicate_events_task(rows: list[dict[str, Any]], week_start: date) -> ValidatedEvents:
    return validate_and_deduplicate_events(rows, week_start)


@task(name="record_validation_checkpoint", retries=3, retry_delay_seconds=RETRY_DELAYS_SECONDS, retry_jitter_factor=0.2)
def record_validation_checkpoint(run_id: str, validated: ValidatedEvents) -> None:
    engine = _engine("reporting")
    try:
        with engine.begin() as connection:
            connection.execute(
                text("""UPDATE reporting.pipeline_runs SET phase='validate', checkpoint='validate',
                    events_read=:events_read, events_valid=:events_valid,
                    events_duplicate=:events_duplicate, events_rejected=:events_rejected,
                    events_pending=:events_pending, input_digest=:input_digest
                    WHERE run_id=:run_id"""),
                {
                    "events_read": validated.events_read,
                    "events_valid": len(validated.events),
                    "events_duplicate": validated.events_duplicate,
                    "events_rejected": validated.events_rejected,
                    "events_pending": validated.events_pending,
                    "input_digest": validated.input_digest,
                    "run_id": run_id,
                },
            )
    finally:
        engine.dispose()


def _aggregate_cache_key(_context: TaskRunContext, parameters: dict[str, Any]) -> str:
    validated: ValidatedEvents = parameters["validated"]
    week_start: date = parameters["week_start"]
    # Result is reusable for one hour only when week, transform version, and
    # complete canonical input digest match; extraction and loading are uncached.
    return f"{TRANSFORM_VERSION}:{week_start.isoformat()}:{validated.input_digest}"


@task(
    name="aggregate_weekly_performance",
    cache_key_fn=_aggregate_cache_key,
    cache_expiration=timedelta(hours=1),
    persist_result=True,
)
def aggregate_weekly_performance(validated: ValidatedEvents, week_start: date) -> list[dict[str, Any]]:
    return aggregate_events(validated, week_start)


@task(name="validate_weekly_aggregates")
def validate_weekly_aggregates_task(
    aggregates: list[dict[str, Any]], week_start: date, validated: ValidatedEvents
) -> tuple[list[dict[str, Any]], str]:
    return validate_aggregates(aggregates, week_start, validated)


@task(name="stage_weekly_aggregates", retries=3, retry_delay_seconds=RETRY_DELAYS_SECONDS, retry_jitter_factor=0.2)
def stage_weekly_aggregates(
    run_id: str,
    week_start: date,
    validated: ValidatedEvents,
    aggregates: list[dict[str, Any]],
    output_digest: str,
) -> int:
    """Durably stage results and lineage before publishing the reporting partition."""
    engine = _engine("reporting")
    try:
        with engine.begin() as connection:
            json_value_sql = "CAST(:aggregate_json AS jsonb)" if connection.dialect.name == "postgresql" else ":aggregate_json"
            connection.execute(
                text("""UPDATE reporting.pipeline_runs SET phase='stage', checkpoint='stage',
                    events_read=:events_read, events_valid=:events_valid,
                    events_duplicate=:events_duplicate, events_rejected=:events_rejected,
                    events_pending=:events_pending, input_digest=:input_digest
                    WHERE run_id=:run_id"""),
                {
                    "events_read": validated.events_read,
                    "events_valid": len(validated.events),
                    "events_duplicate": validated.events_duplicate,
                    "events_rejected": validated.events_rejected,
                    "events_pending": validated.events_pending,
                    "input_digest": validated.input_digest,
                    "run_id": run_id,
                },
            )
            connection.execute(
                text("DELETE FROM reporting.pipeline_staging WHERE run_id=:run_id"),
                {"run_id": run_id},
            )
            connection.execute(
                text("DELETE FROM reporting.pipeline_lineage WHERE run_id=:run_id"),
                {"run_id": run_id},
            )
            for aggregate in aggregates:
                connection.execute(
                text(f"""INSERT INTO reporting.pipeline_staging
                        (run_id, office, programme_id, week_start, total_material_cost,
                         kits_delivered_count, shortage_events_count, cost_variance_events_count,
                         currency, aggregate_json, output_digest)
                        VALUES (:run_id, :office, :programme_id, :week_start, :total_material_cost,
                         :kits_delivered_count, :shortage_events_count, :cost_variance_events_count,
                         :currency, {json_value_sql}, :output_digest)"""),
                    {
                        **aggregate,
                        "run_id": run_id,
                        "total_material_cost": str(aggregate["total_material_cost"]),
                        "week_start": aggregate["week_start"].isoformat(),
                        "aggregate_json": json.dumps(aggregate, default=str, sort_keys=True),
                        "output_digest": output_digest,
                    },
                )
            for event in validated.events:
                tags = event["tags"]
                connection.execute(
                    text("""INSERT INTO reporting.pipeline_lineage
                        (run_id, event_id, event_type, source_timestamp, office, programme_id, week_start)
                        VALUES (:run_id, :event_id, :event_type, :source_timestamp, :office, :programme_id, :week_start)"""),
                    {
                        "run_id": run_id,
                        "event_id": event["event_id"],
                        "event_type": event["event_type"],
                        "source_timestamp": event["timestamp"],
                        "office": tags["office"],
                        "programme_id": tags["programme_id"],
                        "week_start": week_start,
                    },
                )
            heartbeat = datetime.now(timezone.utc)
            connection.execute(
                text("""UPDATE reporting.pipeline_locks SET heartbeat_at=:heartbeat_at,
                    lease_expires_at=:lease_expires_at
                    WHERE pipeline_name=:pipeline_name AND week_start=:week_start AND owner_run_id=:run_id"""),
                {
                    "pipeline_name": PIPELINE_NAME,
                    "week_start": week_start,
                    "run_id": run_id,
                    "heartbeat_at": heartbeat,
                    "lease_expires_at": heartbeat + timedelta(minutes=LEASE_MINUTES),
                },
            )
    finally:
        engine.dispose()
    return len(aggregates)


@task(name="replace_reporting_partition", retries=3, retry_delay_seconds=RETRY_DELAYS_SECONDS, retry_jitter_factor=0.2)
def replace_reporting_partition(run_id: str, week_start: date, output_digest: str) -> int:
    """Upsert changed values and remove obsolete rows for the complete ISO week."""
    engine = _engine("reporting")
    try:
        with engine.begin() as connection:
            computed_at = datetime.now(timezone.utc)
            connection.execute(
                text("""UPDATE reporting.pipeline_runs SET phase='load', checkpoint='load',
                    output_digest=:output_digest WHERE run_id=:run_id"""),
                {"run_id": run_id, "output_digest": output_digest},
            )
            connection.execute(
                text("""INSERT INTO reporting.weekly_office_program_performance
                    (office, programme_id, week_start, total_material_cost, kits_delivered_count,
                     shortage_events_count, cost_variance_events_count, currency)
                    SELECT office, programme_id, week_start, total_material_cost, kits_delivered_count,
                           shortage_events_count, cost_variance_events_count, currency
                    FROM reporting.pipeline_staging WHERE run_id=:run_id
                    ON CONFLICT (office, programme_id, week_start) DO UPDATE SET
                        total_material_cost=EXCLUDED.total_material_cost,
                        kits_delivered_count=EXCLUDED.kits_delivered_count,
                        shortage_events_count=EXCLUDED.shortage_events_count,
                        cost_variance_events_count=EXCLUDED.cost_variance_events_count,
                        currency=EXCLUDED.currency,
                        computed_at=:computed_at
                    WHERE reporting.weekly_office_program_performance.total_material_cost IS DISTINCT FROM EXCLUDED.total_material_cost
                       OR reporting.weekly_office_program_performance.kits_delivered_count IS DISTINCT FROM EXCLUDED.kits_delivered_count
                       OR reporting.weekly_office_program_performance.shortage_events_count IS DISTINCT FROM EXCLUDED.shortage_events_count
                       OR reporting.weekly_office_program_performance.cost_variance_events_count IS DISTINCT FROM EXCLUDED.cost_variance_events_count
                       OR reporting.weekly_office_program_performance.currency IS DISTINCT FROM EXCLUDED.currency"""),
                {"run_id": run_id, "computed_at": computed_at},
            )
            connection.execute(
                text("""DELETE FROM reporting.weekly_office_program_performance AS target
                    WHERE target.week_start=:week_start
                      AND NOT EXISTS (
                        SELECT 1 FROM reporting.pipeline_staging AS staged
                        WHERE staged.run_id=:run_id AND staged.office=target.office
                          AND staged.programme_id=target.programme_id AND staged.week_start=target.week_start
                      )"""),
                {"week_start": week_start, "run_id": run_id},
            )
            rows_written = connection.execute(
                text("SELECT count(*) FROM reporting.pipeline_staging WHERE run_id=:run_id"),
                {"run_id": run_id},
            ).scalar_one()
            heartbeat = datetime.now(timezone.utc)
            connection.execute(
                text("""UPDATE reporting.pipeline_locks SET heartbeat_at=:heartbeat_at,
                    lease_expires_at=:lease_expires_at
                    WHERE pipeline_name=:pipeline_name AND week_start=:week_start AND owner_run_id=:run_id"""),
                {
                    "pipeline_name": PIPELINE_NAME,
                    "week_start": week_start,
                    "run_id": run_id,
                    "heartbeat_at": heartbeat,
                    "lease_expires_at": heartbeat + timedelta(minutes=LEASE_MINUTES),
                },
            )
    finally:
        engine.dispose()
    return int(rows_written)


@task(name="finalize_pipeline_run", retries=3, retry_delay_seconds=RETRY_DELAYS_SECONDS, retry_jitter_factor=0.2)
def finalize_pipeline_run(
    run_id: str,
    week_start: date,
    status: str,
    checkpoint: str,
    rows_written: int = 0,
    error_code: str | None = None,
    error_summary: str | None = None,
) -> None:
    """Persist terminal audit metadata and release the lease in one transaction."""
    engine = _engine("reporting")
    try:
        with engine.begin() as connection:
            finished_at = datetime.now(timezone.utc)
            connection.execute(
                text("""UPDATE reporting.pipeline_runs SET status=:status, phase=:checkpoint,
                    checkpoint=:checkpoint, rows_written=:rows_written, finished_at=:finished_at,
                    error_code=:error_code, error_summary=:error_summary
                    WHERE run_id=:run_id"""),
                {
                    "status": status,
                    "checkpoint": checkpoint,
                    "rows_written": rows_written,
                    "finished_at": finished_at,
                    "error_code": error_code,
                    "error_summary": error_summary,
                    "run_id": run_id,
                },
            )
            connection.execute(
                text("""DELETE FROM reporting.pipeline_locks
                    WHERE pipeline_name=:pipeline_name AND week_start=:week_start AND owner_run_id=:run_id"""),
                {"pipeline_name": PIPELINE_NAME, "week_start": week_start, "run_id": run_id},
            )
    finally:
        engine.dispose()


@task(name="write_pipeline_eval_snapshot")
def write_pipeline_eval_snapshot(
    run_id: str,
    week_start: date,
    validated: ValidatedEvents,
    rows_written: int,
    output_digest: str,
) -> str:
    """Write non-payload validation evidence; failure is optional to reporting."""
    EVAL_ROOT.mkdir(parents=True, exist_ok=True)
    path = EVAL_ROOT / f"{run_id}.json"
    snapshot = {
        "run_id": run_id,
        "week_start": week_start.isoformat(),
        "events_read": validated.events_read,
        "events_valid": len(validated.events),
        "events_duplicate": validated.events_duplicate,
        "events_rejected": validated.events_rejected,
        "events_pending": validated.events_pending,
        "rows_written": rows_written,
        "input_digest": validated.input_digest,
        "output_digest": output_digest,
        "status": "Completed",
    }
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)
    return str(path)


@flow(name=PIPELINE_NAME, log_prints=True)
def weekly_office_program_performance_flow(
    week_start: date | str | None = None,
    trigger: str = "manual",
    requested_by: str | None = None,
) -> dict[str, Any]:
    """Extract, validate, aggregate, stage, publish, and audit one ISO week."""
    resolved_week = _resolve_week_start(week_start)
    if trigger not in {"schedule", "manual", "backfill"}:
        raise ValueError("trigger debe ser schedule, manual o backfill")
    run_id = str(uuid.uuid4())
    start, end = _week_bounds(resolved_week)
    run_state = start_pipeline_run_and_acquire_lock(
        run_id,
        resolved_week,
        trigger,
        requested_by,
        end,
        _flow_run_id(),
    )
    if not run_state["acquired"]:
        return {
            "run_id": run_state.get("owner_run_id"),
            "week_start": resolved_week.isoformat(),
            "status": "Running",
            "message": "Ya hay una corrida activa para esta semana.",
        }

    rows_written = 0
    validated: ValidatedEvents | None = None
    output_digest: str | None = None
    checkpoint = "extract"
    try:
        source_rows = extract_telemetry_events(resolved_week, run_id)
        record_extraction_checkpoint(run_id, len(source_rows))
        if not source_rows:
            raise NoPublishableBusinessEvents(
                "La semana no tiene eventos de negocio de producción; no se sustituye la partición sin señal de ingesta."
            )
        checkpoint = "validate"
        validated = validate_and_deduplicate_events_task(source_rows, resolved_week)
        record_validation_checkpoint(run_id, validated)
        checkpoint = "transform"
        aggregates = aggregate_weekly_performance(validated, resolved_week)
        if not aggregates:
            raise NoPublishableBusinessEvents(
                "No quedan eventos KPI válidos; se conserva la partición publicada hasta reconciliar la fuente."
            )
        aggregates, output_digest = validate_weekly_aggregates_task(
            aggregates, resolved_week, validated
        )
        checkpoint = "stage"
        stage_weekly_aggregates(run_id, resolved_week, validated, aggregates, output_digest)
        checkpoint = "load"
        rows_written = replace_reporting_partition(run_id, resolved_week, output_digest)
        checkpoint = "verify"
        finalize_pipeline_run(run_id, resolved_week, "Completed", checkpoint, rows_written)

        # Optional validation snapshot must not fail the published report.
        state = write_pipeline_eval_snapshot(
            run_id, resolved_week, validated, rows_written, output_digest, return_state=True
        )
        if state.is_failed():
            get_run_logger().warning(
                "optional_eval_snapshot_failed run_id=%s; report publication remains successful",
                run_id,
            )
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
        safe_summary = f"La etapa {checkpoint} falló ({type(exc).__name__}); consulte los logs restringidos de Prefect."
        try:
            finalize_pipeline_run(
                run_id,
                resolved_week,
                "Failed",
                checkpoint,
                rows_written,
                "PIPELINE_STEP_FAILED",
                safe_summary,
            )
        except Exception as audit_exc:
            get_run_logger().error(
                "pipeline_failure_audit_unavailable run_id=%s error_type=%s",
                run_id,
                type(audit_exc).__name__,
            )
        raise


def get_latest_pipeline_run() -> dict[str, Any] | None:
    engine = _engine("reporting")
    try:
        with engine.connect() as connection:
            row = connection.execute(
                text("""SELECT run_id, pipeline_name, trigger, status, started_at, finished_at,
                    requested_by, week_start, source_window_end, phase, checkpoint, source_watermark,
                    events_read, events_valid, events_duplicate, events_rejected, events_pending,
                    rows_written, input_digest, output_digest, prefect_flow_run_id,
                    error_code, error_summary
                    FROM reporting.pipeline_runs WHERE pipeline_name=:pipeline_name
                    ORDER BY started_at DESC LIMIT 1"""),
                {"pipeline_name": PIPELINE_NAME},
            ).mappings().first()
            if row is None:
                return None
            result = dict(row)
            result["run_id"] = str(result["run_id"])
            return result
    finally:
        engine.dispose()


def get_weekly_office_program_performance(
    week_start: date | str | None = None,
) -> dict[str, Any]:
    """Read the published KPI rows; when omitted, use the latest published week."""
    engine = _engine("reporting")
    try:
        with engine.connect() as connection:
            resolved = _resolve_week_start(week_start) if week_start is not None else connection.execute(
                text("SELECT max(week_start) FROM reporting.weekly_office_program_performance")
            ).scalar_one_or_none()
            if resolved is None:
                resolved = _resolve_week_start()
                return {"week_start": resolved.isoformat(), "entries": []}
            if isinstance(resolved, str):
                resolved = date.fromisoformat(resolved)
            rows = connection.execute(
                text("""SELECT office, programme_id, week_start, total_material_cost,
                    kits_delivered_count, shortage_events_count, cost_variance_events_count, currency
                    FROM reporting.weekly_office_program_performance
                    WHERE week_start=:week_start ORDER BY office, programme_id"""),
                {"week_start": resolved},
            ).mappings().all()
            entries = [dict(row) for row in rows]
            return {"week_start": resolved.isoformat(), "entries": entries}
    finally:
        engine.dispose()


def submit_weekly_office_program_performance_flow(
    week_start: date | str | None = None,
    requested_by: str | None = None,
) -> dict[str, Any]:
    """Request an idempotent Prefect deployment run (does not run ETL in API)."""
    resolved_week = _resolve_week_start(week_start)
    request_hour = datetime.now(timezone.utc).strftime("%Y%m%d%H")
    flow_run = run_deployment(
        f"{PIPELINE_NAME}/{DEPLOYMENT_NAME}",
        parameters={
            "week_start": resolved_week.isoformat(),
            "trigger": "manual",
            "requested_by": requested_by,
        },
        timeout=0,
        idempotency_key=f"{PIPELINE_NAME}:{resolved_week.isoformat()}:manual:{request_hour}",
        tags=["business-reporting", "manual"],
        as_subflow=False,
    )
    return {
        "run_id": str(flow_run.id),
        "week_start": resolved_week.isoformat(),
        "status": flow_run.state_name or "Scheduled",
    }


def _serve() -> None:
    weekly_office_program_performance_flow.serve(
        name=DEPLOYMENT_NAME,
        schedule=CronSchedule(cron="0 6 * * 1", timezone="UTC"),
        parameters={"trigger": "schedule"},
        tags=["business-reporting"],
        pause_on_shutdown=False,
        print_starting_message=True,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pipeline semanal de desempeño de negocio Nexova")
    parser.add_argument("--week-start", help="Lunes ISO a reprocesar (backfill semanal)")
    parser.add_argument("--trigger", choices=("manual", "backfill", "schedule"), default="backfill")
    parser.add_argument("--requested-by", help="Identificador de auditoría del solicitante")
    parser.add_argument("--serve", action="store_true", help="Registrar y mantener el deployment semanal Prefect")
    args = parser.parse_args(argv)
    if args.serve:
        _serve()
        return 0
    result = weekly_office_program_performance_flow(
        week_start=args.week_start,
        trigger=args.trigger,
        requested_by=args.requested_by,
    )
    print(json.dumps(result, ensure_ascii=False, default=str, sort_keys=True))
    return 0 if result.get("status") in {"Completed", "Running"} else 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(name)s: %(message)s")
    raise SystemExit(main())
