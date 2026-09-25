"""Tests de /suppliers y del seeder contra una TinyDB temporal por test."""
from __future__ import annotations

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from database import SUPPLIERS_TABLE, get_suppliers_table, open_db
from main import app
from seed import load_fixtures, seed_suppliers

VALID_SPAIN = {
    "name": "Factorial",
    "country": "Spain",
    "categories": ["software"],
    "monthly_rate": 540.0,
    "currency": "EUR",
    "status": "active",
}
VALID_USA = {
    "name": "Stripe",
    "country": "USA",
    "categories": ["payments", "software"],
    "monthly_rate": 420.0,
    "currency": "USD",
    "status": "suspended",
    "contract_renewal_date": "2027-03-01",
    "contact_email": "billing@stripe.example",
}


@pytest.fixture
def table(tmp_path):
    db = open_db(tmp_path / "suppliers.json")
    yield db.table(SUPPLIERS_TABLE)
    db.close()


@pytest.fixture
def client(table):
    app.dependency_overrides[get_suppliers_table] = lambda: table
    yield TestClient(app)
    app.dependency_overrides.clear()


def create(client: TestClient, payload: dict) -> dict:
    response = client.post("/suppliers", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# ─── POST ─────────────────────────────────────────────────────────────


def test_create_returns_201_with_id_and_updated_at(client):
    body = create(client, VALID_USA)

    assert body["id"] == 1
    assert body["name"] == "Stripe"
    assert body["contract_renewal_date"] == "2027-03-01"
    assert datetime.fromisoformat(body["updated_at"]).tzinfo is not None


def test_create_ignores_client_updated_at(client):
    body = create(client, {**VALID_SPAIN, "updated_at": "2000-01-01T00:00:00Z"})

    assert not body["updated_at"].startswith("2000")


@pytest.mark.parametrize(
    "override",
    [
        {"currency": "USD"},  # Spain debe ir en EUR
        {"monthly_rate": 0},
        {"monthly_rate": -10},
        {"categories": []},
        {"categories": ["catering"]},
        {"contact_email": "no-es-un-email"},
        {"status": "activo"},
        {"country": "France"},
        {"name": ""},
    ],
)
def test_create_rejects_invalid_payload_with_422(client, override):
    response = client.post("/suppliers", json={**VALID_SPAIN, **override})

    assert response.status_code == 422


def test_country_currency_mismatch_message_is_readable(client):
    response = client.post("/suppliers", json={**VALID_USA, "currency": "EUR"})

    assert response.status_code == 422
    assert "USD" in response.json()["detail"][0]["msg"]


# ─── GET ──────────────────────────────────────────────────────────────


def test_list_without_filters_returns_all(client):
    create(client, VALID_SPAIN)
    create(client, VALID_USA)

    response = client.get("/suppliers")

    assert response.status_code == 200
    assert [s["name"] for s in response.json()] == ["Factorial", "Stripe"]


def test_list_filters_by_country_category_and_both(client):
    create(client, VALID_SPAIN)
    create(client, VALID_USA)

    by_country = client.get("/suppliers", params={"country": "USA"}).json()
    by_category = client.get("/suppliers", params={"category": "software"}).json()
    both = client.get("/suppliers", params={"country": "Spain", "category": "payments"}).json()

    assert [s["name"] for s in by_country] == ["Stripe"]
    assert [s["name"] for s in by_category] == ["Factorial", "Stripe"]
    assert both == []


def test_list_rejects_unknown_filter_values(client):
    assert client.get("/suppliers", params={"country": "France"}).status_code == 422
    assert client.get("/suppliers", params={"category": "catering"}).status_code == 422


def test_get_by_id_and_404(client):
    created = create(client, VALID_SPAIN)

    assert client.get(f"/suppliers/{created['id']}").json() == created
    missing = client.get("/suppliers/999")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Proveedor no encontrado."}


# ─── PATCH ────────────────────────────────────────────────────────────


def test_update_rate_refreshes_updated_at(client, monkeypatch):
    created = create(client, VALID_SPAIN)
    monkeypatch.setattr(
        "routes.suppliers.utc_now_iso", lambda: "2030-01-01T00:00:00+00:00"
    )

    response = client.patch(f"/suppliers/{created['id']}/rate", json={"monthly_rate": 600.5})

    assert response.status_code == 200
    body = response.json()
    assert body["monthly_rate"] == 600.5
    assert body["updated_at"].startswith("2030-01-01T00:00:00")


@pytest.mark.parametrize("rate", [0, -1])
def test_update_rate_rejects_non_positive_with_422(client, rate):
    created = create(client, VALID_SPAIN)

    response = client.patch(f"/suppliers/{created['id']}/rate", json={"monthly_rate": rate})

    assert response.status_code == 422


def test_update_status(client):
    created = create(client, VALID_SPAIN)

    response = client.patch(f"/suppliers/{created['id']}/status", json={"status": "suspended"})

    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
    assert client.get(f"/suppliers/{created['id']}").json()["status"] == "suspended"


def test_update_status_rejects_unknown_value(client):
    created = create(client, VALID_SPAIN)

    response = client.patch(f"/suppliers/{created['id']}/status", json={"status": "paused"})

    assert response.status_code == 422


def test_patch_unknown_id_returns_404(client):
    assert client.patch("/suppliers/999/rate", json={"monthly_rate": 10}).status_code == 404
    assert client.patch("/suppliers/999/status", json={"status": "active"}).status_code == 404


# ─── DELETE ───────────────────────────────────────────────────────────


def test_delete_returns_204_then_404(client):
    created = create(client, VALID_SPAIN)

    response = client.delete(f"/suppliers/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/suppliers/{created['id']}").status_code == 404
    assert client.delete(f"/suppliers/{created['id']}").status_code == 404


# ─── Seed ─────────────────────────────────────────────────────────────


def test_seed_is_idempotent(table):
    providers = load_fixtures()

    first = seed_suppliers(table, providers)
    second = seed_suppliers(table, providers)

    assert first == (len(providers), 0)
    assert second == (0, len(providers))
    assert len(table) == len(providers)


def test_seed_skips_names_already_present_ignoring_case(client, table):
    create(client, {**VALID_USA, "name": "  STRIPE "})

    added, already_existed = seed_suppliers(table, load_fixtures())

    assert already_existed == 1
    assert added == len(load_fixtures()) - 1
