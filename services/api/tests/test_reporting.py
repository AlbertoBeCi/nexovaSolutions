from __future__ import annotations

from datetime import date, datetime, timezone
import uuid

import pytest

from reporting import router as reporting_router


def _run_metadata():
    return {
        "run_id": "c04c84f2-0d3f-4f1f-8846-b48b03629df4",
        "pipeline_name": "weekly_office_program_performance_flow",
        "trigger": "backfill",
        "status": "Completed",
        "started_at": datetime(2026, 11, 9, 6, tzinfo=timezone.utc),
        "finished_at": datetime(2026, 11, 9, 6, 1, tzinfo=timezone.utc),
        "requested_by": "admin-uuid",
        "week_start": date(2026, 11, 2),
        "source_window_end": datetime(2026, 11, 9, tzinfo=timezone.utc),
        "phase": "verify",
        "checkpoint": "verify",
        "source_watermark": None,
        "events_read": 4,
        "events_valid": 4,
        "events_duplicate": 0,
        "events_rejected": 0,
        "events_pending": 0,
        "rows_written": 1,
        "input_digest": "a" * 64,
        "output_digest": "b" * 64,
        "prefect_flow_run_id": "prefect-run-id",
        "error_code": None,
        "error_summary": None,
    }


def test_latest_pipeline_run_requires_authentication(anon_client):
    assert anon_client.get("/reporting/pipeline-runs/latest").status_code == 401


def test_latest_pipeline_run_forbids_regular_user(user_client):
    assert user_client.get("/reporting/pipeline-runs/latest").status_code == 403


def test_latest_pipeline_run_returns_audit_metadata(admin_client, monkeypatch):
    monkeypatch.setattr(reporting_router, "get_latest_pipeline_run", _run_metadata)

    response = admin_client.get("/reporting/pipeline-runs/latest")

    assert response.status_code == 200
    assert response.json()["status"] == "Completed"
    assert response.json()["started_at"]
    assert response.json()["finished_at"]
    assert response.json()["events_read"] == 4
    assert response.json()["rows_written"] == 1


def test_latest_pipeline_run_reports_no_history(admin_client, monkeypatch):
    monkeypatch.setattr(reporting_router, "get_latest_pipeline_run", lambda: None)

    response = admin_client.get("/reporting/pipeline-runs/latest")

    assert response.status_code == 404


def test_manual_run_uses_prefect_flow_and_records_admin(admin_client, monkeypatch):
    calls = []

    def submit(**kwargs):
        calls.append(kwargs)
        return {"run_id": "prefect-run-id", "week_start": "2026-11-02", "status": "Scheduled"}

    monkeypatch.setattr(reporting_router, "submit_weekly_office_program_performance_flow", submit)

    response = admin_client.post(
        "/reporting/pipeline-runs", json={"week_start": "2026-11-02"}
    )

    assert response.status_code == 202
    assert response.json() == {
        "run_id": "prefect-run-id",
        "week_start": "2026-11-02",
        "status": "Scheduled",
    }
    assert calls[0]["week_start"] == date(2026, 11, 2)
    uuid.UUID(calls[0]["requested_by"])


@pytest.mark.parametrize(
    "path,method,body",
    [
        ("/reporting/pipeline-runs", "post", {"week_start": "2026-11-03"}),
        ("/reporting/weekly-office-program-performance?week_start=2026-11-03", "get", None),
    ],
)
def test_reporting_endpoints_reject_non_monday_week(admin_client, path, method, body):
    response = getattr(admin_client, method)(path, json=body) if body is not None else getattr(admin_client, method)(path)

    assert response.status_code == 422


def test_manual_run_maps_prefect_outage_to_safe_503(admin_client, monkeypatch):
    def unavailable(**_kwargs):
        raise RuntimeError("secret connection string must not leak")

    monkeypatch.setattr(reporting_router, "submit_weekly_office_program_performance_flow", unavailable)

    response = admin_client.post("/reporting/pipeline-runs", json={})

    assert response.status_code == 503
    assert "secret connection string" not in response.text


def test_kpi_endpoint_matches_business_contract(admin_client, monkeypatch):
    monkeypatch.setattr(
        reporting_router,
        "get_weekly_office_program_performance",
        lambda _week: {
            "week_start": "2026-11-02",
            "entries": [
                {
                    "office": "valencia",
                    "programme_id": "ventas-b2b",
                    "week_start": date(2026, 11, 2),
                    "total_material_cost": 125.5,
                    "kits_delivered_count": 1,
                    "shortage_events_count": 2,
                    "cost_variance_events_count": 3,
                    "currency": "EUR",
                }
            ],
        },
    )

    response = admin_client.get(
        "/reporting/weekly-office-program-performance?week_start=2026-11-02"
    )

    assert response.status_code == 200
    assert response.json() == {
        "week_start": "2026-11-02",
        "entries": [
            {
                "office": "valencia",
                "programme_id": "ventas-b2b",
                "total_material_cost": 125.5,
                "kits_delivered_count": 1,
                "shortage_events_count": 2,
                "cost_variance_events_count": 3,
                "currency": "EUR",
            }
        ],
    }


def test_kpi_endpoint_requires_authentication(anon_client):
    path = "/reporting/weekly-office-program-performance"
    assert anon_client.get(path).status_code == 401


def test_kpi_endpoint_forbids_regular_user(user_client):
    path = "/reporting/weekly-office-program-performance"
    assert user_client.get(path).status_code == 403


def test_kpi_endpoint_maps_reporting_database_failure_to_safe_503(admin_client, monkeypatch):
    def unavailable(_week):
        raise RuntimeError("secret database URL must not leak")

    monkeypatch.setattr(reporting_router, "get_weekly_office_program_performance", unavailable)

    response = admin_client.get("/reporting/weekly-office-program-performance")

    assert response.status_code == 503
    assert "secret database URL" not in response.text
