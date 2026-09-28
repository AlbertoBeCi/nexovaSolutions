"""Fixtures compartidas para los tests de autenticacion (users/profiles/auth)."""
from __future__ import annotations

import pytest

from database import open_db, utc_now_iso
from security import create_access_token, hash_password
from users_db import PROFILES_TABLE, USERS_TABLE


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


def insert_user(users_table, email: str, password: str, role: str = "user", is_active: bool = True) -> int:
    """Inserta un usuario directamente en TinyDB (sin pasar por POST /users)."""
    return users_table.insert(
        {
            "email": email,
            "hashed_password": hash_password(password),
            "is_active": is_active,
            "role": role,
            "created_at": utc_now_iso(),
        }
    )


def auth_header_for(email: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=email)}"}


@pytest.fixture
def user_credentials():
    return {"email": "user@nexova.com", "password": "testpass123"}


@pytest.fixture
def admin_credentials():
    return {"email": "admin@nexova.com", "password": "testpass123"}


@pytest.fixture
def auth_headers(users_table, user_credentials):
    insert_user(users_table, **user_credentials, role="user")
    return auth_header_for(user_credentials["email"])


@pytest.fixture
def admin_headers(users_table, admin_credentials):
    insert_user(users_table, **admin_credentials, role="admin")
    return auth_header_for(admin_credentials["email"])
