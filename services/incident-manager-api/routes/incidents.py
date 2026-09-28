"""
Endpoints del gestor de incidencias, todos bajo /api/incidents.

Usa exclusivamente la validacion de negocio de
nexova_shared.incident_validation: validate_incident() para POST, y
validate_status_value() + is_valid_transition() para el PATCH de estado.
Este archivo no duplica ninguna regla (valores permitidos, transiciones):
solo adapta esas funciones a peticiones/respuestas HTTP.

IMPORTANTE: /summary esta declarado ANTES de /{incident_id} para que FastAPI
no interprete "summary" como un incident_id (ver requisito del prompt).
"""
from __future__ import annotations

from typing import Annotated, Optional

import shared_bootstrap  # noqa: F401  (efecto: agrega packages/shared a sys.path)
from fastapi import APIRouter, Body, Depends, Query
from nexova_shared.incident_constants import BRANCHES, CATEGORIES, ORIGINS, STATUSES
from nexova_shared.incident_validation import (
    is_valid_transition,
    transition_error_message,
    validate_incident,
    validate_status_value,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from db import get_session
from errors import ApiError
from models import Incident
from schemas import IncidentOut, SummaryOut

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

SessionDep = Annotated[Session, Depends(get_session)]

# Valores permitidos de cada filtro/columna agrupable, para validar
# ?status=/?origin=/?branch=/?category= y para rellenar el summary con
# TODAS las claves posibles de cada enum (aunque no tengan registros).
FILTERABLE_FIELDS: dict[str, tuple[str, ...]] = {
    "status": STATUSES,
    "origin": ORIGINS,
    "branch": BRANCHES,
    "category": CATEGORIES,
}


def _validate_filters(filters: dict[str, Optional[str]]) -> None:
    """Valida los filtros opcionales de GET /api/incidents. Un valor fuera
    del enum correspondiente es 400 con el campo senalado."""
    errors: dict[str, str] = {}
    for field, value in filters.items():
        if value is None:
            continue
        if value not in FILTERABLE_FIELDS[field]:
            errors[field] = f"El valor de filtro «{value}» no es valido."
    if errors:
        raise ApiError(
            "validation_error",
            "Alguno de los filtros indicados no es valido.",
            fields=errors,
        )


@router.post(
    "",
    response_model=IncidentOut,
    status_code=201,
    summary="Registra una incidencia nueva",
    responses={400: {"description": "Falta un campo obligatorio o algun valor no es valido."}},
)
def create_incident(session: SessionDep, payload: dict = Body(...)) -> Incident:
    errors = validate_incident(payload)
    if errors:
        raise ApiError(
            "validation_error", "Alguno de los campos no es valido.", fields=errors
        )

    incident = Incident(
        title=payload["title"].strip(),
        description=payload["description"].strip(),
        category=payload["category"],
        origin=payload["origin"],
        branch=payload["branch"],
    )
    session.add(incident)
    session.commit()
    session.refresh(incident)
    return incident


@router.get(
    "",
    response_model=list[IncidentOut],
    summary="Lista incidencias, con filtros opcionales",
    responses={400: {"description": "Algun valor de filtro no es valido."}},
)
def list_incidents(
    session: SessionDep,
    status_filter: Optional[str] = Query(None, alias="status"),
    origin: Optional[str] = None,
    branch: Optional[str] = None,
    category: Optional[str] = None,
) -> list[Incident]:
    _validate_filters(
        {"status": status_filter, "origin": origin, "branch": branch, "category": category}
    )

    statement = select(Incident).order_by(Incident.created_at.desc())
    if status_filter is not None:
        statement = statement.where(Incident.status == status_filter)
    if origin is not None:
        statement = statement.where(Incident.origin == origin)
    if branch is not None:
        statement = statement.where(Incident.branch == branch)
    if category is not None:
        statement = statement.where(Incident.category == category)

    return list(session.scalars(statement))


@router.get(
    "/summary",
    response_model=SummaryOut,
    summary="Totales por estado, categoria, origen y sede",
)
def get_summary(session: SessionDep) -> SummaryOut:
    def counts_by(column) -> dict[str, int]:
        # Arranca todas las claves del enum en 0 (BD vacia -> todo en 0) y
        # las sobreescribe con los conteos reales que haya.
        counts = {value: 0 for value in FILTERABLE_FIELDS[column.key]}
        rows = session.execute(select(column, func.count(Incident.id)).group_by(column)).all()
        for value, count in rows:
            counts[value] = count
        return counts

    return SummaryOut(
        status=counts_by(Incident.status),
        category=counts_by(Incident.category),
        origin=counts_by(Incident.origin),
        branch=counts_by(Incident.branch),
    )


@router.get(
    "/{incident_id}",
    response_model=IncidentOut,
    summary="Detalle de una incidencia",
    responses={404: {"description": "No existe una incidencia con ese id."}},
)
def get_incident(incident_id: int, session: SessionDep) -> Incident:
    incident = session.get(Incident, incident_id)
    if incident is None:
        raise ApiError(
            "not_found", "No se encontro la incidencia solicitada.", status_code=404
        )
    return incident


@router.patch(
    "/{incident_id}/status",
    response_model=IncidentOut,
    summary="Cambia unicamente el estado de una incidencia",
    responses={
        400: {"description": "Falta el estado, no es valido, o la transicion no esta permitida."},
        404: {"description": "No existe una incidencia con ese id."},
    },
)
def update_status(incident_id: int, session: SessionDep, payload: dict = Body(...)) -> Incident:
    incident = session.get(Incident, incident_id)
    if incident is None:
        raise ApiError(
            "not_found", "No se encontro la incidencia solicitada.", status_code=404
        )

    new_status = payload.get("status") if isinstance(payload, dict) else None
    field_error = validate_status_value(new_status)
    if field_error:
        raise ApiError("validation_error", field_error, fields={"status": field_error})

    if not is_valid_transition(incident.status, new_status):
        raise ApiError(
            "invalid_transition", transition_error_message(incident.status, new_status)
        )

    incident.status = new_status
    session.commit()
    session.refresh(incident)
    return incident
