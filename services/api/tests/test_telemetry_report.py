from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine, select

from routes.telemetry import get_telemetry_session
from routes import telemetry_report
from telemetry_schemas import TelemetryEvent
from telemetry_storage import TelemetryEventRow, init_telemetry_db, insert_telemetry_events


@pytest.fixture
def report_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    init_telemetry_db(engine)
    yield engine
    engine.dispose()


@pytest.fixture(autouse=True)
def clear_report_cache():
    telemetry_report._cache.clear()
    yield
    telemetry_report._cache.clear()


@pytest.fixture
def report_session(report_engine, anon_client):
    from main import app

    def _session():
        with Session(report_engine) as session:
            yield session

    app.dependency_overrides[get_telemetry_session] = _session
    yield
    app.dependency_overrides.pop(get_telemetry_session, None)


def _event(event_type: str, at: datetime, properties: dict) -> TelemetryEvent:
    return TelemetryEvent(
        eventId=uuid4(),
        timestamp=at,
        sessionId=None,
        userId=None,
        event_type=event_type,
        schemaVersion="1.0.0",
        requestId=uuid4(),
        properties=properties,
    )


def _report_events(engine):
    now = datetime(2026, 11, 3, 12, tzinfo=timezone.utc)
    events = [
        _event("page_viewed", now, {"page": "/telemetry"}),
        _event("client_request_completed", now, {"route_template": "/auth/login", "status_code": 200, "duration_ms": 100}),
        _event("client_request_completed", now + timedelta(minutes=1), {"route_template": "/auth/login", "status_code": 401, "duration_ms": 300}),
        _event("login_succeeded", now + timedelta(minutes=2), {"route_template": "/auth/login", "duration_ms": 50}),
        _event("login_failed", now + timedelta(minutes=3), {"route_template": "/auth/login", "duration_ms": 70}),
    ]
    with Session(engine) as session:
        insert_telemetry_events(session, events)


def test_report_returns_all_metrics_for_explicit_period(admin_client, report_session, report_engine, monkeypatch):
    _report_events(report_engine)
    monkeypatch.setattr(telemetry_report, "get_database_url", lambda: "sqlite://")

    response = admin_client.get(
        "/telemetry/report",
        params={"start_date": "2026-11-03T00:00:00Z", "end_date": "2026-11-04T00:00:00Z"},
    )

    assert response.status_code == 200
    body = response.json()
    assert datetime.fromisoformat(body["period"]["from"]) == datetime(2026, 11, 3, tzinfo=timezone.utc)
    assert datetime.fromisoformat(body["period"]["to"]) == datetime(2026, 11, 4, tzinfo=timezone.utc)
    assert set(body["metrics"]) == {
        "events_per_day", "request_error_rate", "latency_by_route", "auth_failure_rate"
    }
    assert body["metrics"]["auth_failure_rate"] == [
        {"date": "2026-11-03", "attempts": 2, "failures": 1, "failure_rate": 0.5}
    ]
    assert body["metrics"]["request_error_rate"] == [
        {"date": "2026-11-03", "route_template": "/auth/login", "requests": 2, "errors": 1, "error_rate": 0.5}
    ]


def test_report_requires_admin(anon_client, user_client):
    authorization = user_client.headers.pop("Authorization")
    assert anon_client.get("/telemetry/report").status_code == 401
    user_client.headers["Authorization"] = authorization
    assert user_client.get("/telemetry/report").status_code == 403


@pytest.mark.parametrize(
    ("params", "expected_detail"),
    [
        ({"start_date": "2026-11-03T00:00:00", "end_date": "2026-11-04T00:00:00Z"}, "start_date debe incluir zona horaria."),
        ({"start_date": "2026-11-04T00:00:00Z", "end_date": "2026-11-03T00:00:00Z"}, "start_date debe ser anterior a end_date."),
    ],
)
def test_report_rejects_invalid_period(admin_client, params, expected_detail):
    response = admin_client.get("/telemetry/report", params=params)
    assert response.status_code == 422
    assert response.json()["detail"] == expected_detail


def test_report_uses_seven_day_default_and_reuses_cache(admin_client, report_session, report_engine, monkeypatch):
    _report_events(report_engine)
    monkeypatch.setattr(telemetry_report, "get_database_url", lambda: "sqlite://")
    calls = 0
    original = telemetry_report._build_report

    def counted(session, start, end):
        nonlocal calls
        calls += 1
        return original(session, start, end)

    monkeypatch.setattr(telemetry_report, "_build_report", counted)
    first = admin_client.get("/telemetry/report")
    second = admin_client.get("/telemetry/report")

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    start = datetime.fromisoformat(first.json()["period"]["from"])
    end = datetime.fromisoformat(first.json()["period"]["to"])
    assert end - start == timedelta(days=7)
    assert calls == 1


def test_report_cache_expires_after_ttl(admin_client, report_session, report_engine, monkeypatch):
    _report_events(report_engine)
    monkeypatch.setattr(telemetry_report, "get_database_url", lambda: "sqlite://")
    now = [0.0]
    from response_cache import TTLResponseCache

    monkeypatch.setattr(telemetry_report, "_cache", TTLResponseCache(clock=lambda: now[0]))
    calls = 0
    original = telemetry_report._build_report

    def counted(session, start, end):
        nonlocal calls
        calls += 1
        return original(session, start, end)

    monkeypatch.setattr(telemetry_report, "_build_report", counted)
    assert admin_client.get("/telemetry/report").status_code == 200
    now[0] = 61
    assert admin_client.get("/telemetry/report").status_code == 200
    assert calls == 2


def test_equivalent_utc_offsets_share_cache_key():
    start_utc = datetime.fromisoformat("2026-11-03T00:00:00+00:00")
    end_utc = datetime.fromisoformat("2026-11-04T00:00:00+00:00")
    start_offset = datetime.fromisoformat("2026-11-03T02:00:00+02:00")
    end_offset = datetime.fromisoformat("2026-11-04T02:00:00+02:00")

    assert telemetry_report._cache_key(start_utc, end_utc) == telemetry_report._cache_key(start_offset, end_offset)


def test_report_does_not_cache_storage_errors(admin_client, report_session, report_engine, monkeypatch):
    _report_events(report_engine)
    monkeypatch.setattr(telemetry_report, "get_database_url", lambda: "sqlite://")
    calls = 0
    original = telemetry_report._build_report

    def fail_once(session, start, end):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("database unavailable")
        return original(session, start, end)

    monkeypatch.setattr(telemetry_report, "_build_report", fail_once)
    params = {"start_date": "2026-11-03T00:00:00Z", "end_date": "2026-11-04T00:00:00Z"}

    assert admin_client.get("/telemetry/report", params=params).status_code == 503
    assert admin_client.get("/telemetry/report", params=params).status_code == 200
    assert calls == 2


def test_report_returns_service_unavailable_without_database(admin_client, report_session, monkeypatch):
    monkeypatch.setattr(telemetry_report, "get_database_url", lambda: None)
    response = admin_client.get("/telemetry/report")
    assert response.status_code == 503


def test_login_telemetry_is_persisted_without_changing_login_result(
    admin_client, report_engine, monkeypatch
):
    import telemetry_capture

    monkeypatch.setattr(telemetry_capture, "get_database_url", lambda: "sqlite://")
    monkeypatch.setattr(telemetry_capture, "get_engine", lambda: report_engine)
    headers = {"X-Nexova-App": "backoffice"}

    failed = admin_client.post(
        "/auth/login", data={"username": "admin@nexova.com", "password": "wrong"}, headers=headers
    )
    succeeded = admin_client.post(
        "/auth/login", data={"username": "admin@nexova.com", "password": "testpass123"}, headers=headers
    )

    assert failed.status_code == 401
    assert succeeded.status_code == 200
    with Session(report_engine) as session:
        rows = session.exec(select(TelemetryEventRow).order_by(TelemetryEventRow.timestamp)).all()
    assert [row.event_type for row in rows] == ["login_failed", "login_succeeded"]
    assert all("admin@nexova.com" not in str(row.tags) for row in rows)


def test_login_succeeds_when_auth_telemetry_storage_fails(admin_client, monkeypatch):
    import telemetry_capture

    monkeypatch.setattr(telemetry_capture, "get_database_url", lambda: "sqlite://")

    def fail_engine():
        raise RuntimeError("offline")

    monkeypatch.setattr(telemetry_capture, "get_engine", fail_engine)
    response = admin_client.post(
        "/auth/login",
        data={"username": "admin@nexova.com", "password": "testpass123"},
        headers={"X-Nexova-App": "backoffice"},
    )

    assert response.status_code == 200
