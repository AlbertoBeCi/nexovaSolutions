"""PATCH /api/incidents/{id}/status: tabla completa de transiciones, forma del
body y orden de las validaciones."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

# Ruta mas corta para llegar a cada estado desde "open".
PATH_TO = {
    "open": [],
    "in_progress": ["in_progress"],
    "resolved": ["in_progress", "resolved"],
    "discarded": ["discarded"],
}
ALL_STATUSES = list(PATH_TO)
VALID = {
    ("open", "in_progress"), ("open", "discarded"),
    ("in_progress", "resolved"), ("in_progress", "discarded"),
}
VALID_TRANSITIONS = sorted(VALID)
INVALID_TRANSITIONS = sorted(
    (a, b) for a in ALL_STATUSES for b in ALL_STATUSES if (a, b) not in VALID
)


def _patch(client: TestClient, incident_id: int, status):
    return client.patch(f"/api/incidents/{incident_id}/status", json={"status": status})


def _incident_in(client: TestClient, create_incident, status: str) -> dict:
    incident = create_incident()
    for step in PATH_TO[status]:
        assert _patch(client, incident["id"], step).status_code == 200
    return client.get(f"/api/incidents/{incident['id']}").json()


@pytest.mark.parametrize("origin,target", VALID_TRANSITIONS)
def test_valid_transitions(client: TestClient, create_incident, origin: str, target: str):
    incident = _incident_in(client, create_incident, origin)

    response = _patch(client, incident["id"], target)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == target
    assert body["created_at"] == incident["created_at"]
    assert body["updated_at"] >= incident["updated_at"]


@pytest.mark.parametrize("origin,target", INVALID_TRANSITIONS)
def test_invalid_transitions_return_400_and_leave_incident_untouched(
    client: TestClient, create_incident, origin: str, target: str
):
    incident = _incident_in(client, create_incident, origin)

    response = _patch(client, incident["id"], target)

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "invalid_transition"
    assert "fields" not in error
    assert client.get(f"/api/incidents/{incident['id']}").json() == incident


def test_transition_to_same_status_message(client: TestClient, create_incident):
    incident = create_incident()

    message = _patch(client, incident["id"], "open").json()["error"]["message"]

    assert message == "La incidencia ya esta en estado «open»."


@pytest.mark.parametrize("final", ["resolved", "discarded"])
def test_leaving_a_final_status_message(client: TestClient, create_incident, final: str):
    incident = _incident_in(client, create_incident, final)

    message = _patch(client, incident["id"], "open").json()["error"]["message"]

    assert message == f"La incidencia esta en un estado final («{final}») y no admite cambios."


def test_skipping_a_step_message(client: TestClient, create_incident):
    incident = create_incident()

    message = _patch(client, incident["id"], "resolved").json()["error"]["message"]

    assert message == "No se puede pasar de «open» a «resolved»."


@pytest.mark.parametrize("value", ["", "   ", None, 123, [], {}, True, "no_existe", "OPEN"],
                         ids=["vacio", "espacios", "null", "numero", "lista", "objeto",
                              "bool", "desconocido", "mayusculas"])
def test_invalid_status_values_return_validation_error(
    client: TestClient, create_incident, value
):
    incident = create_incident()

    response = _patch(client, incident["id"], value)

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "status" in error["fields"]


def test_missing_status_key_returns_validation_error(client: TestClient, create_incident):
    incident = create_incident()

    response = client.patch(f"/api/incidents/{incident['id']}/status", json={})

    assert response.status_code == 400
    assert "status" in response.json()["error"]["fields"]


def test_extra_keys_in_body_are_ignored(client: TestClient, create_incident):
    # Comportamiento actual: solo se lee "status"; el resto se descarta.
    incident = create_incident()

    response = client.patch(
        f"/api/incidents/{incident['id']}/status",
        json={"status": "in_progress", "title": "Hackeado", "id": 999},
    )

    assert response.status_code == 200
    assert response.json()["title"] == incident["title"]
    assert response.json()["id"] == incident["id"]


def test_unknown_id_returns_404(client: TestClient):
    response = _patch(client, 999999, "in_progress")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_not_found_takes_precedence_over_invalid_body(client: TestClient):
    # Se busca la incidencia antes de validar el body.
    response = client.patch("/api/incidents/999999/status", json={"status": "no_existe"})

    assert response.status_code == 404


def test_full_lifecycle_open_to_resolved_is_visible_in_list_and_summary(
    client: TestClient, create_incident
):
    incident = create_incident()
    _patch(client, incident["id"], "in_progress")
    _patch(client, incident["id"], "resolved")

    listed = client.get("/api/incidents", params={"status": "resolved"}).json()
    summary = client.get("/api/incidents/summary").json()["status"]

    assert [i["id"] for i in listed] == [incident["id"]]
    assert summary["resolved"] == 1
    assert summary["open"] == 0
