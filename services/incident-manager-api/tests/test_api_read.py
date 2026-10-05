"""GET /api/incidents, /summary y /{id}: filtros, orden, conteos y errores de
ruta/consulta que test_api.py no cubre."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models import Incident

# ─── GET /api/incidents ─────────────────────────────────────────────────


@pytest.mark.parametrize("filter_name,value,field_overrides", [
    ("origin", "internal", {"origin": "internal"}),
    ("category", "sla_breach", {"category": "sla_breach"}),
    ("branch", "remote", {"branch": "remote"}),
])
def test_list_filters_by_each_field(
    client: TestClient, create_incident, filter_name: str, value: str, field_overrides: dict
):
    create_incident()  # no coincide con el filtro (valores por defecto del payload)
    expected = create_incident(**field_overrides)

    response = client.get("/api/incidents", params={filter_name: value})

    assert response.status_code == 200
    assert [i["id"] for i in response.json()] == [expected["id"]]


def test_list_filters_by_status_after_transition(client: TestClient, create_incident):
    moved = create_incident()
    create_incident()
    client.patch(f"/api/incidents/{moved['id']}/status", json={"status": "in_progress"})

    in_progress = client.get("/api/incidents", params={"status": "in_progress"}).json()
    still_open = client.get("/api/incidents", params={"status": "open"}).json()

    assert [i["id"] for i in in_progress] == [moved["id"]]
    assert len(still_open) == 1


def test_list_combines_filters_with_and(client: TestClient, create_incident):
    create_incident(branch="central", origin="customer")
    target = create_incident(branch="central", origin="internal")
    create_incident(branch="remote", origin="internal")

    response = client.get("/api/incidents", params={"branch": "central", "origin": "internal"})

    assert [i["id"] for i in response.json()] == [target["id"]]


def test_list_with_no_match_returns_empty_list(client: TestClient, create_incident):
    create_incident(branch="central")

    response = client.get("/api/incidents", params={"branch": "remote"})

    assert response.status_code == 200
    assert response.json() == []


def test_list_orders_by_created_at_descending(
    client: TestClient, db_session: Session, create_incident
):
    ids = [create_incident(title=f"Incidencia {n}")["id"] for n in range(3)]
    base = datetime(2025, 1, 1, tzinfo=timezone.utc)
    # fechas explicitas e invertidas respecto al id para comprobar que el
    # orden sale de created_at y no del id
    for offset, incident_id in enumerate(ids):
        incident = db_session.get(Incident, incident_id)
        incident.created_at = base + timedelta(days=offset)
    db_session.commit()

    response = client.get("/api/incidents")

    assert [i["id"] for i in response.json()] == list(reversed(ids))


def test_list_with_identical_created_at_returns_all_records(
    client: TestClient, db_session: Session, create_incident
):
    # Comportamiento actual: no hay desempate por id; con fechas iguales
    # (como el seed, que deja todo a medianoche) solo se garantiza que salen
    # todos, no en que orden.
    ids = {create_incident(title=f"Incidencia {n}")["id"] for n in range(3)}
    same = datetime(2025, 1, 1, tzinfo=timezone.utc)
    for incident_id in ids:
        db_session.get(Incident, incident_id).created_at = same
    db_session.commit()

    response = client.get("/api/incidents")

    assert {i["id"] for i in response.json()} == ids


@pytest.mark.parametrize("filter_name", ["status", "origin", "branch", "category"])
def test_list_rejects_invalid_value_for_each_filter(client: TestClient, filter_name: str):
    response = client.get("/api/incidents", params={filter_name: "no_existe"})

    assert response.status_code == 400
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert filter_name in body["fields"]


@pytest.mark.parametrize("filter_name", ["status", "origin", "branch", "category"])
def test_list_rejects_empty_filter_value(client: TestClient, filter_name: str):
    # Comportamiento actual: una cadena vacia no se ignora, es un valor invalido.
    response = client.get(f"/api/incidents?{filter_name}=")

    assert response.status_code == 400
    assert filter_name in response.json()["error"]["fields"]


@pytest.mark.parametrize("value", ["OPEN", "Open", " open"])
def test_list_filter_is_case_and_whitespace_sensitive(client: TestClient, value: str):
    response = client.get("/api/incidents", params={"status": value})

    assert response.status_code == 400


def test_list_reports_all_invalid_filters_at_once(client: TestClient):
    response = client.get(
        "/api/incidents", params={"status": "x", "origin": "y", "branch": "z", "category": "w"}
    )

    assert response.status_code == 400
    assert set(response.json()["error"]["fields"]) == {"status", "origin", "branch", "category"}


def test_list_ignores_unknown_query_params(client: TestClient, create_incident):
    # Comportamiento actual: un parametro desconocido no es error ni filtra.
    create_incident()

    response = client.get("/api/incidents", params={"foo": "bar", "limit": "1"})

    assert response.status_code == 200
    assert len(response.json()) == 1


# ─── GET /api/incidents/summary ─────────────────────────────────────────


def test_summary_counts_every_category(client: TestClient, create_incident):
    create_incident(category="technical_failure")
    create_incident(category="technical_failure")
    create_incident(category="sla_breach")

    category = client.get("/api/incidents/summary").json()["category"]

    assert category["technical_failure"] == 2
    assert category["sla_breach"] == 1
    assert category["other"] == 0
    assert set(category) == {
        "technical_failure", "process_error", "client_complaint", "candidate_issue",
        "staff_issue", "sla_breach", "data_quality", "other",
    }


def test_summary_reflects_status_changes(client: TestClient, create_incident):
    to_resolve = create_incident()
    to_discard = create_incident()
    in_progress = create_incident()
    create_incident()
    client.patch(f"/api/incidents/{to_resolve['id']}/status", json={"status": "in_progress"})
    client.patch(f"/api/incidents/{to_resolve['id']}/status", json={"status": "resolved"})
    client.patch(f"/api/incidents/{to_discard['id']}/status", json={"status": "discarded"})
    client.patch(f"/api/incidents/{in_progress['id']}/status", json={"status": "in_progress"})

    status = client.get("/api/incidents/summary").json()["status"]

    assert status == {"open": 1, "in_progress": 1, "resolved": 1, "discarded": 1}


def test_summary_totals_match_incident_count_in_every_dimension(
    client: TestClient, create_incident
):
    create_incident(branch="remote", origin="internal", category="other")
    create_incident(branch="central", origin="branch", category="data_quality")
    create_incident()

    body = client.get("/api/incidents/summary").json()

    for dimension in ("status", "category", "origin", "branch"):
        assert sum(body[dimension].values()) == 3, dimension


# ─── GET /api/incidents/{id} ─────────────────────────────────────────────


def test_get_incident_returns_every_field(client: TestClient, create_incident, valid_payload):
    created = create_incident()

    body = client.get(f"/api/incidents/{created['id']}").json()

    assert body == created
    assert body["status"] == "open"
    assert body["description"] == valid_payload["description"]


@pytest.mark.parametrize("incident_id", [0, -1, 2**31, 2**40])
def test_get_incident_with_unexistent_integer_id_returns_404(
    client: TestClient, incident_id: int
):
    response = client.get(f"/api/incidents/{incident_id}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_get_incident_not_found_message_is_in_spanish(client: TestClient):
    body = client.get("/api/incidents/999999").json()["error"]

    assert body["message"] == "No se encontro la incidencia solicitada."
