"""Logica de seguridad sin pasar por HTTP: politica de contrasenas, hashing,
JWT (emision, expiracion, tipo, huella) y get_current_user."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import JWTError, jwt

from config import ALGORITHM, SECRET_KEY
from models import validate_password_strength
from security import (
    create_access_token,
    create_password_reset_token,
    decode_access_token,
    decode_password_reset_token,
    get_current_admin,
    get_current_user,
    ensure_self_or_admin,
    hash_password,
    password_fingerprint,
    verify_password,
)
from tests.conftest import insert_user


# ─── Politica de contrasena ─────────────────────────────────────────────


@pytest.mark.parametrize("password", ["Abcdefg1", "aB3" + "x" * 100, "ñandú1Ab2", "A1b2c3d4"])
def test_strong_passwords_are_accepted(password: str):
    assert validate_password_strength(password) == password


@pytest.mark.parametrize("password,reason", [
    ("Abcde1", "8 caracteres"),
    ("", "8 caracteres"),
    ("abcdefg1", "mayuscula"),
    ("ABCDEFG1", "minuscula"),
    ("Abcdefgh", "numero"),
    ("12345678", "mayuscula"),
])
def test_weak_passwords_are_rejected_with_the_failing_rule(password: str, reason: str):
    with pytest.raises(ValueError, match=reason):
        validate_password_strength(password)


def test_only_ascii_uppercase_letters_count_as_uppercase():
    # Comportamiento actual: la regex es [A-Z], asi que "Ñ" no cuenta.
    with pytest.raises(ValueError, match="mayuscula"):
        validate_password_strength("Ñandú123x")


def test_length_is_checked_before_other_rules():
    with pytest.raises(ValueError, match="8 caracteres"):
        validate_password_strength("a1")


# ─── Hashing y huella ───────────────────────────────────────────────────


def test_hash_is_salted_and_verifiable():
    first, second = hash_password("Secreta123"), hash_password("Secreta123")

    assert first != second
    assert verify_password("Secreta123", first)
    assert verify_password("Secreta123", second)


@pytest.mark.parametrize("attempt", ["secreta123", "Secreta124", "", " Secreta123"])
def test_verify_rejects_any_other_password(attempt: str):
    assert not verify_password(attempt, hash_password("Secreta123"))


def test_fingerprint_is_deterministic_and_depends_on_the_hash():
    assert password_fingerprint("abc") == password_fingerprint("abc")
    assert password_fingerprint("abc") != password_fingerprint("abd")
    assert "abc" not in password_fingerprint("abc")


# ─── JWT ────────────────────────────────────────────────────────────────


def test_access_token_carries_subject_type_and_fingerprint():
    token = create_access_token("a@x.com", "hash")

    payload = decode_access_token(token)

    assert payload["sub"] == "a@x.com"
    assert payload["type"] == "access"
    assert payload["pwd_fp"] == password_fingerprint("hash")


def test_access_token_expires():
    token = create_access_token("a@x.com", "hash", expires_delta=timedelta(seconds=-1))

    with pytest.raises(JWTError):
        decode_access_token(token)


def test_access_token_rejects_tampered_signature():
    token = create_access_token("a@x.com", "hash")
    head, body, signature = token.split(".")
    flipped = ("A" if signature[0] != "A" else "B") + signature[1:]

    with pytest.raises(JWTError):
        decode_access_token(f"{head}.{body}.{flipped}")


def test_access_token_rejects_a_different_secret():
    forged = jwt.encode({"sub": "a@x.com", "type": "access"}, "otra-clave", algorithm=ALGORITHM)

    with pytest.raises(JWTError):
        decode_access_token(forged)


def test_access_token_rejects_alg_none():
    unsigned = jwt.encode({"sub": "a@x.com", "type": "access"}, "", algorithm="HS256")
    head, body, _ = unsigned.split(".")

    with pytest.raises(JWTError):
        decode_access_token(f"{head}.{body}.")


def test_reset_token_roundtrip_and_type_enforcement():
    token = create_password_reset_token("a@x.com", "hash")

    assert decode_password_reset_token(token)["sub"] == "a@x.com"
    with pytest.raises(JWTError):
        decode_password_reset_token(create_access_token("a@x.com", "hash"))


def test_reset_token_without_subject_is_rejected():
    token = jwt.encode(
        {"type": "password_reset", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        SECRET_KEY, algorithm=ALGORITHM,
    )

    with pytest.raises(JWTError):
        decode_password_reset_token(token)


# ─── get_current_user / admin / self ────────────────────────────────────


def _unauthorized(exc: pytest.ExceptionInfo) -> bool:
    return exc.value.status_code == 401


def test_get_current_user_returns_the_matching_active_user(users_table):
    _, hashed = insert_user(users_table, "a@x.com", "Secreta123")

    user = get_current_user(create_access_token("a@x.com", hashed), users_table)

    assert user.email == "a@x.com"
    assert user.role.value == "user"


@pytest.mark.parametrize("token", ["", "basura", "a.b.c"])
def test_get_current_user_rejects_malformed_tokens(users_table, token: str):
    with pytest.raises(HTTPException) as exc:
        get_current_user(token, users_table)

    assert _unauthorized(exc)


def test_get_current_user_rejects_unknown_subject(users_table):
    with pytest.raises(HTTPException) as exc:
        get_current_user(create_access_token("nadie@x.com", "hash"), users_table)

    assert _unauthorized(exc)


def test_get_current_user_rejects_inactive_user(users_table):
    _, hashed = insert_user(users_table, "a@x.com", "Secreta123", is_active=False)

    with pytest.raises(HTTPException) as exc:
        get_current_user(create_access_token("a@x.com", hashed), users_table)

    assert _unauthorized(exc)


def test_get_current_user_rejects_reset_token_as_access(users_table):
    _, hashed = insert_user(users_table, "a@x.com", "Secreta123")

    with pytest.raises(HTTPException) as exc:
        get_current_user(create_password_reset_token("a@x.com", hashed), users_table)

    assert _unauthorized(exc)


def test_get_current_user_rejects_token_issued_before_a_password_change(users_table):
    _, old_hash = insert_user(users_table, "a@x.com", "Secreta123")
    token = create_access_token("a@x.com", old_hash)
    users_table.update({"hashed_password": hash_password("Nueva12345")})

    with pytest.raises(HTTPException) as exc:
        get_current_user(token, users_table)

    assert _unauthorized(exc)


def test_get_current_user_rejects_token_without_subject(users_table):
    token = jwt.encode(
        {"type": "access", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        SECRET_KEY, algorithm=ALGORITHM,
    )

    with pytest.raises(HTTPException) as exc:
        get_current_user(token, users_table)

    assert _unauthorized(exc)


def _user(users_table, email: str, role: str):
    _, hashed = insert_user(users_table, email, "Secreta123", role=role)
    return get_current_user(create_access_token(email, hashed), users_table)


def test_get_current_admin_allows_admin_and_rejects_everyone_else(users_table):
    admin = _user(users_table, "admin@x.com", "admin")
    regular = _user(users_table, "user@x.com", "user")
    manager = _user(users_table, "manager@x.com", "manager")

    assert get_current_admin(admin) is admin
    for other in (regular, manager):
        with pytest.raises(HTTPException) as exc:
            get_current_admin(other)
        assert exc.value.status_code == 403


def test_ensure_self_or_admin(users_table):
    admin = _user(users_table, "admin@x.com", "admin")
    regular = _user(users_table, "user@x.com", "user")

    ensure_self_or_admin(regular, regular.id)
    ensure_self_or_admin(admin, regular.id)
    with pytest.raises(HTTPException) as exc:
        ensure_self_or_admin(regular, admin.id)
    assert exc.value.status_code == 403
