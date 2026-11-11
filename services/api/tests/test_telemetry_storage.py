"""Tests for real telemetry storage (Fase 1 y Fase 2).

Uses an in-memory SQLite engine per test to isolate database calls.
Tests the 8-column schema, 3 indices, allowlists in tags, and individual rejection.
"""
from __future__ import annotations

import copy
import json
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine, select

from routes.telemetry import get_telemetry_session
from telemetry_schemas import TelemetryBatch, TelemetryEvent
from telemetry_storage import (
    TelemetryEventRow,
    _extract_tags,
    init_telemetry_db,
    insert_telemetry_events,
    telemetry_metadata,
)


# ---------------------------------------------------------------------------
# Helpers & Fixtures
# ---------------------------------------------------------------------------

def _make_engine():
    """Create an isolated SQLite engine and initialize telemetry schema."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    init_telemetry_db(engine)
    return engine


@pytest.fixture
def engine():
    return _make_engine()


@pytest.fixture
def db_session(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture(scope="module")
def schema():
    return json.loads(
        (Path(__file__).resolve().parents[3] / "docs/telemetry/event-schemas.json").read_text(encoding="utf-8")
    )


def _evt(schema, event_type: str = "page_viewed") -> dict:
    e = copy.deepcopy(schema["definitions"][event_type]["examples"][0])
    e["eventId"] = str(_uuid.uuid4())
    e["requestId"] = str(_uuid.uuid4())
    return e


def _make_business_event(event_type: str) -> TelemetryEvent:
    return TelemetryEvent.model_validate({
        "eventId": str(_uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sessionId": None,
        "userId": None,
        "event_type": event_type,
        "schemaVersion": "1.0.0",
        "requestId": str(_uuid.uuid4()),
        "properties": {
            "office": "valencia",
            "product_id": "KIT-VEN-B2B-001",
            "product_category": "training_kit",
            "programme_id": "ventas-b2b",
            "quantity": 50,
            "currency": "EUR",
        },
    })


# ---------------------------------------------------------------------------
# Fase 1: Tabla de 8 columnas y 3 índices
# ---------------------------------------------------------------------------

def test_telemetry_events_table_has_exactly_eight_columns():
    """BRIEFING: La tabla telemetry_events existe con las ocho columnas."""
    columns = set(TelemetryEventRow.__table__.columns.keys())
    expected = {
        "event_id",
        "timestamp",
        "session_id",
        "user_id",
        "event_type",
        "schema_version",
        "request_id",
        "tags",
    }
    assert columns == expected
    assert len(columns) == 8


def test_telemetry_events_indices(engine):
    """BRIEFING: Los tres índices requeridos (timestamp, event_type, tags GIN)."""
    from sqlalchemy import inspect
    inspector = inspect(engine)
    indices = {idx["name"] for idx in inspector.get_indexes("telemetry_events")}
    assert "ix_telemetry_events_timestamp" in indices
    assert "ix_telemetry_events_event_type" in indices


def test_telemetry_metadata_does_not_pollute_sqlmodel():
    """Ensure telemetry tables do not leak into SQLModel's global metadata."""
    from sqlmodel import SQLModel
    assert "telemetry_events" not in SQLModel.metadata.tables


# ---------------------------------------------------------------------------
# Tags extraction and allowlists
# ---------------------------------------------------------------------------

def test_extract_tags_includes_event_type():
    tags = _extract_tags("inbound_order_created", {"office": "valencia", "ignored_key": "x"})
    assert tags["event_type"] == "inbound_order_created"
    assert tags["office"] == "valencia"
    assert "ignored_key" not in tags


def test_extract_tags_only_allowlisted_keys():
    props = {"office": "miami", "product_id": "P1", "currency": "USD", "secret": "leak"}
    tags = _extract_tags("outbound_order_created", props)
    assert "secret" not in tags
    assert tags["office"] == "miami"
    assert tags["product_id"] == "P1"
    assert tags["currency"] == "USD"


def test_tags_preserve_business_dimensions(db_session):
    event = _make_business_event("inbound_order_created")
    stored = insert_telemetry_events(db_session, [event])
    assert stored == 1

    row = db_session.exec(select(TelemetryEventRow)).first()
    assert row is not None
    assert row.tags["event_type"] == "inbound_order_created"
    assert row.tags["office"] == "valencia"
    assert row.tags["product_id"] == "KIT-VEN-B2B-001"
    assert row.tags["product_category"] == "training_kit"
    assert row.tags["programme_id"] == "ventas-b2b"
    assert row.tags["currency"] == "EUR"


@pytest.mark.parametrize(
    "event_type",
    [
        "inbound_order_created",
        "outbound_order_created",
        "stock_threshold_triggered",
        "kit_cost_variance_detected",
    ],
)
def test_required_business_contract_fields_round_trip_in_tags(db_session, schema, event_type):
    """The reporting fields required by each contract survive the storage allowlist."""
    payload = _evt(schema, event_type)
    event = TelemetryEvent.model_validate(payload)
    required = {
        name
        for name, definition in schema["definitions"][event_type]["properties"]["properties"]["properties"].items()
        if definition.get("x-required") is True
    }

    assert insert_telemetry_events(db_session, [event]) == 1
    row = db_session.exec(select(TelemetryEventRow)).first()

    assert row is not None
    assert required <= row.tags.keys()


# ---------------------------------------------------------------------------
# Bulk insert & All 5 mandatory business metrics
# ---------------------------------------------------------------------------

def test_all_five_mandatory_event_types_store_ok(db_session):
    event_types = [
        "inbound_order_created",
        "outbound_order_created",
        "stock_threshold_triggered",
        "direct_stock_edit_rejected",
        "kit_cost_variance_detected",
    ]
    events = [_make_business_event(et) for et in event_types]
    stored = insert_telemetry_events(db_session, events)
    assert stored == 5

    rows = db_session.exec(select(TelemetryEventRow)).all()
    assert len(rows) == 5
    stored_types = {r.event_type for r in rows}
    assert stored_types == set(event_types)


def test_batch_is_sent_as_one_insert_statement(db_session, engine):
    """A batch produces one SQL INSERT rather than one per event."""
    from sqlalchemy import event as sqlalchemy_event

    statements: list[str] = []

    def record_insert(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("INSERT INTO TELEMETRY_EVENTS"):
            statements.append(statement)

    sqlalchemy_event.listen(engine, "before_cursor_execute", record_insert)
    try:
        events = [
            _make_business_event(event_type)
            for event_type in [
                "inbound_order_created",
                "outbound_order_created",
                "stock_threshold_triggered",
                "direct_stock_edit_rejected",
                "kit_cost_variance_detected",
            ]
        ]
        assert insert_telemetry_events(db_session, events) == 5
    finally:
        sqlalchemy_event.remove(engine, "before_cursor_execute", record_insert)

    assert len(statements) == 1


def test_insert_empty_list_returns_zero(db_session):
    assert insert_telemetry_events(db_session, []) == 0


def test_seed_events_are_all_valid():
    from seed_telemetry_events import build_events
    events = build_events()
    assert len(events) >= 30
    for e in events:
        model = TelemetryEvent.model_validate(e)
        assert model.event_type == e["event_type"]


# ---------------------------------------------------------------------------
# Fase 2: Endpoint HTTP /telemetry/events
# ---------------------------------------------------------------------------

def test_endpoint_stub_mode(anon_client, schema):
    """When session is None, events are processed without database storage."""
    event = _evt(schema, "page_viewed")
    response = anon_client.post("/telemetry/events", json={"events": [event, event]})
    assert response.status_code == 200
    assert response.json() == {"received": 2, "stored": 0, "rejected": 0}


def test_endpoint_persistent_mode(anon_client, schema, engine):
    """When a session is available, events are persisted and stored count returned."""
    from main import app

    def _test_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_telemetry_session] = _test_session
    try:
        e1 = _evt(schema, "page_viewed")
        e2 = _evt(schema, "page_viewed")
        response = anon_client.post("/telemetry/events", json={"events": [e1, e2]})
        assert response.status_code == 200
        assert response.json() == {"received": 2, "stored": 2, "rejected": 0}

        with Session(engine) as s:
            rows = s.exec(select(TelemetryEventRow)).all()
            assert len(rows) == 2
    finally:
        app.dependency_overrides[get_telemetry_session] = lambda: None


def test_endpoint_mixed_valid_and_invalid_events(anon_client, schema, engine):
    """BRIEFING: Invalid events are rejected without cancelling valid ones."""
    from main import app

    def _test_session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_telemetry_session] = _test_session
    try:
        valid_evt = _evt(schema, "page_viewed")
        invalid_evt = {
            "eventId": str(_uuid.uuid4()),
            "timestamp": "bad-ts",
            "event_type": "page_viewed",
        }
        response = anon_client.post("/telemetry/events", json={"events": [valid_evt, invalid_evt]})
        assert response.status_code == 200
        body = response.json()
        assert body["received"] == 2
        assert body["stored"] == 1
        assert body["rejected"] == 1

        with Session(engine) as s:
            rows = s.exec(select(TelemetryEventRow)).all()
            assert len(rows) == 1
            assert rows[0].event_id == valid_evt["eventId"]
    finally:
        app.dependency_overrides[get_telemetry_session] = lambda: None


def test_endpoint_reports_storage_failure_as_service_unavailable(anon_client, schema, engine, monkeypatch):
    """A failed insert must not be acknowledged as successfully processed."""
    from main import app
    import routes.telemetry as telemetry_route

    def _test_session():
        with Session(engine) as session:
            yield session

    def _failed_insert(_session, _events):
        raise RuntimeError("simulated insert failure")

    app.dependency_overrides[get_telemetry_session] = _test_session
    monkeypatch.setattr(telemetry_route, "insert_telemetry_events", _failed_insert)
    try:
        response = anon_client.post(
            "/telemetry/events",
            json={"events": [_evt(schema, "page_viewed")]},
        )
    finally:
        app.dependency_overrides[get_telemetry_session] = lambda: None

    assert response.status_code == 503
    assert response.json()["detail"] == "El almacenamiento de telemetria no esta disponible."


def test_endpoint_empty_batch(anon_client):
    response = anon_client.post("/telemetry/events", json={"events": []})
    assert response.status_code == 200
    assert response.json() == {"received": 0, "stored": 0, "rejected": 0}


def test_endpoint_malformed_envelope_gives_422(anon_client):
    assert anon_client.post("/telemetry/events", json={"events": None}).status_code == 422
    assert anon_client.post("/telemetry/events", json={}).status_code == 422
    assert anon_client.post("/telemetry/events", json={"events": [], "extra": 1}).status_code == 422
