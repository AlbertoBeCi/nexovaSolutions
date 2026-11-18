"""Tests for Celery async tasks, GET /tasks/{task_id}, and Dead Letter Queue (Ticket #DEV-55)."""
from __future__ import annotations

import base64
from types import SimpleNamespace

import pytest

import celery_app as celery_module
from routes import tasks as tasks_route
from tasks import analyze_incidents_csv_task, generate_telemetry_report_task


@pytest.fixture(autouse=True)
def eager_celery(monkeypatch):
    """Run Celery tasks eagerly in-memory without requiring a live Redis server."""
    celery_module.clear_in_memory_dlq()
    monkeypatch.setattr(celery_module, "_get_redis_client", lambda: None)
    monkeypatch.setattr(celery_module.celery_app.conf, "task_always_eager", True)
    monkeypatch.setattr(celery_module.celery_app.conf, "task_eager_propagates", False)
    yield
    celery_module.clear_in_memory_dlq()


def test_post_incidents_analyze_returns_202_immediately_without_blocking(user_client, monkeypatch):
    """Verify POST /api/incidents/analyze enqueues the task and returns 202 with task_id."""
    enqueued = []

    def fake_delay(upload_id: str, filename: str):
        enqueued.append((upload_id, filename))
        return SimpleNamespace(id="task-async-001")

    monkeypatch.setattr("routes.incidents.analyze_incidents_csv_task.delay", fake_delay)
    csv_bytes = (
        b"ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
        b"1,2026-01-01,Acme,TECHNICAL,Login issue,AGT-01,OPEN,a@acme.com,\n"
    )

    response = user_client.post(
        "/api/incidents/analyze",
        files={"file": ("tickets.csv", csv_bytes, "text/csv")},
    )

    assert response.status_code == 202
    assert response.json() == {"task_id": "task-async-001", "status": "pending"}
    assert len(enqueued) == 1
    assert enqueued[0][1] == "tickets.csv"


def test_post_telemetry_report_returns_202_with_task_id(admin_client, monkeypatch):
    monkeypatch.setattr("routes.telemetry_report.get_database_url", lambda: "sqlite://")
    monkeypatch.setattr(
        "routes.telemetry_report.generate_telemetry_report_task.delay",
        lambda start_iso, end_iso: SimpleNamespace(id="task-report-123"),
    )

    response = admin_client.post("/telemetry/report")

    assert response.status_code == 202
    assert response.json() == {"task_id": "task-report-123", "status": "pending"}


@pytest.mark.parametrize(
    ("celery_state", "expected_status"),
    [
        ("PENDING", "pending"),
        ("RECEIVED", "pending"),
        ("STARTED", "started"),
        ("RETRY", "started"),
        ("SUCCESS", "success"),
        ("FAILURE", "failure"),
    ],
)
def test_get_task_status_normalizes_all_celery_states(
    user_client, monkeypatch, celery_state: str, expected_status: str
):
    fake_result = SimpleNamespace(
        state=celery_state,
        result={"total_records": 5} if celery_state == "SUCCESS" else None,
        info=RuntimeError("boom") if celery_state == "FAILURE" else None,
    )
    monkeypatch.setattr(tasks_route, "AsyncResult", lambda task_id, app=None: fake_result)

    response = user_client.get("/tasks/task-xyz")

    assert response.status_code == 200
    body = response.json()
    assert body["task_id"] == "task-xyz"
    assert body["status"] == expected_status
    if expected_status == "success":
        assert body["result"] == {"total_records": 5}
    if expected_status == "failure":
        assert body["error"] == "boom"


def test_task_retries_three_times_and_routes_to_dlq_on_exhausted_failure(user_client, monkeypatch):
    """Force a task failure and verify 3 attempts + DLQ entry with task_id, attempt, error_message."""
    attempts = 0

    def always_fail(*_args, **_kwargs):
        nonlocal attempts
        attempts += 1
        raise RuntimeError("Simulated worker crash")

    monkeypatch.setattr("tasks.analyze_csv", always_fail)
    from tasks import store_upload_payload

    store_upload_payload("upload-broken-1", b"dummy")
    result = analyze_incidents_csv_task.delay("upload-broken-1", "broken.csv")

    assert attempts == 3
    assert result.state == "FAILURE"

    dlq_response = user_client.get("/tasks/dlq")
    assert dlq_response.status_code == 200
    dlq_entries = dlq_response.json()
    assert len(dlq_entries) == 1
    entry = dlq_entries[0]
    assert entry["task_id"] == str(result.id)
    assert entry["task_name"] == "tasks.analyze_incidents_csv"
    assert entry["attempt"] == 3
    assert "Simulated worker crash" in entry["error_message"]
    assert entry["failed_at"]
