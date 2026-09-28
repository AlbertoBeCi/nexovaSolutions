"""Tests de /profiles/me (perfil del usuario autenticado)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app
from users_db import get_profiles_table, get_users_table


@pytest.fixture
def client(users_table, profiles_table):
    app.dependency_overrides[get_users_table] = lambda: users_table
    app.dependency_overrides[get_profiles_table] = lambda: profiles_table
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_profiles_me_requires_login(client):
    assert client.get("/profiles/me").status_code == 401
    assert client.put("/profiles/me", json={"name": "Yo"}).status_code == 401


def test_get_my_profile_without_one_returns_404(client, auth_headers):
    response = client.get("/profiles/me", headers=auth_headers)

    assert response.status_code == 404


def test_put_creates_profile_if_missing(client, auth_headers):
    payload = {"name": "Ana Ruiz", "phone": "+34600000000", "address": "Valencia"}

    response = client.put("/profiles/me", json=payload, headers=auth_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Ana Ruiz"
    assert body["phone"] == "+34600000000"

    fetched = client.get("/profiles/me", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json() == body


def test_put_updates_existing_profile(client, auth_headers):
    client.put("/profiles/me", json={"name": "Ana Ruiz"}, headers=auth_headers)

    response = client.put(
        "/profiles/me", json={"name": "Ana Ruiz Martinez", "phone": "+34611111111"}, headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Ana Ruiz Martinez"
    assert body["phone"] == "+34611111111"

    all_profiles = client.get("/profiles/me", headers=auth_headers).json()
    assert all_profiles["id"] == body["id"]
