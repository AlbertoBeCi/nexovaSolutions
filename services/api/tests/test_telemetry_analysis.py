from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlmodel import Session, create_engine

from telemetry_storage import TelemetryEventRow, insert_telemetry_events
from telemetry_schemas import TelemetryEvent

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.telemetry.analysis import (  # noqa: E402
    auth_failure_rate,
    events_per_day,
    latency_by_route,
    request_error_rate,
)


@pytest.fixture
def telemetry_session():
    engine = create_engine("sqlite://")
    TelemetryEventRow.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _event(event_type: str, event_id: int, day: int, properties: dict) -> TelemetryEvent:
    return TelemetryEvent.model_validate(
        {
            "eventId": f"00000000-0000-0000-0000-{event_id:012d}",
            "timestamp": f"2026-11-{day:02d}T23:30:00-02:00",
            "sessionId": None,
            "userId": None,
            "event_type": event_type,
            "schemaVersion": "1.0.0",
            "requestId": f"10000000-0000-0000-0000-{event_id:012d}",
            "properties": properties,
        }
    )


@pytest.fixture
def populated_session(telemetry_session):
    events = [
        _event("client_request_completed", 1, 1, {"route_template": "/inventory", "status_code": 200, "duration_ms": 10}),
        _event("client_request_completed", 2, 1, {"route_template": "/inventory", "status_code": 401, "duration_ms": 30}),
        _event("client_request_completed", 3, 2, {"route_template": "/login", "status_code": 0, "duration_ms": 50}),
        _event("client_request_completed", 4, 2, {"route_template": "/login", "status_code": 700, "duration_ms": "infinity"}),
        _event("login_failed", 5, 2, {"route_template": "/auth/login"}),
        _event("login_succeeded", 6, 2, {"route_template": "/auth/login"}),
        _event("page_viewed", 7, 2, {"page": "/login"}),
    ]
    insert_telemetry_events(telemetry_session, events)
    return telemetry_session


def _window():
    return datetime(2026, 11, 1, tzinfo=timezone.utc), datetime(2026, 11, 4, tzinfo=timezone.utc)


def test_events_per_day_groups_by_utc_date_and_type(populated_session):
    start, end = _window()

    rows = events_per_day(populated_session, start, end)

    assert rows == [
        {"date": "2026-11-02", "event_type": "client_request_completed", "events": 2},
        {"date": "2026-11-03", "event_type": "client_request_completed", "events": 2},
        {"date": "2026-11-03", "event_type": "login_failed", "events": 1},
        {"date": "2026-11-03", "event_type": "login_succeeded", "events": 1},
        {"date": "2026-11-03", "event_type": "page_viewed", "events": 1},
    ]


def test_request_error_rate_counts_network_and_http_failures_per_route(populated_session):
    start, end = _window()

    rows = request_error_rate(populated_session, start, end)

    assert rows == [
        {"date": "2026-11-02", "route_template": "/inventory", "requests": 2, "errors": 1, "error_rate": 0.5},
        {"date": "2026-11-03", "route_template": "/login", "requests": 1, "errors": 1, "error_rate": 1.0},
    ]


def test_latency_by_route_discards_invalid_and_summarizes_samples(populated_session):
    start, end = _window()

    rows = latency_by_route(populated_session, start, end)

    assert rows == [
        {"date": "2026-11-02", "route_template": "/inventory", "samples": 2, "mean_ms": 20.0, "p95_ms": 29.0},
        {"date": "2026-11-03", "route_template": "/login", "samples": 1, "mean_ms": 50.0, "p95_ms": 50.0},
    ]


def test_auth_failure_rate_uses_failed_over_all_attempts(populated_session):
    start, end = _window()

    rows = auth_failure_rate(populated_session, start, end)

    assert rows == [{"date": "2026-11-03", "attempts": 2, "failures": 1, "failure_rate": 0.5}]


def test_metrics_are_empty_without_rows(telemetry_session):
    start, end = _window()

    assert events_per_day(telemetry_session, start, end) == []
    assert request_error_rate(telemetry_session, start, end) == []
    assert latency_by_route(telemetry_session, start, end) == []
    assert auth_failure_rate(telemetry_session, start, end) == []


def test_end_date_is_exclusive(populated_session):
    rows = events_per_day(
        populated_session,
        datetime(2026, 11, 2, tzinfo=timezone.utc),
        datetime(2026, 11, 3, tzinfo=timezone.utc),
    )

    assert rows == [{"date": "2026-11-02", "event_type": "client_request_completed", "events": 2}]
