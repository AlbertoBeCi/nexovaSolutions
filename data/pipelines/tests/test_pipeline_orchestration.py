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
from prefect.states import Completed, Failed  # noqa: E402



SUBFLOWS = (
    "extract_weekly_office_program_events_flow",
    "validate_weekly_office_program_events_flow",
    "calculate_weekly_office_program_kpis_flow",
    "stage_weekly_office_program_kpis_flow",
    "publish_weekly_office_program_kpis_flow",
)


@pytest.fixture(autouse=True)
def direct_subflows_without_prefect_server(monkeypatch):
    # Exercise each subflow body in existing unit tests without orchestration I/O.
    for name in SUBFLOWS:
        monkeypatch.setattr(pipeline, name, getattr(pipeline, name).fn)
    optional = pipeline.evaluate_weekly_office_program_kpis_flow.fn
    monkeypatch.setattr(pipeline, "evaluate_weekly_office_program_kpis_flow",
                        lambda *args, **kwargs: optional(*args))

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
    ) == pipeline.canonical_digest({"version": "v1", "week_start": date(2026, 11, 2), "input_digest": "a" * 64})


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



def test_main_coordinates_all_business_subflows_with_explicit_inputs(monkeypatch):
    calls = []
    week = date(2026, 11, 2)
    source = [{"event_id": "out-1"}]
    validated = _fixture_events()
    aggregates = _aggregate()
    digest = "b" * 64
    monkeypatch.setattr(pipeline, "start_pipeline_run_and_acquire_lock", lambda *args: {"acquired": True})
    results = [source, validated, (aggregates, digest), 1, 1]
    for name, result in zip(SUBFLOWS, results):
        def record(*args, _name=name, _result=result):
            calls.append((_name, args))
            return _result
        monkeypatch.setattr(pipeline, name, record)
    finalizations = []
    monkeypatch.setattr(pipeline, "finalize_pipeline_run", lambda *args: finalizations.append(args))
    def optional(*args, **kwargs):
        calls.append(("evaluate", args))
        assert kwargs == {"return_state": True}
        return Completed(data="evidence.json")
    monkeypatch.setattr(pipeline, "evaluate_weekly_office_program_kpis_flow", optional)
    result = pipeline.weekly_office_program_performance_flow.fn(week_start=week)
    run_id = result["run_id"]
    assert calls == [
        (SUBFLOWS[0], (week, run_id)),
        (SUBFLOWS[1], (source, week, run_id)),
        (SUBFLOWS[2], (validated, week)),
        (SUBFLOWS[3], (aggregates, validated, digest, week, run_id)),
        (SUBFLOWS[4], (week, digest, run_id)),
        ("evaluate", (run_id, week, validated, 1, digest)),
    ]
    assert finalizations == [(run_id, week, "Completed", "verify", 1)]
    assert result["status"] == "Completed"


@pytest.mark.parametrize("failed_index,checkpoint", list(enumerate(["extract", "validate", "transform", "stage", "load"])))
def test_failed_business_subflow_stops_downstream_and_preserves_checkpoint(monkeypatch, failed_index, checkpoint):
    calls = []
    finalizations = []
    monkeypatch.setattr(pipeline, "start_pipeline_run_and_acquire_lock", lambda *args: {"acquired": True})
    results = [[{}], _fixture_events(), (_aggregate(), "b" * 64), 1, 1]
    for index, (name, result) in enumerate(zip(SUBFLOWS, results)):
        def subflow(*args, _index=index, _result=result):
            calls.append(_index)
            if _index == failed_index:
                raise ConnectionError("private connection details")
            return _result
        monkeypatch.setattr(pipeline, name, subflow)
    monkeypatch.setattr(pipeline, "finalize_pipeline_run", lambda *args: finalizations.append(args))
    with pytest.raises(ConnectionError):
        pipeline.weekly_office_program_performance_flow.fn(week_start="2026-11-02")
    assert calls == list(range(failed_index + 1))
    assert finalizations[0][2:4] == ("Failed", checkpoint)
    assert "private connection" not in finalizations[0][-1]


def test_active_week_lease_skips_all_business_subflows(monkeypatch):
    monkeypatch.setattr(pipeline, "start_pipeline_run_and_acquire_lock",
                        lambda *args: {"acquired": False, "owner_run_id": "existing-run"})
    for name in SUBFLOWS:
        monkeypatch.setattr(pipeline, name, lambda *args: pytest.fail("Lease prevents subflow execution"))
    result = pipeline.weekly_office_program_performance_flow.fn(week_start="2026-11-02")
    assert result["status"] == "Running"
    assert result["run_id"] == "existing-run"


def test_empty_material_source_is_not_published(monkeypatch):
    monkeypatch.setattr(pipeline, "extract_telemetry_events", lambda *args: [])
    monkeypatch.setattr(pipeline, "record_extraction_checkpoint", lambda *args: None)
    with pytest.raises(pipeline.NoPublishableBusinessEvents):
        pipeline.extract_weekly_office_program_events_flow(date(2026, 11, 2), "run")


def test_no_valid_kpi_events_are_not_published(monkeypatch):
    monkeypatch.setattr(pipeline, "aggregate_weekly_performance", lambda *args: [])
    with pytest.raises(pipeline.NoPublishableBusinessEvents):
        pipeline.calculate_weekly_office_program_kpis_flow(_fixture_events(), date(2026, 11, 2))


def test_kpi_cache_key_is_safe_for_windows_result_storage():
    key = pipeline._aggregate_cache_key(None, {"validated": _fixture_events(), "week_start": date(2026, 11, 2)})
    assert not any(character in key for character in '<>:"/\\|?*')



def test_kpi_cache_key_changes_with_week_version_and_source_digest(monkeypatch):
    parameters = {"validated": _fixture_events(), "week_start": date(2026, 11, 2)}
    original = pipeline._aggregate_cache_key(None, parameters)
    assert pipeline._aggregate_cache_key(None, parameters) == original
    assert pipeline._aggregate_cache_key(None, {**parameters, "week_start": date(2026, 11, 9)}) != original
    from dataclasses import replace
    changed = replace(parameters["validated"], input_digest="c" * 64)
    assert pipeline._aggregate_cache_key(None, {**parameters, "validated": changed}) != original
    monkeypatch.setattr(pipeline, "TRANSFORM_VERSION", "next-version")
    assert pipeline._aggregate_cache_key(None, parameters) != original
