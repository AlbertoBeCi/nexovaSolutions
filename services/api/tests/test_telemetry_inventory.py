"""Mandatory business capture through real routes, using isolated SQLite only."""
import json
from pathlib import Path
import subprocess
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event
from sqlmodel import Session
from inventory_models import AssetEntry

import telemetry_inventory as capture
from test_inventory import client, inventory_engine, create_asset  # shared isolated fixtures


@pytest.fixture
def scenario(client, tmp_path, monkeypatch):
    asset = create_asset(client)
    path = tmp_path / "metadata.json"
    data = {"version": 1, "provenance": "synthetic_demo", "programmes": ["demo-b2b"],
            "products": [{"product_id": asset["id"], "product_category": "training_kit", "programme_id": "demo-b2b"}],
            "entries": [], "demo_quotes": [{"product_id": asset["id"], "office": "Valencia", "supplier_label": "DEMO TELEMETRIA - PROVEEDOR 01", "supplier_id": "demo-supplier-01", "unit_cost_minor": 1000}]}
    path.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(capture, "TELEMETRY_INVENTORY_METADATA_PATH", str(path))
    monkeypatch.setattr("telemetry_core.TELEMETRY_HMAC_KEY_P1", "isolated-inventory-test-key")
    capture._recent.clear()
    events = []
    monkeypatch.setattr("telemetry_capture.receive_events", lambda batch: events.extend(batch.events))

    def inbound(quantity=2, price=1000, supplier=None):
        data["demo_quotes"][0]["unit_cost_minor"] = price
        path.write_text(json.dumps(data), encoding="utf-8")
        return client.post("/inventory/orders/inbound", json={"asset_id": asset["id"], "quantity": quantity,
                          "office": "Valencia", "supplier": supplier or "DEMO TELEMETRIA - PROVEEDOR 01"})

    def outbound(quantity):
        return client.post("/inventory/orders/outbound", json={"asset_id": asset["id"], "quantity": quantity,
                          "office": "Valencia", "exit_type": "consumption"})

    return asset, data, path, events, inbound, outbound


def test_inbound_is_captured_after_commit_with_exact_cost_and_no_supplier_text(scenario):
    asset, _, _, events, inbound, _ = scenario
    response = inbound(quantity=3, price=1200)
    assert response.status_code == 201
    created = next(e for e in events if e.event_type == "inbound_order_created")
    assert created.properties["order_id"] == response.json()["id"]
    assert created.properties["total_cost_minor"] == 3600
    assert created.properties["currency"] == "EUR"
    assert created.properties["programme_id"] == "demo-b2b"
    assert created.user_id.startswith("p1_")
    assert "PROVEEDOR" not in created.model_dump_json()


def test_stock_threshold_only_fires_on_crossing_and_rearms(scenario):
    _, _, _, events, inbound, outbound = scenario
    assert inbound(quantity=8).status_code == 201
    assert outbound(3).status_code == 201  # 8 -> 5
    assert outbound(1).status_code == 201  # 5 -> 4: no repeated alert
    assert inbound(quantity=2).status_code == 201  # restore 6
    assert outbound(1).status_code == 201  # 6 -> 5
    crossings = [e for e in events if e.event_type == "stock_threshold_triggered"]
    assert len(crossings) == 2
    assert [(e.properties["stock_before"], e.properties["stock_after"]) for e in crossings] == [(8, 5), (6, 5)]
    assert all(e.properties["quantity"] == 5 and e.properties["threshold_version"] == 1 for e in crossings)


@pytest.mark.parametrize("price,expected", [(1100, False), (900, False), (1101, True), (899, True), (1000, False), (0, True)])
def test_variance_uses_strict_exact_ten_percent_and_three_prior_orders(scenario, price, expected):
    _, _, _, events, inbound, _ = scenario
    for _ in range(3):
        assert inbound().status_code == 201
    assert inbound(price=price).status_code == 201
    anomalies = [e for e in events if e.event_type == "kit_cost_variance_detected"]
    assert bool(anomalies) is expected
    if expected:
        p = anomalies[0].properties
        assert p["baseline_order_count"] == 3
        assert p["baseline_total_quantity"] == 6
        assert p["baseline_total_cost_minor"] == 6000
        assert p["variance_percent"] == pytest.approx((price - 1000) / 10)


def test_weighted_baseline_is_not_average_of_unit_prices(scenario):
    _, _, _, events, inbound, _ = scenario
    assert inbound(quantity=1, price=100).status_code == 201
    assert inbound(quantity=1, price=100).status_code == 201
    assert inbound(quantity=8, price=1000).status_code == 201
    assert inbound(price=820).status_code == 201
    assert not [e for e in events if e.event_type == "kit_cost_variance_detected"]


def test_cost_window_excludes_entries_older_than_ninety_days(scenario, inventory_engine):
    _, _, _, events, inbound, _ = scenario
    ids = [inbound().json()["id"] for _ in range(3)]
    with Session(inventory_engine) as session:
        old = session.get(AssetEntry, ids[0])
        old.created_at = datetime.now(timezone.utc) - timedelta(days=91)
        session.add(old)
        session.commit()
    inbound(price=2000)
    assert not [e for e in events if e.event_type == "kit_cost_variance_detected"]
    assert events[-1].properties["reason_code"] == "insufficient_history"


def test_cost_baseline_does_not_mix_suppliers(scenario):
    _, data, _, events, inbound, _ = scenario
    for _ in range(3):
        inbound()
    data["demo_quotes"][0]["supplier_id"] = "demo-supplier-02"
    inbound(price=2000)
    assert not [e for e in events if e.event_type == "kit_cost_variance_detected"]
    assert events[-1].properties["reason_code"] == "insufficient_history"


def test_cost_baseline_does_not_mix_offices_or_currencies(scenario, client):
    asset, data, path, events, inbound, _ = scenario
    data["demo_quotes"].append({**data["demo_quotes"][0], "office": "Miami"})
    path.write_text(json.dumps(data), encoding="utf-8")
    for _ in range(3):
        assert client.post("/inventory/orders/inbound", json={"asset_id": asset["id"], "quantity": 2, "office": "Miami", "supplier": "DEMO TELEMETRIA - PROVEEDOR 01"}).status_code == 201
    inbound(price=2000)
    assert not [e for e in events if e.event_type == "kit_cost_variance_detected"]
    assert events[-1].properties["reason_code"] == "insufficient_history"


@pytest.mark.parametrize("failure", ["missing_product", "unknown_supplier", "invalid_registry"])
def test_missing_or_invalid_metadata_never_fabricates_a_business_event(scenario, failure):
    _, data, path, events, inbound, _ = scenario
    if failure == "missing_product":
        data["products"] = []
    elif failure == "invalid_registry":
        data["programmes"] = []
    response = inbound(supplier="private-unregistered-supplier" if failure == "unknown_supplier" else None)
    assert response.status_code == 201
    assert not [e for e in events if e.event_type == "inbound_order_created"]
    if failure != "invalid_registry":
        assert [e for e in events if e.event_type == "inventory_metadata_missing"]
    assert "private-unregistered" not in json.dumps([e.model_dump(mode="json") for e in events])


def test_missing_historical_cost_does_not_create_false_anomaly(scenario):
    _, _, _, events, inbound, _ = scenario
    for _ in range(3):
        assert inbound().status_code == 201
    capture._recent.clear()  # process restart without durable historical metadata
    assert inbound(price=2000).status_code == 201
    assert not [e for e in events if e.event_type == "kit_cost_variance_detected"]
    assert any(e.properties.get("reason_code") == "metadata_missing" for e in events)


def test_failed_outbound_and_reads_do_not_emit_creation_or_threshold(scenario, client):
    asset, _, _, events, inbound, outbound = scenario
    inbound(quantity=2)
    events.clear()
    assert outbound(3).status_code == 400
    assert client.get(f"/inventory/products/{asset['id']}").status_code == 200
    assert not events


def test_rollback_publishes_nothing(scenario):
    _, _, _, events, inbound, _ = scenario
    def fail(_session):
        raise RuntimeError("isolated-commit-failure")
    event.listen(Session, "before_commit", fail)
    try:
        with pytest.raises(RuntimeError, match="isolated-commit-failure"):
            inbound()
    finally:
        event.remove(Session, "before_commit", fail)
    assert not events


def test_actual_five_mandatory_types_validate_against_approved_contract(scenario, client):
    asset, _, _, events, inbound, outbound = scenario
    for _ in range(3):
        inbound(quantity=2)
    inbound(quantity=2, price=1200)
    outbound(3)
    assert client.patch(f"/inventory/products/{asset['id']}", json={"stock": 100}).status_code == 405
    mandatory = {"inbound_order_created", "outbound_order_created", "stock_threshold_triggered", "direct_stock_edit_rejected", "kit_cost_variance_detected"}
    assert mandatory <= {e.event_type for e in events}
    root = Path(__file__).resolve().parents[3]
    script = "const fs=require('fs');const Ajv=require('./uis/backoffice/node_modules/ajv');const validate=new Ajv({allErrors:true}).compile(JSON.parse(fs.readFileSync('docs/telemetry/event-schemas.json','utf8')));for(const e of JSON.parse(fs.readFileSync(0,'utf8'))){if(!validate(e)){console.error(validate.errors);process.exit(1)}}"
    result = subprocess.run(["node", "-e", script], input=json.dumps([e.model_dump(mode="json", by_alias=True) for e in events]), cwd=root, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
