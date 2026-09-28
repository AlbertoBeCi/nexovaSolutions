"""Tests de /users: CRUD, permisos propio-o-admin y restriccion de `role`."""
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


def register(client: TestClient, email: str, password: str = "testpass123") -> dict:
    response = client.post("/users", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return response.json()


# ─── Sin token ───────────────────────────────────────────────────────────


def test_users_routes_require_login(client):
    other = register(client, "otro@nexova.com")

    assert client.get("/users").status_code == 401
    assert client.get(f"/users/{other['id']}").status_code == 401
    assert client.put(f"/users/{other['id']}", json={"email": "x@y.com"}).status_code == 401
    assert client.delete(f"/users/{other['id']}").status_code == 401


# ─── Propio usuario ────────────────────────────────────────────────────


def test_user_can_read_and_update_own_email(client, auth_headers):
    me = client.get("/auth/me", headers=auth_headers).json()

    response = client.put(
        f"/users/{me['id']}", json={"email": "nuevo-email@nexova.com"}, headers=auth_headers
    )

    assert response.status_code == 200, response.text
    assert response.json()["email"] == "nuevo-email@nexova.com"


def test_user_cannot_change_own_role(client, auth_headers):
    me = client.get("/auth/me", headers=auth_headers).json()

    response = client.put(f"/users/{me['id']}", json={"role": "admin"}, headers=auth_headers)

    assert response.status_code == 403


def test_user_cannot_access_another_users_resource(client, auth_headers):
    other = register(client, "otro@nexova.com")

    assert client.get(f"/users/{other['id']}", headers=auth_headers).status_code == 403
    assert (
        client.put(f"/users/{other['id']}", json={"email": "x@y.com"}, headers=auth_headers).status_code
        == 403
    )
    assert client.delete(f"/users/{other['id']}", headers=auth_headers).status_code == 403


def test_user_can_delete_self_and_linked_profile(client, auth_headers, profiles_table):
    me = client.get("/auth/me", headers=auth_headers).json()
    client.put(
        "/profiles/me", json={"name": "Yo", "phone": None, "address": None}, headers=auth_headers
    )

    response = client.delete(f"/users/{me['id']}", headers=auth_headers)

    assert response.status_code == 204
    assert client.get(f"/users/{me['id']}", headers=auth_headers).status_code == 401  # token ya no resuelve a un usuario activo
    assert len(profiles_table) == 0


# ─── Admin ──────────────────────────────────────────────────────────────


def test_admin_can_list_users(client, admin_headers):
    register(client, "uno@nexova.com")
    register(client, "dos@nexova.com")

    response = client.get("/users", headers=admin_headers)

    assert response.status_code == 200
    emails = {u["email"] for u in response.json()}
    assert {"uno@nexova.com", "dos@nexova.com"} <= emails


def test_non_admin_cannot_list_users(client, auth_headers):
    assert client.get("/users", headers=auth_headers).status_code == 403


def test_admin_can_update_role_and_delete_other_user(client, admin_headers):
    other = register(client, "otro@nexova.com")

    promoted = client.put(
        f"/users/{other['id']}", json={"role": "manager"}, headers=admin_headers
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "manager"

    deleted = client.delete(f"/users/{other['id']}", headers=admin_headers)
    assert deleted.status_code == 204
