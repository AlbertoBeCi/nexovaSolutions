from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))
from data.pipelines.pipeline import (  # noqa: E402
    get_latest_pipeline_run,
    get_weekly_office_program_performance,
)

SCHEMA_PATH = REPO_ROOT / "docs/telemetry/event-schemas.json"
PIPELINE_PATH = REPO_ROOT / "data/pipelines/pipeline.py"
PYTHON = sys.executable
today_utc = datetime.now(timezone.utc).date()
current_monday = today_utc - timedelta(days=today_utc.weekday())
week_start_date = current_monday - timedelta(days=7)
WEEK_START = week_start_date.isoformat()
EVENT_TIMESTAMP = (week_start_date + timedelta(days=1)).strftime("%Y-%m-%d 10:00:00+00:00")


def _reporting_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
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


def _seed_source(database_path: Path) -> None:
    event_schemas = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))["definitions"]
    connection = sqlite3.connect(database_path)
    connection.execute(
        """CREATE TABLE telemetry_events (
            event_id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, event_type TEXT NOT NULL,
            request_id TEXT NOT NULL, tags TEXT NOT NULL
        )"""
    )
    records = []
    for index, event_type in enumerate(
        [
            "inbound_order_created",
            "outbound_order_created",
            "stock_threshold_triggered",
            "kit_cost_variance_detected",
        ]
    ):
        example = event_schemas[event_type]["examples"][0]
        tags = dict(example["properties"])
        tags.update(
            {
                "event_type": event_type,
                "environment": "production",
                "office": "valencia",
                "programme_id": "ventas-b2b",
                "currency": "EUR",
                "quantity": 50,
            }
        )
        if event_type == "inbound_order_created":
            tags["total_cost_minor"] = 12550
        records.append(
            (
                f"event-{index}",
                EVENT_TIMESTAMP,
                event_type,
                f"request-{index}",
                json.dumps(tags),
            )
        )
    connection.executemany(
        "INSERT INTO telemetry_events VALUES (?, ?, ?, ?, ?)", records
    )
    connection.commit()
    connection.close()


def _run_cli(tmp_path: Path, source: Path, reporting: Path) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.update({
        "PREFECT_HOME": str(tmp_path / "prefect-home"),
        "PREFECT_SERVER_ANALYTICS_ENABLED": "false",
        "TELEMETRY_READONLY_DATABASE_URL": f"sqlite:///{source.as_posix()}",
        "REPORTING_DATABASE_URL": f"sqlite:///{(tmp_path / 'reporting-main.db').as_posix()}",
        "PIPELINE_SQLITE_REPORTING_SCHEMA_PATH": str(reporting),
        "PYTHONUTF8": "1",
    })
    return subprocess.run(
        [str(PYTHON), str(PIPELINE_PATH)],
        cwd=REPO_ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=90,
    )


def test_cli_runs_full_pipeline_twice_without_duplicate_or_changed_rows(tmp_path, monkeypatch):
    source = tmp_path / "telemetry.sqlite"
    reporting = tmp_path / "reporting.sqlite"
    _seed_source(source)
    with sqlite3.connect(reporting) as connection:
        _reporting_schema(connection)

    # This isolated, disposable integration database is backed up and verified
    # before pipeline writes, following the repository's DB test rule.
    backup = tmp_path / "reporting.backup.sqlite"
    shutil.copy2(reporting, backup)
    with sqlite3.connect(backup) as connection:
        assert connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"

    source_before = source.read_bytes()
    restored = tmp_path / "restored-reporting.sqlite"
    shutil.copy2(backup, restored)
    with sqlite3.connect(restored) as connection:
        assert connection.execute("SELECT count(*) FROM weekly_office_program_performance").fetchone()[0] == 0

    first = _run_cli(tmp_path, source, reporting)
    assert first.returncode == 0, first.stdout + first.stderr
    assert "An error was encountered while committing transaction" not in first.stderr
    cache_files = list((tmp_path / "prefect-home" / "storage").iterdir())
    assert any(item.is_file() and len(item.name) == 64 and item.stat().st_size > 0 for item in cache_files)
    with sqlite3.connect(reporting) as connection:
        first_rows = connection.execute(
            """SELECT id, office, programme_id, week_start, total_material_cost,
                kits_delivered_count, shortage_events_count, cost_variance_events_count,
                currency, computed_at FROM weekly_office_program_performance"""
        ).fetchall()
    assert len(first_rows) == 1
    assert first_rows[0][1:9] == (
        "valencia", "ventas-b2b", WEEK_START, 125.5, 1, 1, 1, "EUR"
    )

    second = _run_cli(tmp_path, source, reporting)
    assert second.returncode == 0, second.stdout + second.stderr
    with sqlite3.connect(reporting) as connection:
        second_rows = connection.execute(
            """SELECT id, office, programme_id, week_start, total_material_cost,
                kits_delivered_count, shortage_events_count, cost_variance_events_count,
                currency, computed_at FROM weekly_office_program_performance"""
        ).fetchall()
        runs = connection.execute(
            "SELECT status, events_read, events_valid, rows_written FROM pipeline_runs ORDER BY started_at"
        ).fetchall()
    assert source.read_bytes() == source_before
    assert second_rows == first_rows
    assert runs == [("Completed", 4, 4, 1), ("Completed", 4, 4, 1)]

    monkeypatch.setenv(
        "REPORTING_DATABASE_URL",
        f"sqlite:///{(tmp_path / 'reporting-main.db').as_posix()}",
    )
    monkeypatch.setenv("PIPELINE_SQLITE_REPORTING_SCHEMA_PATH", str(reporting))
    latest = get_latest_pipeline_run()
    report = get_weekly_office_program_performance(WEEK_START)
    assert latest is not None
    assert latest["status"] == "Completed"
    assert latest["events_read"] == 4
    assert report["week_start"] == WEEK_START
    assert report["entries"][0]["total_material_cost"] == 125.5
