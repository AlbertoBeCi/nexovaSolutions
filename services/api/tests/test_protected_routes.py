"""
Regresion minima de AUTH-01: las rutas existentes que ahora exigen login
(4 de /suppliers + POST /api/incidents/analyze) devuelven 401 sin token y
funcionan con un token valido. No repite la cobertura funcional completa de
esas rutas (ver test_suppliers.py).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from database import SUPPLIERS_TABLE, get_suppliers_table, open_db
from main import app
from users_db import get_profiles_table, get_users_table

VALID_SUPPLIER = {
    "name": "Factorial",
    "country": "Spain",
    "categories": ["software"],
    "monthly_rate": 540.0,
    "currency": "EUR",
    "status": "active",
}

VALID_CSV = (
    b"ticket_id,date,client_company,category,description,agent_id,status,"
    b"customer_email,satisfaction_score\n"
    b"1,2026-01-01,Acme Corp,TECHNICAL,Problema con el login,AGT-01,OPEN,"
    b"user@acme.com,\n"
)


@pytest.fixture
def suppliers_table(tmp_path):
    db = open_db(tmp_path / "suppliers.json")
    yield db.table(SUPPLIERS_TABLE)
    db.close()


@pytest.fixture
def client(suppliers_table, users_table, profiles_table):
    app.dependency_overrides[get_suppliers_table] = lambda: suppliers_table
    app.dependency_overrides[get_users_table] = lambda: users_table
    app.dependency_overrides[get_profiles_table] = lambda: profiles_table
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_mutations_require_login(client):
    created = client.post("/suppliers", json=VALID_SUPPLIER)
    assert created.status_code == 401

    assert client.patch("/suppliers/1/rate", json={"monthly_rate": 10}).status_code == 401
    assert client.patch("/suppliers/1/status", json={"status": "suspended"}).status_code == 401
    assert client.delete("/suppliers/1").status_code == 401

    upload = client.post(
        "/api/incidents/analyze", files={"file": ("tickets.csv", VALID_CSV, "text/csv")}
    )
    assert upload.status_code == 401


def test_mutations_succeed_with_valid_token(client, auth_headers):
    created = client.post("/suppliers", json=VALID_SUPPLIER, headers=auth_headers)
    assert created.status_code == 201, created.text
    supplier_id = created.json()["id"]

    rate = client.patch(
        f"/suppliers/{supplier_id}/rate", json={"monthly_rate": 600.0}, headers=auth_headers
    )
    assert rate.status_code == 200

    status = client.patch(
        f"/suppliers/{supplier_id}/status", json={"status": "suspended"}, headers=auth_headers
    )
    assert status.status_code == 200

    deleted = client.delete(f"/suppliers/{supplier_id}", headers=auth_headers)
    assert deleted.status_code == 204

    upload = client.post(
        "/api/incidents/analyze",
        files={"file": ("tickets.csv", VALID_CSV, "text/csv")},
        headers=auth_headers,
    )
    assert upload.status_code == 200


def test_reads_stay_public(client):
    assert client.get("/suppliers").status_code == 200
    assert client.get("/suppliers/999").status_code == 404
