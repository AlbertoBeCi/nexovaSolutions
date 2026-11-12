"""Nightly telemetry export and pipeline orchestration script (Ticket #DEV-53).

Responsibilities:
1. Run as a completely standalone CLI process (`python scripts/nightly_export.py`),
   never importing or blocking the FastAPI application.
2. Resolve `target_date` from `TARGET_DATE` (`YYYY-MM-DD`) or default to yesterday UTC.
3. Enforce distributed lock via `status = 'processing'` in `job_runs` (abort silently if
   another instance of `nightly_export` is already processing).
4. Enforce daily idempotency via `(job_name='nightly_export', target_date)` with
   `status = 'completed'` (skip export and pipeline if already completed for `target_date`).
5. Export rows from `telemetry_events` for `target_date` to `data/raw/telemetry_YYYY-MM-DD.csv`
   if the file does not exist yet (backup/audit snapshot; the pipeline reads from DB).
6. Trigger the data pipeline as a subprocess (`python -m data.pipelines.telemetry_kpi_daily.run --no-prefect`).
7. Record every state transition (`pending -> processing -> completed | failed`) and any
   exception message in `job_runs`, ensuring no row ever remains zombie in `processing`.
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import shlex
import subprocess
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Sequence

from sqlalchemy import text
from sqlalchemy.engine import Engine

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.job_runner import (  # noqa: E402
    DEFAULT_JOB_NAME,
    create_job_engine,
    create_job_run,
    has_completed_for_date,
    has_processing_lock,
    init_job_runs_db,
    mark_job_completed,
    mark_job_failed,
    mark_job_processing,
)

JOB_NAME = DEFAULT_JOB_NAME
DEFAULT_RAW_DIR = REPO_ROOT / "data" / "raw"
CSV_COLUMNS = (
    "event_id",
    "timestamp",
    "session_id",
    "user_id",
    "event_type",
    "schema_version",
    "request_id",
    "tags",
)

logger = logging.getLogger("nightly_export")


def configure_logging() -> None:
    """Configure structured log output with UTC timestamp, level, and message."""
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%SZ",
        )
        logging.Formatter.converter = lambda *args: datetime.now(timezone.utc).timetuple()


def _log_event(
    level: int,
    status: str,
    target_date: date,
    message: str,
    *,
    job_id: str | None = None,
) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    job_ref = f" job_id={job_id}" if job_id else ""
    logger.log(
        level,
        "timestamp=%s job_name=%s target_date=%s status=%s%s message=%s",
        ts,
        JOB_NAME,
        target_date.isoformat(),
        status,
        job_ref,
        message,
    )


def resolve_target_date(explicit_date: date | str | None = None) -> date:
    """Resolve target_date from explicit value, env `TARGET_DATE`, or yesterday in UTC."""
    raw = explicit_date if explicit_date is not None else os.getenv("TARGET_DATE")
    if raw is not None and str(raw).strip() != "":
        if isinstance(raw, date) and not isinstance(raw, datetime):
            return raw
        try:
            return date.fromisoformat(str(raw).strip())
        except ValueError as exc:
            raise ValueError(
                f"TARGET_DATE invalido '{raw}'. Usa el formato YYYY-MM-DD."
            ) from exc
    return datetime.now(timezone.utc).date() - timedelta(days=1)


def _day_bounds_utc(target_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end


def _serialize_csv_value(column: str, value: Any) -> str:
    if value is None:
        return ""
    if column == "tags":
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return json.dumps(parsed, ensure_ascii=False, sort_keys=True)
            except ValueError:
                return value
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    if isinstance(value, datetime):
        dt = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    return str(value)


def export_telemetry_to_csv(
    engine: Engine,
    target_date: date,
    raw_dir: Path | None = None,
) -> tuple[Path, int, bool]:
    """Export `telemetry_events` for `target_date` to `data/raw/telemetry_YYYY-MM-DD.csv`.

    If the CSV file already exists, does not overwrite it and returns `(csv_path, 0, False)`.
    Otherwise writes atomically via a `.tmp` file and returns `(csv_path, row_count, True)`.
    """
    output_dir = Path(raw_dir) if raw_dir is not None else Path(
        os.getenv("TELEMETRY_RAW_DIR", str(DEFAULT_RAW_DIR))
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / f"telemetry_{target_date.isoformat()}.csv"

    if csv_path.exists():
        return csv_path, 0, False

    start_dt, end_dt = _day_bounds_utc(target_date)
    with engine.connect() as conn:
        dialect = conn.dialect.name
        if dialect == "sqlite":
            # SQLite stores timestamps as ISO text strings; compare normalized prefix/bounds
            query = text(
                """
                SELECT event_id, timestamp, session_id, user_id, event_type,
                       schema_version, request_id, tags
                FROM telemetry_events
                WHERE substr(replace(CAST(timestamp AS TEXT), 'T', ' '), 1, 10) = :target_day
                ORDER BY timestamp ASC, event_id ASC
                """
            )
            params: dict[str, Any] = {"target_day": target_date.isoformat()}
        else:
            query = text(
                """
                SELECT event_id, timestamp, session_id, user_id, event_type,
                       schema_version, request_id, tags
                FROM telemetry_events
                WHERE timestamp >= :start_dt AND timestamp < :end_dt
                ORDER BY timestamp ASC, event_id ASC
                """
            )
            params = {"start_dt": start_dt, "end_dt": end_dt}

        rows = conn.execute(query, params).mappings().all()

    tmp_path = csv_path.with_suffix(".csv.tmp")
    with tmp_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(CSV_COLUMNS))
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {col: _serialize_csv_value(col, row.get(col)) for col in CSV_COLUMNS}
            )
    tmp_path.replace(csv_path)
    return csv_path, len(rows), True


def build_pipeline_command(pipeline_cmd: Sequence[str] | str | None = None) -> list[str]:
    """Return the subprocess command used to trigger the data pipeline."""
    configured = pipeline_cmd if pipeline_cmd is not None else os.getenv("NIGHTLY_PIPELINE_CMD")
    if configured:
        if isinstance(configured, str):
            return shlex.split(configured)
        return [str(part) for part in configured]
    return [
        sys.executable,
        "-m",
        "data.pipelines.telemetry_kpi_daily.run",
        "--no-prefect",
    ]


def trigger_pipeline_subprocess(
    target_date: date,
    pipeline_cmd: Sequence[str] | str | None = None,
    extra_env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Launch the data pipeline in an isolated subprocess."""
    cmd = build_pipeline_command(pipeline_cmd)
    env = os.environ.copy()
    env["TARGET_DATE"] = target_date.isoformat()
    if extra_env:
        env.update(extra_env)

    completed = subprocess.run(
        cmd,
        cwd=str(REPO_ROOT),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        stderr_tail = (completed.stderr or completed.stdout or "").strip()
        if len(stderr_tail) > 500:
            stderr_tail = stderr_tail[-500:]
        raise RuntimeError(
            f"Subproceso del pipeline fallo con codigo {completed.returncode}: {stderr_tail}"
        )
    return completed


def run_nightly_export(
    target_date: date | str | None = None,
    *,
    engine: Engine | None = None,
    raw_dir: Path | None = None,
    pipeline_cmd: Sequence[str] | str | None = None,
) -> dict[str, Any]:
    """Execute the full nightly export workflow with lock, idempotency, and state machine."""
    configure_logging()
    resolved_date = resolve_target_date(target_date)
    owns_engine = engine is None
    db_engine = create_job_engine() if engine is None else engine

    try:
        init_job_runs_db(db_engine)

        # 1. Distributed lock check via status == 'processing'
        if has_processing_lock(JOB_NAME, db=db_engine):
            _log_event(
                logging.INFO,
                "processing",
                resolved_date,
                "Ejecucion abortada silenciosamente: ya existe una instancia en estado processing.",
            )
            return {
                "job_name": JOB_NAME,
                "target_date": resolved_date.isoformat(),
                "status": "aborted_lock",
                "skipped": True,
            }

        # 2. Daily idempotency check via (job_name, target_date) and status == 'completed'
        if has_completed_for_date(JOB_NAME, resolved_date, db=db_engine):
            _log_event(
                logging.INFO,
                "completed",
                resolved_date,
                "Ejecucion omitida por duplicado: target_date ya fue completada previamente.",
            )
            return {
                "job_name": JOB_NAME,
                "target_date": resolved_date.isoformat(),
                "status": "skipped_duplicate",
                "skipped": True,
            }

        # 3. Create record in 'pending' state before starting work
        job_row = create_job_run(JOB_NAME, resolved_date, status="pending", db=db_engine)
        job_id = job_row["id"]
        _log_event(
            logging.INFO,
            "pending",
            resolved_date,
            "Registro de ejecucion creado en estado pending.",
            job_id=job_id,
        )

        # 4. Transition to 'processing' and execute export + pipeline inside try/except/finally
        current_status = "pending"
        try:
            mark_job_processing(job_id, db=db_engine)
            current_status = "processing"
            _log_event(
                logging.INFO,
                "processing",
                resolved_date,
                "Iniciando exportacion CSV de telemetria y ejecucion del pipeline.",
                job_id=job_id,
            )

            csv_path, exported_rows, created_new_csv = export_telemetry_to_csv(
                db_engine, resolved_date, raw_dir=raw_dir
            )
            if created_new_csv:
                _log_event(
                    logging.INFO,
                    "processing",
                    resolved_date,
                    f"CSV exportado en {csv_path.as_posix()} ({exported_rows} filas).",
                    job_id=job_id,
                )
            else:
                _log_event(
                    logging.INFO,
                    "processing",
                    resolved_date,
                    f"CSV existente reutilizado en {csv_path.as_posix()}.",
                    job_id=job_id,
                )

            trigger_pipeline_subprocess(resolved_date, pipeline_cmd=pipeline_cmd)

            mark_job_completed(job_id, db=db_engine)
            current_status = "completed"
            _log_event(
                logging.INFO,
                "completed",
                resolved_date,
                "Ejecucion nocturna finalizada correctamente.",
                job_id=job_id,
            )
            return {
                "id": job_id,
                "job_name": JOB_NAME,
                "target_date": resolved_date.isoformat(),
                "status": "completed",
                "csv_path": str(csv_path),
                "exported_rows": exported_rows,
                "skipped": False,
            }
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            try:
                mark_job_failed(job_id, error_msg, db=db_engine)
                current_status = "failed"
            except Exception as db_exc:
                _log_event(
                    logging.ERROR,
                    "failed",
                    resolved_date,
                    f"Fallo al actualizar estado failed en BD: {db_exc}",
                    job_id=job_id,
                )
            _log_event(
                logging.ERROR,
                "failed",
                resolved_date,
                f"Ejecucion fallida: {error_msg}",
                job_id=job_id,
            )
            raise
        finally:
            # Guarantee no record remains stuck in 'processing' even under BaseException
            if current_status == "processing":
                try:
                    mark_job_failed(
                        job_id,
                        "Ejecucion interrumpida antes de completar.",
                        db=db_engine,
                    )
                except Exception:
                    pass
    finally:
        if owns_engine:
            db_engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Script nocturno de exportacion de telemetria y disparo de pipeline"
    )
    parser.add_argument(
        "--target-date",
        default=None,
        help="Fecha objetivo YYYY-MM-DD (sobrescribe TARGET_DATE; por defecto ayer en UTC)",
    )
    args = parser.parse_args(argv)
    try:
        run_nightly_export(target_date=args.target_date)
        return 0
    except Exception:
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
