"""Reglas de negocio de registro, login, usuarios y perfiles: limites de
validacion, permisos, unicidad de email y anti-enumeracion."""
from __future__ import annotations

import pytest

from tests.conftest import auth_header_for, insert_user

PASSWORD = "Secreta123"


def register(client, email="nuevo@nexova.com", password=PASSWORD, **extra):
    return client.post("/users", json={"email": email, "password": password, **extra})


def login(client, email, password):
    return client.post("/auth/login", data={"username": email, "password": password})


# ─── Registro ───────────────────────────────────────────────────────────


@pytest.mark.parametrize("password,status", [
    ("a" * 7, 422), ("a" * 8, 201), ("a" * 72, 201),
    ("sinmayuscula1", 201), ("12345678", 201),
])
def test_registration_only_enforces_min_length(anon_client, password: str, status: int):
    # Comportamiento actual: el registro solo pide 8+ caracteres; la politica
    # fuerte (mayuscula/minuscula/numero) solo aplica a reset y change.
    assert register(anon_client, password=password).status_code == status


def test_registration_forces_role_user_and_active(anon_client):
    body = register(anon_client).json()

    assert body["role"] == "user"
    assert body["is_active"] is True
    assert "password" not in body and "hashed_password" not in body


@pytest.mark.parametrize("email", ["", "sin-arroba", "a@", "@b.com", "a b@c.com", None])
def test_registration_rejects_invalid_emails(anon_client, email):
    assert register(anon_client, email=email).status_code == 422


def test_registration_rejects_duplicate_email_and_keeps_one_user(anon_client, users_table):
    register(anon_client)

    assert register(anon_client).status_code == 409
    assert len(users_table) == 1


def test_registration_email_uniqueness_is_case_sensitive(anon_client, users_table):
    # Comportamiento actual: "A@x.com" y "a@x.com" se tratan como emails distintos.
    assert register(anon_client, email="Ana@nexova.com").status_code == 201
    assert register(anon_client, email="ana@nexova.com").status_code == 201
    assert len(users_table) == 2


def test_registration_stores_only_a_password_hash(anon_client, users_table):
    register(anon_client)

    stored = users_table.all()[0]
    assert PASSWORD not in str(stored)
    assert stored["hashed_password"].startswith("$2")


@pytest.mark.parametrize("profile,status", [
    ({"name": "Ana"}, 201), ({"name": "A"}, 201),
    ({"name": "Ñandú Pérez 🚀", "phone": "+34 600", "address": "Calle 1"}, 201),
    ({"name": "Ana", "phone": None, "address": None}, 201),
    ({"name": ""}, 422), ({"phone": "123"}, 422), ({"name": "Ana", "extra": 1}, 422),
])
def test_registration_profile_validation(anon_client, profile: dict, status: int):
    assert register(anon_client, profile=profile).status_code == status


def test_failed_registration_creates_neither_user_nor_profile(
    anon_client, users_table, profiles_table
):
    register(anon_client, profile={"name": ""})

    assert len(users_table) == 0
    assert len(profiles_table) == 0


@pytest.mark.parametrize("field", ["role", "is_active", "id", "hashed_password"])
def test_registration_rejects_system_fields(anon_client, field: str):
    assert register(anon_client, **{field: "admin"}).status_code == 422


# ─── Login ──────────────────────────────────────────────────────────────


def test_login_with_registered_credentials_returns_a_usable_token(anon_client):
    register(anon_client)

    token = login(anon_client, "nuevo@nexova.com", PASSWORD).json()["access_token"]

    me = anon_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "nuevo@nexova.com"


@pytest.mark.parametrize("email,password", [
    ("nuevo@nexova.com", "secreta123"), ("NUEVO@nexova.com", PASSWORD),
    ("nadie@nexova.com", PASSWORD),
])
def test_login_failures_share_one_generic_message(anon_client, email: str, password: str):
    register(anon_client)

    response = login(anon_client, email, password)

    assert response.status_code == 401
    assert response.json()["detail"] == "Email o contrasena incorrectos."


def test_login_rejects_inactive_user_with_the_same_message(anon_client, users_table):
    insert_user(users_table, "baja@nexova.com", PASSWORD, is_active=False)

    response = login(anon_client, "baja@nexova.com", PASSWORD)

    assert response.status_code == 401
    assert response.json()["detail"] == "Email o contrasena incorrectos."


def test_login_requires_both_fields(anon_client):
    assert anon_client.post("/auth/login", data={"username": "a@x.com"}).status_code == 422
    assert anon_client.post("/auth/login", data={"password": PASSWORD}).status_code == 422
    # Un campo vacio cuenta como ausente (OAuth2PasswordRequestForm).
    assert login(anon_client, "a@x.com", "").status_code == 422
    assert login(anon_client, "", PASSWORD).status_code == 422


# ─── /auth/me y tokens ──────────────────────────────────────────────────


@pytest.mark.parametrize("header", [
    "Bearer", "Bearer ", "Bearer basura", "Basic abc", "token-sin-esquema", "",
])
def test_me_rejects_bad_authorization_headers(anon_client, header: str):
    assert anon_client.get("/auth/me", headers={"Authorization": header}).status_code == 401


def test_me_fails_after_the_user_is_deleted(anon_client, users_table):
    _, hashed = insert_user(users_table, "a@nexova.com", PASSWORD)
    headers = auth_header_for("a@nexova.com", hashed)
    users_table.truncate()

    assert anon_client.get("/auth/me", headers=headers).status_code == 401


def test_me_fails_for_a_deactivated_user(anon_client, users_table):
    _, hashed = insert_user(users_table, "a@nexova.com", PASSWORD)
    headers = auth_header_for("a@nexova.com", hashed)
    users_table.update({"is_active": False})

    assert anon_client.get("/auth/me", headers=headers).status_code == 401


# ─── Usuarios: permisos ─────────────────────────────────────────────────


def _other_user(users_table):
    user_id, _ = insert_user(users_table, "otro@nexova.com", PASSWORD)
    return user_id


def test_list_users_contains_only_the_expected_accounts(admin_client, users_table):
    _other_user(users_table)

    emails = {u["email"] for u in admin_client.get("/users").json()}

    assert emails == {"admin@nexova.com", "otro@nexova.com"}


def test_list_users_forbidden_for_regular_user_and_anonymous(user_client, anon_client):
    assert user_client.get("/users").status_code == 403
    anon_client.headers.pop("Authorization", None)


def test_admin_gets_404_for_unknown_user(admin_client):
    assert admin_client.get("/users/9999").status_code == 404


def test_non_integer_user_id_is_a_validation_error(admin_client):
    assert admin_client.get("/users/abc").status_code == 422


def test_user_cannot_read_update_or_delete_someone_else(user_client, users_table):
    other_id = _other_user(users_table)

    assert user_client.get(f"/users/{other_id}").status_code == 403
    assert user_client.put(f"/users/{other_id}", json={"email": "x@x.com"}).status_code == 403
    assert user_client.delete(f"/users/{other_id}").status_code == 403
    assert users_table.get(doc_id=other_id)["email"] == "otro@nexova.com"


def test_non_admin_forbidden_check_precedes_existence_check(user_client):
    # Comportamiento actual: un usuario normal recibe 403 (no 404) para un id ajeno inexistente.
    assert user_client.get("/users/9999").status_code == 403


# ─── Usuarios: actualizacion ────────────────────────────────────────────


def test_update_to_an_email_owned_by_another_user_returns_409(admin_client, users_table):
    other_id = _other_user(users_table)

    response = admin_client.put(f"/users/{other_id}", json={"email": "admin@nexova.com"})

    assert response.status_code == 409
    assert users_table.get(doc_id=other_id)["email"] == "otro@nexova.com"


def test_update_to_own_current_email_is_not_a_conflict(user_client, users_table):
    me = users_table.all()[0]

    response = user_client.put(f"/users/{me.doc_id}", json={"email": me["email"]})

    assert response.status_code == 200


def test_update_email_works_and_old_email_is_freed(admin_client, users_table):
    other_id = _other_user(users_table)

    admin_client.put(f"/users/{other_id}", json={"email": "nuevo@nexova.com"})

    assert register(admin_client, email="otro@nexova.com").status_code == 201


@pytest.mark.parametrize("role", ["superadmin", "ADMIN", "", 1])
def test_update_rejects_invalid_roles(admin_client, users_table, role):
    other_id = _other_user(users_table)

    assert admin_client.put(f"/users/{other_id}", json={"role": role}).status_code == 422


def test_update_with_null_role_leaves_the_role_unchanged(admin_client, users_table):
    other_id = _other_user(users_table)

    response = admin_client.put(f"/users/{other_id}", json={"role": None})

    assert response.status_code == 200
    assert response.json()["role"] == "user"


@pytest.mark.parametrize("role", ["admin", "manager", "user"])
def test_admin_can_assign_every_role(admin_client, users_table, role: str):
    other_id = _other_user(users_table)

    response = admin_client.put(f"/users/{other_id}", json={"role": role})

    assert response.status_code == 200
    assert response.json()["role"] == role


def test_update_unknown_user_returns_404(admin_client):
    assert admin_client.put("/users/9999", json={"email": "a@x.com"}).status_code == 404


def test_regular_user_sending_role_is_forbidden_even_with_same_role(user_client, users_table):
    me = users_table.all()[0]

    assert user_client.put(f"/users/{me.doc_id}", json={"role": "user"}).status_code == 403


# ─── Usuarios: borrado ──────────────────────────────────────────────────


def test_delete_unknown_user_returns_404(admin_client):
    assert admin_client.delete("/users/9999").status_code == 404


def test_deleting_a_user_without_profile_works(admin_client, users_table):
    other_id = _other_user(users_table)

    assert admin_client.delete(f"/users/{other_id}").status_code == 204
    assert users_table.get(doc_id=other_id) is None


def test_deleted_user_can_no_longer_log_in_and_email_is_reusable(admin_client, users_table):
    other_id = _other_user(users_table)
    admin_client.delete(f"/users/{other_id}")

    assert login(admin_client, "otro@nexova.com", PASSWORD).status_code == 401
    assert register(admin_client, email="otro@nexova.com").status_code == 201


def test_admin_can_delete_themselves(admin_client, users_table):
    # Comportamiento actual: no hay proteccion contra autoeliminacion del ultimo admin.
    admin = users_table.all()[0]

    assert admin_client.delete(f"/users/{admin.doc_id}").status_code == 204
    assert len(users_table) == 0


# ─── Perfiles ───────────────────────────────────────────────────────────


@pytest.mark.parametrize("body", [
    {"name": "A"}, {"name": "Ana", "phone": None}, {"name": "Ana", "address": None},
    {"name": "Ana", "phone": "+34 600", "address": "Calle 1"},
])
def test_profile_upsert_accepts_valid_bodies(user_client, body: dict):
    response = user_client.put("/profiles/me", json=body)

    assert response.status_code == 200
    assert response.json()["name"] == body["name"]


@pytest.mark.parametrize("body", [
    {"name": ""}, {}, {"name": None}, {"name": "Ana", "role": "admin"},
    {"name": "Ana", "user_id": 5}, {"phone": "123"},
])
def test_profile_upsert_rejects_invalid_bodies(user_client, body: dict):
    assert user_client.put("/profiles/me", json=body).status_code == 422
    assert user_client.get("/profiles/me").status_code == 404


def test_profile_upsert_twice_keeps_a_single_profile(user_client, profiles_table):
    user_client.put("/profiles/me", json={"name": "Ana"})
    user_client.put("/profiles/me", json={"name": "Ana Maria", "phone": "+34 600"})

    assert len(profiles_table) == 1
    assert user_client.get("/profiles/me").json()["name"] == "Ana Maria"


def test_profiles_are_isolated_between_users(user_client, users_table, profiles_table):
    user_client.put("/profiles/me", json={"name": "Ana"})
    _, hashed = insert_user(users_table, "otra@nexova.com", PASSWORD)

    other = user_client.get("/profiles/me", headers=auth_header_for("otra@nexova.com", hashed))

    assert other.status_code == 404


def test_profile_requires_login(anon_client):
    assert anon_client.get("/profiles/me").status_code == 401
    assert anon_client.put("/profiles/me", json={"name": "Ana"}).status_code == 401


# ─── Rutas protegidas: matriz ───────────────────────────────────────────


@pytest.mark.parametrize("method,path", [
    ("get", "/auth/me"), ("get", "/users"), ("get", "/users/1"), ("put", "/users/1"),
    ("delete", "/users/1"), ("get", "/profiles/me"), ("put", "/profiles/me"),
    ("post", "/auth/change-password"), ("post", "/api/incidents/analyze"),
    ("post", "/suppliers"), ("patch", "/suppliers/1/rate"),
    ("patch", "/suppliers/1/status"), ("delete", "/suppliers/1"),
])
def test_protected_routes_reject_anonymous_requests(anon_client, method: str, path: str):
    assert getattr(anon_client, method)(path).status_code == 401


@pytest.mark.parametrize("method,path", [
    ("post", "/users"), ("post", "/auth/login"), ("post", "/auth/forgot-password"),
    ("post", "/auth/reset-password"), ("get", "/suppliers"), ("get", "/suppliers/1"),
    ("get", "/api/incidents/results/export"),
])
def test_public_routes_do_not_demand_a_token(anon_client, method: str, path: str):
    assert getattr(anon_client, method)(path).status_code != 401
