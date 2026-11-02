"""Collector tests use synthetic contracts and the existing isolated fixtures."""
import copy
import json
import logging
from datetime import datetime
from pathlib import Path

import pytest

from telemetry_schemas import SCHEMA_VERSION, TelemetryEvent


def example():
    schema = json.loads((Path(__file__).resolve().parents[3] / "docs/telemetry/event-schemas.json").read_text(encoding="utf-8"))
    return copy.deepcopy(schema["definitions"]["page_viewed"]["examples"][0])


def test_batch_returns_count_without_logging_properties(anon_client, caplog):
    event = example()
    event["properties"]["never_log_this"] = "private-sentinel"
    with caplog.at_level(logging.INFO, logger="telemetry"):
        response = anon_client.post("/telemetry/events", json={"events": [event, event]})
    assert response.status_code == 200
    assert response.json() == {"received": 2}
    assert "page_viewed" in caplog.text
    assert "received=2" in caplog.text
    assert "private-sentinel" not in caplog.text
    assert "never_log_this" not in caplog.text


def test_empty_batch_is_a_successful_noop(anon_client):
    assert anon_client.post("/telemetry/events", json={"events": []}).json() == {"received": 0}


@pytest.mark.parametrize("body", [{}, {"events": None}, {"events": {}}, {"events": [None]}, {"events": [{}]}, {"events": [], "extra": 1}])
def test_invalid_batches_are_rejected(anon_client, body):
    assert anon_client.post("/telemetry/events", json=body).status_code == 422


@pytest.mark.parametrize("field,value", [("eventId", "bad"), ("requestId", "bad"), ("sessionId", "bad"), ("userId", "raw-user-id"), ("schemaVersion", "2.0.0"), ("timestamp", "2026-11-02T12:00:00"), ("timestamp", 123), ("properties", []), ("event_type", "unsafe\nlog")])
def test_envelope_has_stable_types(anon_client, field, value):
    event = example()
    event[field] = value
    assert anon_client.post("/telemetry/events", json={"events": [event]}).status_code == 422


@pytest.mark.parametrize("field", ["eventId", "timestamp", "sessionId", "userId", "event_type", "schemaVersion", "requestId", "properties"])
def test_every_envelope_key_is_required(anon_client, field):
    event = example()
    del event[field]
    assert anon_client.post("/telemetry/events", json={"events": [event]}).status_code == 422


def test_nullable_identity_and_wire_aliases():
    event = example()
    event.update(sessionId=None, userId=None)
    model = TelemetryEvent.model_validate(event)
    wire = model.model_dump(mode="json", by_alias=True)
    assert set(wire) == set(event)
    assert wire["sessionId"] is None and wire["userId"] is None
    assert model.timestamp == datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
    assert event["schemaVersion"] == SCHEMA_VERSION


def test_json_beacon_preflight_accepts_backoffice(anon_client):
    response = anon_client.options("/telemetry/events", headers={"Origin": "http://localhost:3001", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3001"
