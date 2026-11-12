"""Tests for the nightly telemetry export script and `services.job_runner` (Ticket #DEV-53).

Covers:
1. State machine transitions (`pending -> processing -> completed | failed`) in `job_runs`.
2. Distributed lock via `status = 'processing'` (`has_processing_lock`) without extra lock tables/columns.
3. Daily idempotency via `(job_name, target_date)` (`has_completed_for_date`): running twice on the same
   day skips duplicate export and pipeline execution, while another `target_date` runs normally.
4. Exception handling (`try/except/finally`): any failure transitions the record to `failed` with
   `error_message` populated and leaves zero records in `processing`.
5. CSV backup export to `data/raw/telemetry_YYYY-MM-DD.csv` from `telemetry_events` for `target_date` only.
6. Standalone CLI execution (`python scripts/nightly_export.py`) and `TARGET_DATE` override.
7. Structured logging with timestamp, `job_name`, and resulting `status` at `INFO` and `ERROR` levels.
8. Coexistence of `job_runs` (orchestration) and `reporting.pipeline_runs` (internal ETL) via
   `python -m data.pipelines.telemetry_kpi_daily.run --no-prefect`.
"""
from __future__ import annotations

import csv
import json
import logging
import os
import shutil
import sqlite3
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.nightly_export import (  # noqa: E402
    CSV_COLUMNS,
    JOB_NAME,
    export_telemetry_to_csv,
    resolve_target_date,
    run_nightly_export,
)
from services.job_runner import (  # noqa: E402
    create_job_run,
    get_job_run,
    has_completed_for_date,
    has_processing_lock,
    init_job_runs_db,
    list_job_runs,
    mark_job_completed,
    mark_job_failed,
    mark_job_processing,
)

SCRIPT_PATH = REPO_ROOT / "scripts" / "nightly_export.py"
SCHEMA_PATH = REPO_ROOT / "docs" / "telemetry" / "event-schemas.json"


def _setup_telemetry_db(db_path: Path) -> None:
    """Create `telemetry_events` and seed events across multiple UTC dates."""
    event_schemas = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))["definitions"]
    inbound_tags = dict(event_schemas["inbound_order_created"]["examples"][0]["properties"])
    inbound_tags.update(
        {
            "event_type": "inbound_order_created",
            "environment": "production",
            "office": "valencia",
            "programme_id": "ventas-b2b",
            "currency": "EUR",
            "quantity": 10,
            "total_cost_minor": 25000,
        }
    )
    outbound_tags = dict(event_schemas["outbound_order_created"]["examples"][0]["properties"])
    outbound_tags.update(
        {
            "event_type": "outbound_order_created",
            "environment": "production",
            "office": "valencia",
            "programme_id": "ventas-b2b",
            "currency": "EUR",
            "quantity": 5,
        }
    )

    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE telemetry_events (
            event_id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            session_id TEXT,
            user_id TEXT,
            event_type TEXT NOT NULL,
            schema_version TEXT NOT NULL,
            request_id TEXT NOT NULL,
            tags TEXT NOT NULL
        )
        """
    )
    events = [
        (
            "evt-target-1",
            "2026-11-10T08:15:00+00:00",
            "sess-1",
            "usr-1",
            "inbound_order_created",
            "1.0",
            "req-1",
            json.dumps(inbound_tags),
        ),
        (
            "evt-target-2",
            "2026-11-10T19:45:30+00:00",
            None,
            None,
            "outbound_order_created",
            "1.0",
            "req-2",
            json.dumps(outbound_tags),
        ),
        (
            "evt-other-day",
            "2026-11-09T23:59:59+00:00",
            "sess-0",
            "usr-0",
            "login_succeeded",
            "1.0",
            "req-0",
            json.dumps({"event_type": "login_succeeded", "environment": "production"}),
        ),
    ]
    conn.executemany(
        "INSERT INTO telemetry_events VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        events,
    )
    conn.commit()
    conn.close()


def _verify_sqlite_backup(db_path: Path, tmp_path: Path) -> None:
    """Create and verify a restorable backup before running write tests (AGENTS.md §8)."""
    backup_path = tmp_path / f"{db_path.name}.backup"
    shutil.copy2(db_path, backup_path)
    with sqlite3.connect(backup_path) as conn:
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"


@pytest.fixture()
def job_db(tmp_path: Path):
    db_path = tmp_path / "nightly_telemetry.sqlite"
    _setup_telemetry_db(db_path)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}", future=True)
    init_job_runs_db(engine)
    _verify_sqlite_backup(db_path, tmp_path)
    yield engine, db_path
    engine.dispose()


def test_job_runs_schema_and_composite_index(job_db):
    engine, _ = job_db
    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("job_runs")}
    assert {
        "id",
        "job_name",
        "target_date",
        "status",
        "started_at",
        "finished_at",
        "error_message",
        "created_at",
    }.issubset(columns)

    indexes = inspector.get_indexes("job_runs")
    indexed_cols = [tuple(idx["column_names"]) for idx in indexes]
    assert ("job_name", "target_date") in indexed_cols


def test_job_runner_state_machine_transitions(job_db):
    engine, _ = job_db
    target = date(2026, 11, 10)

    assert not has_processing_lock(JOB_NAME, db=engine)
    assert not has_completed_for_date(JOB_NAME, target, db=engine)

    created = create_job_run(JOB_NAME, target, db=engine)
    job_id = created["id"]
    assert created["status"] == "pending"
    assert created["target_date"] == target
    assert created["started_at"] is None
    assert created["finished_at"] is None
    assert created["created_at"] is not None

    processing = mark_job_processing(job_id, db=engine)
    assert processing["status"] == "processing"
    assert processing["started_at"] is not None
    assert has_processing_lock(JOB_NAME, db=engine) is True

    completed = mark_job_completed(job_id, db=engine)
    assert completed["status"] == "completed"
    assert completed["finished_at"] is not None
    assert completed["error_message"] is None
    assert has_processing_lock(JOB_NAME, db=engine) is False
    assert has_completed_for_date(JOB_NAME, target, db=engine) is True
    assert has_completed_for_date(JOB_NAME, date(2026, 11, 11), db=engine) is False


def test_resolve_target_date_defaults_to_yesterday_utc_and_accepts_env(monkeypatch):
    monkeypatch.delenv("TARGET_DATE", raising=False)
    expected_yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    assert resolve_target_date() == expected_yesterday

    monkeypatch.setenv("TARGET_DATE", "2026-01-15")
    assert resolve_target_date() == date(2026, 1, 15)

    with pytest.raises(ValueError, match="TARGET_DATE invalido"):
        resolve_target_date("15-01-2026")


def test_nightly_export_happy_path_exports_csv_and_records_completed(job_db, tmp_path, caplog):
    engine, _ = job_db
    raw_dir = tmp_path / "raw"
    nop_cmd = [sys.executable, "-c", "import sys; sys.exit(0)"]

    with caplog.at_level(logging.INFO, logger="nightly_export"):
        result = run_nightly_export(
            target_date="2026-11-10",
            engine=engine,
            raw_dir=raw_dir,
            pipeline_cmd=nop_cmd,
        )

    assert result["status"] == "completed"
    assert result["skipped"] is False
    assert result["exported_rows"] == 2

    csv_file = raw_dir / "telemetry_2026-11-10.csv"
    assert csv_file.exists()
    with csv_file.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 2
    assert list(rows[0].keys()) == list(CSV_COLUMNS)
    assert [r["event_id"] for r in rows] == ["evt-target-1", "evt-target-2"]

    runs = list_job_runs(JOB_NAME, target_date="2026-11-10", db=engine)
    assert len(runs) == 1
    assert runs[0]["status"] == "completed"
    assert runs[0]["started_at"] is not None
    assert runs[0]["finished_at"] is not None
    assert runs[0]["error_message"] is None

    log_messages = [rec.getMessage() for rec in caplog.records]
    assert any("job_name=nightly_export" in msg and "status=processing" in msg for msg in log_messages)
    assert any("job_name=nightly_export" in msg and "status=completed" in msg for msg in log_messages)


def test_nightly_export_is_idempotent_by_target_date(job_db, tmp_path, caplog):
    engine, _ = job_db
    raw_dir = tmp_path / "raw"
    counter_file = tmp_path / "pipeline_runs_count.txt"
    cmd = [
        sys.executable,
        "-c",
        (
            "from pathlib import Path; "
            f"p = Path({repr(counter_file.as_posix())}); "
            "c = int(p.read_text()) if p.exists() else 0; "
            "p.write_text(str(c + 1))"
        ),
    ]

    first = run_nightly_export(
        target_date="2026-11-10",
        engine=engine,
        raw_dir=raw_dir,
        pipeline_cmd=cmd,
    )
    assert first["status"] == "completed"
    assert counter_file.read_text() == "1"
    csv_path = raw_dir / "telemetry_2026-11-10.csv"
    first_mtime = csv_path.stat().st_mtime_ns

    with caplog.at_level(logging.INFO, logger="nightly_export"):
        second = run_nightly_export(
            target_date="2026-11-10",
            engine=engine,
            raw_dir=raw_dir,
            pipeline_cmd=cmd,
        )

    assert second["status"] == "skipped_duplicate"
    assert second["skipped"] is True
    # Pipeline was NOT executed a second time and CSV was NOT rewritten
    assert counter_file.read_text() == "1"
    assert csv_path.stat().st_mtime_ns == first_mtime
    assert len(list_job_runs(JOB_NAME, target_date="2026-11-10", db=engine)) == 1
    assert any("omitida por duplicado" in rec.getMessage() for rec in caplog.records)

    # Running for a DIFFERENT target_date works normally (scoped to (job_name, target_date))
    third = run_nightly_export(
        target_date="2026-11-09",
        engine=engine,
        raw_dir=raw_dir,
        pipeline_cmd=cmd,
    )
    assert third["status"] == "completed"
    assert counter_file.read_text() == "2"
    assert (raw_dir / "telemetry_2026-11-09.csv").exists()


def test_nightly_export_aborts_silently_when_processing_lock_is_active(job_db, tmp_path, caplog):
    engine, _ = job_db
    raw_dir = tmp_path / "raw"

    # Simulate an active instance holding the 'processing' lock
    active_run = create_job_run(JOB_NAME, "2026-11-10", db=engine)
    mark_job_processing(active_run["id"], db=engine)

    marker_file = tmp_path / "should_not_run.txt"
    cmd = [
        sys.executable,
        "-c",
        f"from pathlib import Path; Path({repr(marker_file.as_posix())}).write_text('ran')",
    ]

    with caplog.at_level(logging.INFO, logger="nightly_export"):
        second_instance = run_nightly_export(
            target_date="2026-11-10",
            engine=engine,
            raw_dir=raw_dir,
            pipeline_cmd=cmd,
        )

    assert second_instance["status"] == "aborted_lock"
    assert second_instance["skipped"] is True
    assert not marker_file.exists()
    assert not (raw_dir / "telemetry_2026-11-10.csv").exists()
    # Only the original processing row exists; no second row was inserted
    runs = list_job_runs(JOB_NAME, db=engine)
    assert len(runs) == 1
    assert runs[0]["id"] == active_run["id"]
    assert runs[0]["status"] == "processing"
    assert any("abortada silenciosamente" in rec.getMessage() for rec in caplog.records)


def test_nightly_export_transitions_to_failed_on_pipeline_error_without_zombie_processing(
    job_db, tmp_path, caplog
):
    engine, _ = job_db
    raw_dir = tmp_path / "raw"
    failing_cmd = [
        sys.executable,
        "-c",
        "import sys; sys.stderr.write('Database connection timeout in ETL\\n'); sys.exit(2)",
    ]

    with caplog.at_level(logging.ERROR, logger="nightly_export"):
        with pytest.raises(RuntimeError, match="Subproceso del pipeline fallo con codigo 2"):
            run_nightly_export(
                target_date="2026-11-10",
                engine=engine,
                raw_dir=raw_dir,
                pipeline_cmd=failing_cmd,
            )

    # Zero records left in 'processing' (no zombie lock)
    assert has_processing_lock(JOB_NAME, db=engine) is False
    assert list_job_runs(JOB_NAME, status="processing", db=engine) == []

    runs = list_job_runs(JOB_NAME, target_date="2026-11-10", db=engine)
    assert len(runs) == 1
    failed_run = runs[0]
    assert failed_run["status"] == "failed"
    assert failed_run["started_at"] is not None
    assert failed_run["finished_at"] is not None
    assert "Database connection timeout in ETL" in (failed_run["error_message"] or "")

    error_logs = [rec.getMessage() for rec in caplog.records if rec.levelno == logging.ERROR]
    assert any("job_name=nightly_export" in msg and "status=failed" in msg for msg in error_logs)


def test_cli_execution_with_target_date_and_coexistence_with_pipeline_runs(tmp_path):
    """End-to-end CLI test running `python scripts/nightly_export.py` with the real
    `python -m data.pipelines.telemetry_kpi_daily.run --no-prefect` subprocess.
    Verifies both `job_runs` (orchestration) and `reporting.pipeline_runs` (ETL).
    """
    source_db = tmp_path / "telemetry_full.sqlite"
    reporting_db = tmp_path / "reporting_schema.sqlite"
    _setup_telemetry_db(source_db)

    with sqlite3.connect(reporting_db) as conn:
        conn.executescript(
            """
            CREATE TABLE pipeline_runs (
                run_id TEXT PRIMARY KEY, pipeline_name TEXT NOT NULL, trigger TEXT NOT NULL,
                status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, requested_by TEXT,
                week_start TEXT NOT NULL, source_window_end TEXT NOT NULL, phase TEXT NOT NULL,
                checkpoint TEXT NOT NULL, source_watermark TEXT, events_read INTEGER NOT NULL DEFAULT 0,
                events_valid INTEGER NOT NULL DEFAULT 0, events_duplicate INTEGER NOT NULL DEFAULT 0,
                events_rejected INTEGER NOT NULL DEFAULT 0, events_pending INTEGER NOT NULL DEFAULT 0,
                rows_written INTEGER NOT NULL DEFAULT 0, input_digest TEXT, output_digest TEXT,
                prefect_flow_run_id TEXT, error_code TEXT, error_summary TEXT
            );
            CREATE TABLE pipeline_locks (
                pipeline_name TEXT NOT NULL, week_start TEXT NOT NULL, owner_run_id TEXT NOT NULL,
                lease_expires_at TEXT NOT NULL, heartbeat_at TEXT NOT NULL,
                PRIMARY KEY (pipeline_name, week_start)
            );
            CREATE TABLE pipeline_staging (
                run_id TEXT NOT NULL, office TEXT NOT NULL, programme_id TEXT NOT NULL,
                week_start TEXT NOT NULL, total_material_cost NUMERIC NOT NULL,
                kits_delivered_count INTEGER NOT NULL, shortage_events_count INTEGER NOT NULL,
                cost_variance_events_count INTEGER NOT NULL, currency TEXT NOT NULL,
                aggregate_json TEXT NOT NULL, output_digest TEXT NOT NULL,
                PRIMARY KEY (run_id, office, programme_id, week_start)
            );
            CREATE TABLE pipeline_lineage (
                run_id TEXT NOT NULL, event_id TEXT NOT NULL, event_type TEXT NOT NULL,
                source_timestamp TEXT NOT NULL, office TEXT NOT NULL, programme_id TEXT NOT NULL,
                week_start TEXT NOT NULL, PRIMARY KEY (run_id, event_id)
            );
            CREATE TABLE weekly_office_program_performance (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), office TEXT NOT NULL,
                programme_id TEXT NOT NULL, week_start TEXT NOT NULL,
                total_material_cost NUMERIC NOT NULL, kits_delivered_count INTEGER NOT NULL,
                shortage_events_count INTEGER NOT NULL, cost_variance_events_count INTEGER NOT NULL,
                currency TEXT NOT NULL, computed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (office, programme_id, week_start)
            );
            """
        )

    _verify_sqlite_backup(source_db, tmp_path)
    _verify_sqlite_backup(reporting_db, tmp_path)

    raw_dir = tmp_path / "raw_exports"
    env = os.environ.copy()
    env.update(
        {
            "TARGET_DATE": "2026-11-10",
            "JOB_RUNNER_DATABASE_URL": f"sqlite:///{source_db.as_posix()}",
            "TELEMETRY_READONLY_DATABASE_URL": f"sqlite:///{source_db.as_posix()}",
            "REPORTING_DATABASE_URL": f"sqlite:///{(tmp_path / 'reporting-main.db').as_posix()}",
            "PIPELINE_SQLITE_REPORTING_SCHEMA_PATH": str(reporting_db),
            "TELEMETRY_RAW_DIR": str(raw_dir),
            "PREFECT_HOME": str(tmp_path / "prefect-home"),
            "PREFECT_SERVER_ANALYTICS_ENABLED": "false",
            "PYTHONUTF8": "1",
        }
    )

    completed = subprocess.run(
        [sys.executable, str(SCRIPT_PATH)],
        cwd=str(REPO_ROOT),
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    assert completed.returncode == 0, completed.stdout + "\n" + completed.stderr

    # 1. Verify CSV backup file in data/raw/
    csv_file = raw_dir / "telemetry_2026-11-10.csv"
    assert csv_file.exists()

    # 2. Verify job_runs row in orchestration table
    with sqlite3.connect(source_db) as conn:
        job_rows = conn.execute(
            "SELECT job_name, target_date, status, error_message FROM job_runs"
        ).fetchall()
    assert job_rows == [("nightly_export", "2026-11-10", "completed", None)]

    # 3. Verify pipeline_runs row in ETL table (distinct responsibility)
    with sqlite3.connect(reporting_db) as conn:
        etl_rows = conn.execute(
            "SELECT pipeline_name, status, events_read, rows_written FROM pipeline_runs"
        ).fetchall()
    assert etl_rows == [("weekly_office_program_performance_flow", "Completed", 2, 1)]
