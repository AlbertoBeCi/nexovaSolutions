"""Fixtures compartidas para los tests de autenticacion (users/profiles/auth)."""
from __future__ import annotations

import pytest

import rate_limit
from database import open_db, utc_now_iso
from security import create_access_token, hash_password
from users_db import PROFILES_TABLE, USERS_TABLE


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Evita que el rate limiting (estado global en memoria) tenga fugas
    entre tests: cada test empieza con el contador en cero."""
    rate_limit._attempts.clear()
    yield
    rate_limit._attempts.clear()


@pytest.fixture(autouse=True)
def _no_real_emails(monkeypatch):
    """Los tests nunca deben mandar un email real via Resend, sin importar
    que RESEND_API_KEY este seteada en el .env local: fuerza el fallback de
    log de routes/auth.py (devolver False == "no se envio")."""
    monkeypatch.setattr("routes.auth.send_password_reset_email", lambda *a, **kw: False)


@pytest.fixture
def users_db(tmp_path):
    db = open_db(tmp_path / "users.json")
    yield db
    db.close()


@pytest.fixture
def users_table(users_db):
    return users_db.table(USERS_TABLE)


@pytest.fixture
def profiles_table(users_db):
    return users_db.table(PROFILES_TABLE)


def insert_user(
    users_table, email: str, password: str, role: str = "user", is_active: bool = True
) -> tuple[int, str]:
    """Inserta un usuario directamente en TinyDB (sin pasar por POST /users).
    Devuelve (id, hashed_password): el hash hace falta para emitir tokens."""
    hashed = hash_password(password)
    user_id = users_table.insert(
        {
            "email": email,
            "hashed_password": hashed,
            "is_active": is_active,
            "role": role,
            "created_at": utc_now_iso(),
        }
    )
    return user_id, hashed


def auth_header_for(email: str, hashed_password: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(email, hashed_password)}"}


@pytest.fixture
def user_credentials():
    return {"email": "user@nexova.com", "password": "testpass123"}


@pytest.fixture
def admin_credentials():
    return {"email": "admin@nexova.com", "password": "testpass123"}


@pytest.fixture
def auth_headers(users_table, user_credentials):
    _, hashed = insert_user(users_table, **user_credentials, role="user")
    return auth_header_for(user_credentials["email"], hashed)


@pytest.fixture
def admin_headers(users_table, admin_credentials):
    _, hashed = insert_user(users_table, **admin_credentials, role="admin")
    return auth_header_for(admin_credentials["email"], hashed)
