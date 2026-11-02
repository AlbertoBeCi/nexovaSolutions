import json
from datetime import timedelta
from pathlib import Path
import subprocess
from uuid import UUID, uuid4

import pytest

import telemetry_capture
from models import AnalysisSummary
from security import create_access_token


@pytest.fixture
def captured(monkeypatch):
    events = []
    telemetry_capture._seen.clear()
    monkeypatch.setattr("telemetry_capture.receive_events", lambda batch: events.extend(batch.events))
    monkeypatch.setattr("telemetry_core.TELEMETRY_HMAC_KEY_P1", "isolated-capture-test-key")
    return events


def app_headers(**extra):
    return {"X-Nexova-App": "backoffice", "X-Telemetry-Session-ID": str(uuid4()), **extra}


def test_request_id_is_validated_and_echoed(anon_client):
    request_id = str(uuid4())
    assert anon_client.get("/suppliers", headers={"X-Request-ID": request_id}).headers["X-Request-ID"] == request_id
    effective = anon_client.get("/suppliers", headers={"X-Request-ID": "untrusted"}).headers["X-Request-ID"]
    assert str(UUID(effective)) == effective


def test_login_events_are_server_observed_and_do_not_identify_failed_account(anon_client, auth_headers, user_credentials, captured):
    headers = app_headers()
    assert anon_client.post("/auth/login", data={"username": user_credentials["email"], "password": "wrong-password"}, headers=headers).status_code == 401
    assert anon_client.post("/auth/login", data={"username": user_credentials["email"], "password": user_credentials["password"]}, headers=headers).status_code == 200
    assert [e.event_type for e in captured] == ["login_failed", "login_succeeded"]
    failed = captured[0]
    assert failed.user_id is None
    assert failed.properties["reason_code"] == "invalid_credentials"
    assert failed.properties["source"] == "api" and failed.properties["authority"] == "server"
    serialized = json.dumps([e.model_dump(mode="json", by_alias=True) for e in captured])
    assert user_credentials["email"] not in serialized and user_credentials["password"] not in serialized


def test_expiry_requires_verified_signature_and_is_deduplicated(anon_client, auth_headers, users_table, user_credentials, captured):
    doc = users_table.all()[0]
    expired = create_access_token(user_credentials["email"], doc["hashed_password"], expires_delta=timedelta(seconds=-10))
    headers = app_headers(Authorization=f"Bearer {expired}")
    for _ in range(2):
        assert anon_client.get("/auth/me", headers=headers).status_code == 401
    assert [e.event_type for e in captured] == ["session_expired"]
    assert captured[0].properties["reason_code"] == "token_expired"
    assert anon_client.get("/auth/me", headers=app_headers(Authorization="Bearer invalid-signature")).status_code == 401
    assert len(captured) == 1


def test_password_invalidation_is_not_expiry(anon_client, auth_headers, user_credentials, captured):
    obsolete = create_access_token(user_credentials["email"], "obsolete-password-fingerprint")
    assert anon_client.get("/auth/me", headers=app_headers(Authorization=f"Bearer {obsolete}")).status_code == 401
    assert [e.event_type for e in captured] == ["session_invalidated"]
    assert captured[0].properties["reason_code"] == "password_changed"


@pytest.mark.parametrize("field", ["current_stock", "currentStock", "stock"])
def test_direct_stock_edit_requires_known_route_method_and_field(anon_client, captured, field):
    response = anon_client.patch("/inventory/products/123", json={field: 7}, headers=app_headers())
    assert response.status_code == 405
    event = captured[0]
    assert event.event_type == "direct_stock_edit_rejected"
    assert event.properties["attempted_stock"] == 7
    assert event.properties["quantity"] == 0
    assert event.properties["resolution_reason"] == "product_unknown"
    assert event.properties["route_template"] == "/inventory/products/{asset_id}"


@pytest.mark.parametrize("path,body", [
    ("/inventory/products/123", {"metadata": {"stock": 1}}),
    ("/inventory/not-a-route", {"stock": 1}),
    ("/inventory/products/123", {"other": 1}),
    ("/inventory/products/123", {"stock": 1, "padding": "x" * 17000}),
])
def test_direct_stock_edit_does_not_infer_intent_from_status_alone(anon_client, captured, path, body):
    assert anon_client.patch(path, json=body).status_code in {404, 405}
    assert not captured


def test_unauthorized_stock_request_records_access_only(anon_client, captured):
    assert anon_client.post("/inventory/products", json={"stock": 10}).status_code == 401
    assert [e.event_type for e in captured] == ["access_rejected"]
    assert captured[0].properties["reason_code"] == "missing_credentials"


def test_rejected_create_keeps_422_and_verified_actor_without_database_access(user_client, captured):
    from main import app
    from inventory_database import get_inventory_session
    app.dependency_overrides[get_inventory_session] = lambda: None
    try:
        response = user_client.post("/inventory/products", json={"name": "Synthetic kit", "sku": "SYN-1", "office": "Valencia", "category": "training_materials", "stock": 10}, headers=app_headers())
    finally:
        app.dependency_overrides.pop(get_inventory_session, None)
    assert response.status_code == 422
    event = next(e for e in captured if e.event_type == "direct_stock_edit_rejected")
    assert event.user_id.startswith("p1_")
    assert event.properties["resolution_reason"] == "product_unknown"


def test_collector_and_optional_context_do_not_observe_themselves(anon_client, captured):
    assert anon_client.post("/telemetry/events", json={"events": []}).status_code == 200
    assert anon_client.get("/telemetry/context", headers=app_headers()).status_code == 401
    assert not captured


def test_sink_failure_preserves_successful_login(anon_client, auth_headers, user_credentials, monkeypatch):
    def fail(_batch):
        raise RuntimeError("private-error-must-not-escape")
    monkeypatch.setattr("telemetry_capture.receive_events", fail)
    result = anon_client.post("/auth/login", data={"username": user_credentials["email"], "password": user_credentials["password"]}, headers=app_headers())
    assert result.status_code == 200
    assert "private-error" not in result.text


def test_analysis_uses_safe_aggregates(user_client, captured, monkeypatch):
    summary = AnalysisSummary.model_config["json_schema_extra"]["example"]
    monkeypatch.setattr("routes.incidents.analyze_csv", lambda *_: summary)
    response = user_client.post("/api/incidents/analyze", files={"file": ("private-name.csv", b"synthetic", "text/csv")}, headers=app_headers())
    assert response.status_code == 200
    event = next(e for e in captured if e.event_type == "incident_analysis_completed")
    assert event.properties["total_rows"] == summary["total_records"]
    assert event.properties["invalid_rows"] == summary["invalid_records"]
    assert "private-name" not in event.model_dump_json(by_alias=True)


def test_actual_server_events_validate_against_approved_schema(anon_client, auth_headers, users_table, user_credentials, captured):
    headers = app_headers()
    anon_client.post("/auth/login", data={"username": "nobody@example.com", "password": "incorrect"}, headers=headers)
    anon_client.post("/auth/login", data={"username": user_credentials["email"], "password": user_credentials["password"]}, headers=headers)
    expired = create_access_token(user_credentials["email"], users_table.all()[0]["hashed_password"], timedelta(seconds=-10))
    anon_client.get("/auth/me", headers={**headers, "Authorization": f"Bearer {expired}"})
    anon_client.patch("/inventory/products/123", json={"stock": 2}, headers=headers)
    anon_client.post("/inventory/products", json={"stock": 2})
    root = Path(__file__).resolve().parents[3]
    script = "const fs=require('fs');const Ajv=require('./uis/backoffice/node_modules/ajv');const schema=JSON.parse(fs.readFileSync('docs/telemetry/event-schemas.json','utf8'));const validate=new Ajv({allErrors:true}).compile(schema);const events=JSON.parse(fs.readFileSync(0,'utf8'));for(const event of events){if(!validate(event)){console.error(JSON.stringify(validate.errors));process.exit(1);}}"
    result = subprocess.run(["node", "-e", script], input=json.dumps([e.model_dump(mode="json", by_alias=True) for e in captured]), cwd=root, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
