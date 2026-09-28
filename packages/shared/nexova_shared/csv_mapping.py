"""
Mapeo de una fila del CSV del analizador de tickets de soporte
(incidents_analysis.REQUIRED_COLUMNS) a los campos del modelo Incident del
gestor de incidencias (incident_constants). Lo usa exclusivamente
scripts/seed_incidents.py: es la UNICA fuente de verdad de estas
transformaciones para que el seed no pueda divergir de si mismo entre
ejecuciones ni duplicar esta logica en otro sitio.

Una fila debe pasar primero incidents_analysis.csv_row_violations() (las 7
reglas del analizador); solo entonces se intenta mapear aqui. Este modulo
asume una fila ya valida segun esas reglas, pero igualmente valida lo que
le compete (fecha con formato correcto, status/category mapeables, titulo
no vacio) porque esas comprobaciones no forman parte de las 7 reglas del
analizador.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping

TITLE_MAX_LENGTH = 120

# status del CSV del analizador (OPEN/CLOSED/DISCARDED) -> status del gestor
# de incidencias (incident_constants.STATUSES).
CSV_STATUS_MAP: dict[str, str] = {
    "OPEN": "open",
    "CLOSED": "resolved",
    "DISCARDED": "discarded",
}

# category del CSV del analizador -> category del gestor de incidencias
# (incident_constants.CATEGORIES). TECHNICAL y ACCESS colapsan en la misma
# categoria del gestor; BILLING y HR_QUERY tambien.
CSV_CATEGORY_MAP: dict[str, str] = {
    "TECHNICAL": "technical_failure",
    "BILLING": "process_error",
    "ACCESS": "technical_failure",
    "HR_QUERY": "process_error",
    "COMPLAINT": "client_complaint",
}


class RowMappingError(ValueError):
    """Se lanza cuando una fila no se puede mapear al modelo Incident,
    independientemente de si pasa o no las 7 reglas del analizador."""


@dataclass(frozen=True)
class MappedIncident:
    """Campos ya transformados, listos para insertarse como Incident (mas
    el origin/branch fijos que pide el seed)."""

    title: str
    description: str
    category: str
    status: str
    origin: str
    branch: str
    created_at: datetime
    updated_at: datetime

    def as_dict(self) -> dict[str, object]:
        return {
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "status": self.status,
            "origin": self.origin,
            "branch": self.branch,
        }


def map_csv_row(row: Mapping[str, str]) -> MappedIncident:
    """Transforma una fila del CSV del analizador a los campos del modelo
    Incident del gestor:

    - description -> title: primeros 120 caracteres de description,
      recortados (strip). Si queda vacio, RowMappingError.
    - description -> description: copiado literal.
    - date (YYYY-MM-DD) -> created_at/updated_at: medianoche UTC.
    - origin siempre "customer", branch siempre "central" (el CSV del
      analizador registra tickets de clientes contra la sede central; no
      trae informacion de sede).
    - status: OPEN->open, CLOSED->resolved, DISCARDED->discarded.
    - category: TECHNICAL/ACCESS->technical_failure,
      BILLING/HR_QUERY->process_error, COMPLAINT->client_complaint.

    Lanza RowMappingError con el motivo (en espanol) si la fila no se puede
    mapear.
    """
    description = (row.get("description") or "").strip()
    title = description[:TITLE_MAX_LENGTH].strip()
    if title == "":
        raise RowMappingError("La descripcion esta vacia: no se puede generar un titulo.")

    raw_date = (row.get("date") or "").strip()
    try:
        created_at = datetime.strptime(raw_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise RowMappingError(
            f"Fecha invalida: '{raw_date}' (se esperaba el formato YYYY-MM-DD)."
        ) from exc

    raw_status = (row.get("status") or "").strip()
    status = CSV_STATUS_MAP.get(raw_status)
    if status is None:
        raise RowMappingError(
            f"El estado '{raw_status}' no se puede mapear a un estado del gestor."
        )

    raw_category = (row.get("category") or "").strip()
    category = CSV_CATEGORY_MAP.get(raw_category)
    if category is None:
        raise RowMappingError(
            f"La categoria '{raw_category}' no se puede mapear a una categoria del gestor."
        )

    return MappedIncident(
        title=title,
        description=description,
        category=category,
        status=status,
        origin="customer",
        branch="central",
        created_at=created_at,
        updated_at=created_at,
    )


def ticket_dedupe_key(row: Mapping[str, str], mapped: MappedIncident) -> str:
    """Clave de idempotencia del seed: el `ticket_id` del CSV si existe (y
    no esta vacio), o `title + created_at` en su defecto. Ver
    scripts/seed_incidents.py y la tabla auxiliar seed_ticket_ids."""
    ticket_id = (row.get("ticket_id") or "").strip()
    if ticket_id != "":
        return ticket_id
    return f"{mapped.title}|{mapped.created_at.isoformat()}"
