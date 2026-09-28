"""Tests de registro (POST /users), login (POST /auth/login) y GET /auth/me."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app
from users_db import get_profiles_table, get_users_table

VALID_REGISTRATION = {"email": "nuevo@nexova.com", "password": "supersecreto123"}


@pytest.fixture
def client(users_table, profiles_table):
    app.dependency_overrides[get_users_table] = lambda: users_table
    app.dependency_overrides[get_profiles_table] = lambda: profiles_table
    yield TestClient(app)
    app.dependency_overrides.clear()


# ─── POST /users (registro) ────────────────────────────────────────────


def test_register_without_profile_returns_201(client):
    response = client.post("/users", json=VALID_REGISTRATION)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == VALID_REGISTRATION["email"]
    assert body["role"] == "user"
    assert body["is_active"] is True
    assert body["profile"] is None
    assert "password" not in body
    assert "hashed_password" not in body


def test_register_with_profile_creates_linked_profile(client):
    payload = {
        **VALID_REGISTRATION,
        "profile": {"name": "Ana Ruiz", "phone": "+34600000000", "address": "Valencia"},
    }

    response = client.post("/users", json=payload)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["profile"]["name"] == "Ana Ruiz"
    assert body["profile"]["user_id"] == body["id"]


@pytest.mark.parametrize(
    "system_field",
    [{"role": "admin"}, {"id": 99}, {"hashed_password": "x"}, {"created_at": "2000-01-01T00:00:00Z"}, {"is_active": False}],
)
def test_register_rejects_system_assigned_fields_with_422(client, system_field):
    response = client.post("/users", json={**VALID_REGISTRATION, **system_field})

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "extra_forbidden"


def test_register_rejects_duplicate_email_with_409(client):
    client.post("/users", json=VALID_REGISTRATION)

    response = client.post("/users", json=VALID_REGISTRATION)

    assert response.status_code == 409


# ─── POST /auth/login ───────────────────────────────────────────────────


def test_login_returns_bearer_token(client):
    client.post("/users", json=VALID_REGISTRATION)

    response = client.post(
        "/auth/login",
        data={"username": VALID_REGISTRATION["email"], "password": VALID_REGISTRATION["password"]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_rejects_wrong_password_with_401(client):
    client.post("/users", json=VALID_REGISTRATION)

    response = client.post(
        "/auth/login",
        data={"username": VALID_REGISTRATION["email"], "password": "incorrecta"},
    )

    assert response.status_code == 401


def test_login_rejects_unknown_email_with_401(client):
    response = client.post(
        "/auth/login", data={"username": "no-existe@nexova.com", "password": "lo-que-sea"}
    )

    assert response.status_code == 401


# ─── GET /auth/me ───────────────────────────────────────────────────────


def test_me_without_token_returns_401(client):
    assert client.get("/auth/me").status_code == 401


def test_me_with_valid_token_returns_current_user(client):
    client.post("/users", json=VALID_REGISTRATION)
    token = client.post(
        "/auth/login",
        data={"username": VALID_REGISTRATION["email"], "password": VALID_REGISTRATION["password"]},
    ).json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == VALID_REGISTRATION["email"]
