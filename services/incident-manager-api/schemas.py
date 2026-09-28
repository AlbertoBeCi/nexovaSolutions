"""
Modelos Pydantic de salida de la API del gestor de incidencias.

La validacion de negocio del payload de entrada (campos obligatorios,
valores permitidos, transiciones de estado) vive por completo en
nexova_shared.incident_validation, no aqui: routes/incidents.py recibe el
body como `dict` y lo valida a mano con validate_incident()/
validate_status_value(), porque el prompt pide errores por campo en
espanol ({"branch": "..."}) y un Pydantic model con validadores propios
duplicaria esas reglas en dos sitios. Estos modelos solo dan forma al JSON
de SALIDA y a su documentacion en Swagger.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, ConfigDict


class IncidentOut(BaseModel):
    """Forma de una incidencia en las respuestas de la API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    category: str
    status: str
    origin: str
    branch: str
    created_at: datetime
    updated_at: datetime


class SummaryOut(BaseModel):
    """GET /api/incidents/summary: totales por dimension, con TODAS las
    claves de cada enum presentes (a 0 si no hay registros)."""

    status: Dict[str, int]
    category: Dict[str, int]
    origin: Dict[str, int]
    branch: Dict[str, int]


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: Optional[Dict[str, str]] = None


class ErrorBody(BaseModel):
    """Formato uniforme de error de toda la API: {"error": {...}}."""

    error: ErrorDetail
