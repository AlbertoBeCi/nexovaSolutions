"""Tests de integracion de la API del gestor de incidencias (TestClient).

Usa las fixtures de conftest.py: `client` (TestClient sobre una SQLite
temporal), `valid_payload` (payload de incidencia valido) y `create_incident`
(factory que hace POST /api/incidents y devuelve el recurso creado)."""
from __future__ import annotations

from fastapi.testclient import TestClient

# ─── POST /api/incidents ────────────────────────────────────────────────


def test_create_incident_happy_path_returns_201(client: TestClient, valid_payload: dict):
    response = client.post("/api/incidents", json=valid_payload)

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == valid_payload["title"]
    assert body["status"] == "open"
    assert body["created_at"] == body["updated_at"]
    assert isinstance(body["id"], int)


def test_create_incident_missing_field_returns_400_with_field(
    client: TestClient, valid_payload: dict
):
    payload = {**valid_payload}
    del payload["branch"]

    response = client.post("/api/incidents", json=payload)

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert "branch" in body["error"]["fields"]


def test_create_incident_invalid_category_returns_400(client: TestClient, valid_payload: dict):
    payload = {**valid_payload, "category": "not_a_category"}

    response = client.post("/api/incidents", json=payload)

    assert response.status_code == 400
    assert "category" in response.json()["error"]["fields"]


def test_create_incident_rejects_non_open_status(client: TestClient, valid_payload: dict):
    payload = {**valid_payload, "status": "resolved"}

    response = client.post("/api/incidents", json=payload)

    assert response.status_code == 400
    assert "status" in response.json()["error"]["fields"]


def test_create_incident_with_non_object_body_returns_400(client: TestClient):
    response = client.post("/api/incidents", json=["not", "an", "object"])

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_create_incident_check_constraint_violation_returns_400_not_500(
    client: TestClient, valid_payload: dict, monkeypatch
):
    """Auditoria de manejo de errores: si validate_incident() alguna vez
    dejara pasar un valor que el CHECK constraint de la BD rechaza (hoy
    inalcanzable, ver _commit_or_validation_error en routes/incidents.py),
    la API debe responder 400, no un 500 generico."""
    monkeypatch.setattr("routes.incidents.validate_incident", lambda payload: {})
    payload = {**valid_payload, "category": "no_es_una_categoria_valida"}

    response = client.post("/api/incidents", json=payload)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


# ─── GET /api/incidents ─────────────────────────────────────────────────


def test_list_incidents_empty_db_returns_empty_list(client: TestClient):
    response = client.get("/api/incidents")

    assert response.status_code == 200
    assert response.json() == []


def test_list_incidents_returns_created_records(client: TestClient, create_incident):
    create_incident()
    create_incident(title="Segunda incidencia", branch="miami_office")

    response = client.get("/api/incidents")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_list_incidents_filters_by_branch(client: TestClient, create_incident):
    create_incident(branch="central")
    create_incident(branch="miami_office")

    response = client.get("/api/incidents", params={"branch": "miami_office"})

    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["branch"] == "miami_office"


def test_list_incidents_invalid_filter_value_returns_400(client: TestClient):
    response = client.get("/api/incidents", params={"status": "no_existe"})

    assert response.status_code == 400
    assert "status" in response.json()["error"]["fields"]


# ─── GET /api/incidents/summary ─────────────────────────────────────────


def test_summary_on_empty_db_returns_all_keys_at_zero(client: TestClient):
    response = client.get("/api/incidents/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == {
        "open": 0,
        "in_progress": 0,
        "resolved": 0,
        "discarded": 0,
    }
    assert body["category"]["sla_breach"] == 0
    assert body["origin"] == {"customer": 0, "branch": 0, "internal": 0}
    assert set(body["branch"].keys()) == {
        "central",
        "valencia_operations",
        "miami_office",
        "remote",
    }
    assert all(count == 0 for count in body["branch"].values())


def test_summary_reflects_created_incidents(client: TestClient, create_incident):
    create_incident(branch="central")
    create_incident(branch="miami_office", origin="branch")

    response = client.get("/api/incidents/summary")

    body = response.json()
    assert body["status"]["open"] == 2
    assert body["branch"]["central"] == 1
    assert body["branch"]["miami_office"] == 1
    assert body["origin"]["customer"] == 1
    assert body["origin"]["branch"] == 1


def test_summary_is_registered_before_incident_id_route(client: TestClient):
    # Si /summary no estuviera declarado antes de /{incident_id}, esta
    # peticion fallaria intentando interpretar "summary" como un id.
    response = client.get("/api/incidents/summary")
    assert response.status_code == 200


# ─── GET /api/incidents/{id} ─────────────────────────────────────────────


def test_get_incident_returns_detail(client: TestClient, create_incident):
    created = create_incident()

    response = client.get(f"/api/incidents/{created['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_incident_not_found_returns_404(client: TestClient):
    response = client.get("/api/incidents/999999")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# ─── PATCH /api/incidents/{id}/status ────────────────────────────────────


def test_patch_status_valid_transition_updates_status_and_timestamp(
    client: TestClient, create_incident
):
    created = create_incident()

    response = client.patch(
        f"/api/incidents/{created['id']}/status", json={"status": "in_progress"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "in_progress"
    assert body["updated_at"] != created["updated_at"]
    assert body["created_at"] == created["created_at"]


def test_patch_status_full_lifecycle(client: TestClient, create_incident):
    created = create_incident()
    incident_id = created["id"]

    r1 = client.patch(f"/api/incidents/{incident_id}/status", json={"status": "in_progress"})
    assert r1.status_code == 200

    r2 = client.patch(f"/api/incidents/{incident_id}/status", json={"status": "resolved"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "resolved"


def test_patch_status_same_status_is_invalid(client: TestClient, create_incident):
    created = create_incident()

    response = client.patch(f"/api/incidents/{created['id']}/status", json={"status": "open"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_transition"


def test_patch_status_skip_is_invalid(client: TestClient, create_incident):
    created = create_incident()

    response = client.patch(
        f"/api/incidents/{created['id']}/status", json={"status": "resolved"}
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_transition"


def test_patch_status_leaving_final_state_is_invalid(client: TestClient, create_incident):
    created = create_incident()
    incident_id = created["id"]
    client.patch(f"/api/incidents/{incident_id}/status", json={"status": "in_progress"})
    client.patch(f"/api/incidents/{incident_id}/status", json={"status": "discarded"})

    response = client.patch(f"/api/incidents/{incident_id}/status", json={"status": "open"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_transition"


def test_patch_status_missing_status_returns_400(client: TestClient, create_incident):
    created = create_incident()

    response = client.patch(f"/api/incidents/{created['id']}/status", json={})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_patch_status_unknown_value_returns_400(client: TestClient, create_incident):
    created = create_incident()

    response = client.patch(
        f"/api/incidents/{created['id']}/status", json={"status": "no_existe"}
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_patch_status_not_found_returns_404(client: TestClient):
    response = client.patch("/api/incidents/999999/status", json={"status": "in_progress"})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# ─── Errores 500: nunca filtran detalle interno ──────────────────────────


def test_unexpected_error_returns_generic_500_without_leaking_details(
    client: TestClient, valid_payload: dict, monkeypatch
):
    def _boom(*args, **kwargs):
        raise RuntimeError("detalle interno sensible que no debe llegar al cliente")

    monkeypatch.setattr("routes.incidents.validate_incident", _boom)

    response = client.post("/api/incidents", json=valid_payload)

    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    assert "detalle interno sensible" not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text
