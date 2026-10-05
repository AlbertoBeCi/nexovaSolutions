"""POST /api/incidents: caminos felices, limites y errores que
test_api.py no cubre. Los casos marcados "Comportamiento actual" fijan lo que
hace hoy el codigo (aunque sea discutible) para que un cambio futuro sea
deliberado y no accidental."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

REQUIRED_FIELDS = ["title", "description", "category", "origin", "branch"]

# ─── Camino feliz ───────────────────────────────────────────────────────


def test_created_incident_can_be_fetched_with_same_data(
    client: TestClient, create_incident, valid_payload: dict
):
    created = create_incident()

    fetched = client.get(f"/api/incidents/{created['id']}")

    assert fetched.status_code == 200
    assert fetched.json() == created
    for key, value in valid_payload.items():
        assert fetched.json()[key] == value


def test_create_accepts_explicit_open_status(client: TestClient, valid_payload: dict):
    response = client.post("/api/incidents", json={**valid_payload, "status": "open"})

    assert response.status_code == 201
    assert response.json()["status"] == "open"


def test_create_ignores_null_status(client: TestClient, valid_payload: dict):
    response = client.post("/api/incidents", json={**valid_payload, "status": None})

    assert response.status_code == 201
    assert response.json()["status"] == "open"


def test_create_assigns_incremental_ids(create_incident):
    first = create_incident()
    second = create_incident()

    assert second["id"] == first["id"] + 1


@pytest.mark.parametrize("category", [
    "technical_failure", "process_error", "client_complaint", "candidate_issue",
    "staff_issue", "sla_breach", "data_quality", "other",
])
def test_create_accepts_every_category(client: TestClient, valid_payload: dict, category: str):
    response = client.post("/api/incidents", json={**valid_payload, "category": category})

    assert response.status_code == 201
    assert response.json()["category"] == category


@pytest.mark.parametrize("origin", ["customer", "branch", "internal"])
def test_create_accepts_every_origin(client: TestClient, valid_payload: dict, origin: str):
    response = client.post("/api/incidents", json={**valid_payload, "origin": origin})

    assert response.status_code == 201
    assert response.json()["origin"] == origin


@pytest.mark.parametrize("branch", ["central", "valencia_operations", "miami_office", "remote"])
def test_create_accepts_every_branch(client: TestClient, valid_payload: dict, branch: str):
    response = client.post("/api/incidents", json={**valid_payload, "branch": branch})

    assert response.status_code == 201
    assert response.json()["branch"] == branch


# ─── Limites ────────────────────────────────────────────────────────────


def test_create_strips_title_and_description(client: TestClient, valid_payload: dict):
    payload = {**valid_payload, "title": "  Titulo con espacios  ", "description": "\n Texto \t"}

    body = client.post("/api/incidents", json=payload).json()

    assert body["title"] == "Titulo con espacios"
    assert body["description"] == "Texto"


def test_create_accepts_single_character_title_and_description(
    client: TestClient, valid_payload: dict
):
    response = client.post(
        "/api/incidents", json={**valid_payload, "title": "a", "description": "b"}
    )

    assert response.status_code == 201


def test_create_accepts_very_long_text(client: TestClient, valid_payload: dict):
    # Comportamiento actual: no hay limite de longitud en title/description.
    long_text = "x" * 10_000
    payload = {**valid_payload, "title": long_text, "description": long_text}

    response = client.post("/api/incidents", json=payload)

    assert response.status_code == 201
    assert response.json()["title"] == long_text


def test_create_ignores_unknown_keys(client: TestClient, valid_payload: dict):
    # Comportamiento actual: las claves extra se descartan en silencio.
    response = client.post("/api/incidents", json={**valid_payload, "foo": "bar", "id": 999})

    assert response.status_code == 201
    body = response.json()
    assert "foo" not in body
    assert body["id"] != 999


@pytest.mark.parametrize("field,value", [
    ("category", " technical_failure"),
    ("category", "technical_failure "),
    ("origin", "Customer"),
    ("branch", " central"),
    ("branch", "CENTRAL"),
])
def test_create_enum_values_are_exact_match(
    client: TestClient, valid_payload: dict, field: str, value: str
):
    # Comportamiento actual: los enums no se normalizan (ni strip ni mayusculas).
    response = client.post("/api/incidents", json={**valid_payload, field: value})

    assert response.status_code == 400
    assert field in response.json()["error"]["fields"]


# ─── Errores ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("field", REQUIRED_FIELDS)
@pytest.mark.parametrize("value", ["", "   ", None, 123, [], {}, True],
                         ids=["vacio", "espacios", "null", "numero", "lista", "objeto", "bool"])
def test_create_rejects_invalid_required_field_values(
    client: TestClient, valid_payload: dict, field: str, value
):
    response = client.post("/api/incidents", json={**valid_payload, field: value})

    assert response.status_code == 400
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert field in body["fields"]


@pytest.mark.parametrize("field", REQUIRED_FIELDS)
def test_create_rejects_missing_required_field(
    client: TestClient, valid_payload: dict, field: str
):
    payload = {k: v for k, v in valid_payload.items() if k != field}

    response = client.post("/api/incidents", json=payload)

    assert response.status_code == 400
    assert list(response.json()["error"]["fields"]) == [field]


@pytest.mark.parametrize("field,value", [
    ("origin", "not_an_origin"),
    ("branch", "not_a_branch"),
])
def test_create_rejects_invalid_origin_and_branch(
    client: TestClient, valid_payload: dict, field: str, value: str
):
    response = client.post("/api/incidents", json={**valid_payload, field: value})

    assert response.status_code == 400
    assert field in response.json()["error"]["fields"]


def test_create_reports_all_field_errors_at_once(client: TestClient):
    response = client.post("/api/incidents", json={})

    assert response.status_code == 400
    assert set(response.json()["error"]["fields"]) == set(REQUIRED_FIELDS)


def test_create_failed_validation_persists_nothing(client: TestClient, valid_payload: dict):
    client.post("/api/incidents", json={**valid_payload, "category": "nope"})

    assert client.get("/api/incidents").json() == []


@pytest.mark.parametrize("status", ["in_progress", "resolved", "discarded", "OPEN", "", "xyz"])
def test_create_rejects_any_status_other_than_open(
    client: TestClient, valid_payload: dict, status: str
):
    response = client.post("/api/incidents", json={**valid_payload, "status": status})

    assert response.status_code == 400
    assert "status" in response.json()["error"]["fields"]


