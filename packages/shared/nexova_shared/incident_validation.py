"""
Validacion de negocio del gestor de incidencias: campos de una incidencia
y transiciones de estado. UNICA fuente de verdad, consumida por
services/incident-manager-api/ (API) y scripts/seed_incidents.py (seed) para
que las reglas no puedan divergir entre ambos.
"""
from __future__ import annotations

from typing import Mapping, Optional

from nexova_shared.incident_constants import (
    BRANCHES,
    CATEGORIES,
    FINAL_STATUSES,
    ORIGINS,
    STATUSES,
    TRANSITIONS,
)

# Campos obligatorios de toda incidencia (status tiene su propia regla: ver
# validate_incident). Nombre de campo -> etiqueta en espanol usada en los
# mensajes de error.
REQUIRED_FIELD_LABELS: dict[str, str] = {
    "title": "titulo",
    "description": "descripcion",
    "category": "categoria",
    "origin": "origen",
    "branch": "sede",
}


def validate_incident_fields(data: Mapping[str, object]) -> dict[str, str]:
    """Valida title/description/category/origin/branch de una incidencia,
    SIN la regla de "una incidencia nueva solo puede crearse abierta" (esa
    es especifica de la creacion via API, ver validate_incident mas abajo).

    La usan tanto validate_incident() (POST /api/incidents) como
    scripts/seed_incidents.py, que inserta incidencias HISTORICAS con
    cualquier estado (abierta, resuelta o descartada, segun el CSV
    original): la regla de "solo open al crear" no le aplica.

    Devuelve un dict {campo: mensaje} con un mensaje en espanol por cada
    campo invalido o ausente; un dict vacio significa que los datos son
    validos.
    """
    errors: dict[str, str] = {}

    for field, label in REQUIRED_FIELD_LABELS.items():
        value = data.get(field)
        if not isinstance(value, str) or value.strip() == "":
            errors[field] = f"El campo {label} es obligatorio."

    category = data.get("category")
    if isinstance(category, str) and category.strip() != "" and category not in CATEGORIES:
        errors["category"] = "La categoria indicada no es valida."

    origin = data.get("origin")
    if isinstance(origin, str) and origin.strip() != "" and origin not in ORIGINS:
        errors["origin"] = "El origen indicado no es valido."

    branch = data.get("branch")
    if isinstance(branch, str) and branch.strip() != "" and branch not in BRANCHES:
        errors["branch"] = "La sede indicada no es valida."

    return errors


def validate_incident(data: Mapping[str, object]) -> dict[str, str]:
    """Valida el payload de POST /api/incidents (una incidencia NUEVA).

    Ademas de validate_incident_fields(), no valida `status` como
    obligatorio (el modelo lo pone en `open` por defecto), pero si el
    llamador incluye un `status` en el payload de creacion, solo se admite
    `open` (el resto de estados solo se alcanzan via PATCH /status, ver
    is_valid_transition). Esta regla es especifica de la creacion via API:
    scripts/seed_incidents.py usa validate_incident_fields() directamente
    porque inserta incidencias historicas con cualquier estado.
    """
    errors = validate_incident_fields(data)

    if "status" in data and data.get("status") is not None:
        status = data.get("status")
        if status != "open":
            errors["status"] = "Una incidencia nueva solo puede crearse con estado abierta."

    return errors


def validate_status_value(status: object) -> Optional[str]:
    """Valida un valor de status suelto (usado por PATCH /status antes de
    comprobar la transicion). Devuelve un mensaje de error o None si es
    valido."""
    if not isinstance(status, str) or status.strip() == "":
        return "El campo estado es obligatorio."
    if status not in STATUSES:
        return "El estado indicado no es valido."
    return None


def is_valid_transition(from_status: str, to_status: str) -> bool:
    """True si se puede pasar de `from_status` a `to_status`.

    Reglas (ver packages/shared/README.md):
    - open -> in_progress, open -> discarded
    - in_progress -> resolved, in_progress -> discarded
    - resolved y discarded son finales: ninguna transicion saliente.
    - Pasar al mismo estado nunca es una transicion valida (incluido desde
      un estado final).
    """
    if from_status not in TRANSITIONS or to_status not in STATUSES:
        return False
    if from_status == to_status:
        return False
    return to_status in TRANSITIONS[from_status]


def transition_error_message(from_status: str, to_status: str) -> str:
    """Mensaje en espanol para una transicion invalida, usado en el 400 de
    PATCH /api/incidents/{id}/status."""
    if from_status == to_status:
        return f"La incidencia ya esta en estado «{to_status}»."
    if from_status in FINAL_STATUSES:
        return f"La incidencia esta en un estado final («{from_status}») y no admite cambios."
    return f"No se puede pasar de «{from_status}» a «{to_status}»."
