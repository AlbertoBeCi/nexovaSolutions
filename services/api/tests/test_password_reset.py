"""
Tests de recuperacion y cambio de password:
- POST /auth/forgot-password
- POST /auth/reset-password
- POST /auth/change-password

Incluye el mecanismo de invalidacion de sesion (pwd_fp): un access token
emitido antes de un reset/change-password deja de servir despues del cambio.
"""
from __future__ import annotations

import logging
import re

import pytest
from fastapi.testclient import TestClient

from main import app
from security import create_access_token
from users_db import get_profiles_table, get_users_table

CREDENTIALS = {"email": "olvidadizo@nexova.com", "password": "TestPass123"}
STRONG_NEW_PASSWORD = "NuevaClave123"


@pytest.fixture
def client(users_table, profiles_table):
    app.dependency_overrides[get_users_table] = lambda: users_table
    app.dependency_overrides[get_profiles_table] = lambda: profiles_table
    yield TestClient(app)
    app.dependency_overrides.clear()


def register(client: TestClient, email: str = CREDENTIALS["email"], password: str = CREDENTIALS["password"]) -> dict:
    r = client.post("/users", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


def login(client: TestClient, email: str = CREDENTIALS["email"], password: str = CREDENTIALS["password"]) -> str:
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def request_reset_token(client: TestClient, caplog: pytest.LogCaptureFixture, email: str = CREDENTIALS["email"]) -> str:
    with caplog.at_level(logging.INFO, logger="auth"):
        response = client.post("/auth/forgot-password", json={"email": email})
    assert response.status_code == 200, response.text
    match = re.search(r"Token: (\S+)", caplog.text)
    assert match, f"no se encontro el token en los logs: {caplog.text!r}"
    return match.group(1)


# ─── POST /auth/forgot-password ─────────────────────────────────────────


def test_forgot_password_unknown_email_returns_generic_message(client):
    response = client.post("/auth/forgot-password", json={"email": "no-existe@nexova.com"})

    assert response.status_code == 200
    assert "instrucciones" in response.json()["detail"]


def test_forgot_password_known_email_logs_a_token(client, caplog):
    register(client)

    token = request_reset_token(client, caplog)

    assert token


def test_forgot_password_never_logs_token_in_production(client, caplog, monkeypatch):
    """Auditoria de manejo de errores: en produccion, el fallback de consola
    de forgot-password no debe dejar un token de reset (reseteable a
    contrasena) en texto plano en los logs del servidor."""
    monkeypatch.setattr("routes.auth.ENVIRONMENT", "production")
    register(client)

    with caplog.at_level(logging.INFO, logger="auth"):
        response = client.post("/auth/forgot-password", json={"email": CREDENTIALS["email"]})

    assert response.status_code == 200
    assert "Token:" not in caplog.text
    assert "no se loguea" in caplog.text


def test_forgot_password_rejects_extra_fields(client):
    response = client.post(
        "/auth/forgot-password", json={"email": CREDENTIALS["email"], "extra": "x"}
    )

    assert response.status_code == 422


def test_forgot_password_same_message_known_and_unknown_email(client):
    register(client)

    known = client.post("/auth/forgot-password", json={"email": CREDENTIALS["email"]})
    unknown = client.post("/auth/forgot-password", json={"email": "no-existe@nexova.com"})

    assert known.json() == unknown.json()


def test_forgot_password_rate_limited_after_5_attempts(client):
    for _ in range(5):
        assert client.post("/auth/forgot-password", json={"email": "x@nexova.com"}).status_code == 200

    response = client.post("/auth/forgot-password", json={"email": "x@nexova.com"})

    assert response.status_code == 429


# ─── POST /auth/reset-password ──────────────────────────────────────────


def test_reset_password_full_flow_changes_password(client, caplog):
    register(client)
    token = request_reset_token(client, caplog)

    response = client.post(
        "/auth/reset-password", json={"token": token, "new_password": STRONG_NEW_PASSWORD}
    )

    assert response.status_code == 200, response.text
    assert client.post(
        "/auth/login", data={"username": CREDENTIALS["email"], "password": CREDENTIALS["password"]}
    ).status_code == 401
    assert client.post(
        "/auth/login", data={"username": CREDENTIALS["email"], "password": STRONG_NEW_PASSWORD}
    ).status_code == 200


def test_reset_password_token_is_single_use(client, caplog):
    register(client)
    token = request_reset_token(client, caplog)
    first = client.post(
        "/auth/reset-password", json={"token": token, "new_password": STRONG_NEW_PASSWORD}
    )
    assert first.status_code == 200

    second = client.post(
        "/auth/reset-password", json={"token": token, "new_password": "OtraClave456"}
    )

    assert second.status_code == 400


def test_reset_password_rejects_garbage_token(client):
    response = client.post(
        "/auth/reset-password", json={"token": "no-es-un-jwt", "new_password": STRONG_NEW_PASSWORD}
    )

    assert response.status_code == 400


def test_reset_password_rejects_access_token_as_reset_token(client):
    user = register(client)
    access_token = login(client)

    response = client.post(
        "/auth/reset-password", json={"token": access_token, "new_password": STRONG_NEW_PASSWORD}
    )

    assert response.status_code == 400
    assert user["email"] == CREDENTIALS["email"]  # sanity: no se toco nada


def test_reset_password_rejects_same_password(client, caplog):
    register(client)
    token = request_reset_token(client, caplog)

    response = client.post(
        "/auth/reset-password", json={"token": token, "new_password": CREDENTIALS["password"]}
    )

    assert response.status_code == 400


@pytest.mark.parametrize(
    "weak_password",
    ["short1A", "sinnumeroaqui", "SINMINUSCULA1", "sinmayuscula1"],
)
def test_reset_password_rejects_weak_new_password(client, caplog, weak_password):
    register(client)
    token = request_reset_token(client, caplog)

    response = client.post(
        "/auth/reset-password", json={"token": token, "new_password": weak_password}
    )

    assert response.status_code == 422


def test_reset_password_invalidates_previously_issued_access_tokens(client, caplog):
    register(client)
    old_token = login(client)
    reset_token = request_reset_token(client, caplog)

    client.post("/auth/reset-password", json={"token": reset_token, "new_password": STRONG_NEW_PASSWORD})

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert response.status_code == 401


def test_reset_password_rate_limited_after_5_attempts(client):
    for _ in range(5):
        r = client.post(
            "/auth/reset-password", json={"token": "invalido", "new_password": STRONG_NEW_PASSWORD}
        )
        assert r.status_code == 400

    response = client.post(
        "/auth/reset-password", json={"token": "invalido", "new_password": STRONG_NEW_PASSWORD}
    )

    assert response.status_code == 429


# ─── POST /auth/change-password ─────────────────────────────────────────


def test_change_password_requires_login(client):
    response = client.post(
        "/auth/change-password",
        json={"current_password": CREDENTIALS["password"], "new_password": STRONG_NEW_PASSWORD},
    )

    assert response.status_code == 401


def test_change_password_success_returns_new_token_and_old_one_stops_working(client):
    register(client)
    old_token = login(client)
    headers = {"Authorization": f"Bearer {old_token}"}

    response = client.post(
        "/auth/change-password",
        json={"current_password": CREDENTIALS["password"], "new_password": STRONG_NEW_PASSWORD},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    new_token = response.json()["access_token"]
    assert new_token != old_token

    assert client.get("/auth/me", headers=headers).status_code == 401
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {new_token}"}).status_code == 200


def test_change_password_rejects_wrong_current_password(client):
    register(client)
    headers = {"Authorization": f"Bearer {login(client)}"}

    response = client.post(
        "/auth/change-password",
        json={"current_password": "esto-esta-mal", "new_password": STRONG_NEW_PASSWORD},
        headers=headers,
    )

    assert response.status_code == 401


def test_change_password_rejects_same_password(client):
    register(client)
    headers = {"Authorization": f"Bearer {login(client)}"}

    response = client.post(
        "/auth/change-password",
        json={"current_password": CREDENTIALS["password"], "new_password": CREDENTIALS["password"]},
        headers=headers,
    )

    assert response.status_code == 400


@pytest.mark.parametrize(
    "weak_password",
    ["short1A", "sinnumeroaqui", "SINMINUSCULA1", "sinmayuscula1"],
)
def test_change_password_rejects_weak_new_password(client, weak_password):
    register(client)
    headers = {"Authorization": f"Bearer {login(client)}"}

    response = client.post(
        "/auth/change-password",
        json={"current_password": CREDENTIALS["password"], "new_password": weak_password},
        headers=headers,
    )

    assert response.status_code == 422
