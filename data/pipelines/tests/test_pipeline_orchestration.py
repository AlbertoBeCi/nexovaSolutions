from __future__ import annotations

import sys
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

from data.pipelines import pipeline  # noqa: E402
from data.process.business_performance import ValidatedEvents  # noqa: E402
from prefect.states import Failed  # noqa: E402


def _fixture_events():
    return ValidatedEvents(
        events=(
            {
                "event_id": "out-1",
                "timestamp": datetime(2026, 11, 3, tzinfo=timezone.utc),
                "event_type": "outbound_order_created",
                "request_id": "request-1",
                "tags": {"office": "valencia", "programme_id": "ventas-b2b", "currency": "EUR"},
            },
        ),
        events_read=1,
        events_duplicate=0,
        events_rejected=0,
        events_pending=0,
        events_non_production=0,
        input_digest="a" * 64,
    )


def _aggregate():
    return [
        {
            "office": "valencia",
            "programme_id": "ventas-b2b",
            "week_start": date(2026, 11, 2),
            "total_material_cost": Decimal("0.00"),
            "kits_delivered_count": 1,
            "shortage_events_count": 0,
            "cost_variance_events_count": 0,
            "currency": "EUR",
        }
    ]


def test_external_database_tasks_retry_with_bounded_delays():
    for task in (
        pipeline.start_pipeline_run_and_acquire_lock,
        pipeline.extract_telemetry_events,
        pipeline.record_extraction_checkpoint,
        pipeline.record_validation_checkpoint,
        pipeline.stage_weekly_aggregates,
        pipeline.replace_reporting_partition,
        pipeline.finalize_pipeline_run,
    ):
        assert task.retries == 3
        assert task.retry_delay_seconds == [2, 5, 10]


def test_expensive_transform_cache_is_persistent_for_one_hour():
    assert pipeline.aggregate_weekly_performance.persist_result is True
    assert pipeline.aggregate_weekly_performance.cache_expiration.total_seconds() == 3600
    assert pipeline._aggregate_cache_key(
        None, {"validated": _fixture_events(), "week_start": date(2026, 11, 2)}
    ) == "v1:2026-11-02:" + "a" * 64


def test_optional_eval_failure_is_returned_and_does_not_fail_published_flow(monkeypatch):
    finalizations = []
    monkeypatch.setattr(
        pipeline,
        "start_pipeline_run_and_acquire_lock",
        lambda *args: {"acquired": True, "owner_run_id": args[0]},
    )
    monkeypatch.setattr(pipeline, "extract_telemetry_events", lambda *args: [{"event_id": "out-1"}])
    monkeypatch.setattr(pipeline, "record_extraction_checkpoint", lambda *args: None)
    monkeypatch.setattr(pipeline, "validate_and_deduplicate_events_task", lambda *args: _fixture_events())
    monkeypatch.setattr(pipeline, "record_validation_checkpoint", lambda *args: None)
    monkeypatch.setattr(pipeline, "aggregate_weekly_performance", lambda *args: _aggregate())
    monkeypatch.setattr(pipeline, "validate_weekly_aggregates_task", lambda *args: (_aggregate(), "b" * 64))
    monkeypatch.setattr(pipeline, "stage_weekly_aggregates", lambda *args: 1)
    monkeypatch.setattr(pipeline, "replace_reporting_partition", lambda *args: 1)
    monkeypatch.setattr(pipeline, "finalize_pipeline_run", lambda *args: finalizations.append(args))
    monkeypatch.setattr(
        pipeline,
        "write_pipeline_eval_snapshot",
        lambda *args, **kwargs: Failed(message="disk unavailable"),
    )
    monkeypatch.setattr(pipeline, "get_run_logger", lambda: logging.getLogger("pipeline-test"))

    result = pipeline.weekly_office_program_performance_flow.fn(week_start="2026-11-02")

    assert result["status"] == "Completed"
    assert result["rows_written"] == 1
    assert len(finalizations) == 1
    assert finalizations[0][2] == "Completed"


def test_critical_task_failure_is_recorded_then_propagated(monkeypatch):
    finalizations = []
    monkeypatch.setattr(
        pipeline,
        "start_pipeline_run_and_acquire_lock",
        lambda *args: {"acquired": True, "owner_run_id": args[0]},
    )

    def fail_extract(*_args):
        raise ConnectionError("database URL must not appear in audit")

    monkeypatch.setattr(pipeline, "extract_telemetry_events", fail_extract)
    monkeypatch.setattr(pipeline, "finalize_pipeline_run", lambda *args: finalizations.append(args))

    with pytest.raises(ConnectionError):
        pipeline.weekly_office_program_performance_flow.fn(week_start="2026-11-02")

    assert len(finalizations) == 1
    assert finalizations[0][2] == "Failed"
    assert finalizations[0][5] == "PIPELINE_STEP_FAILED"
    assert "ConnectionError" in finalizations[0][6]
    assert "database URL" not in finalizations[0][6]
