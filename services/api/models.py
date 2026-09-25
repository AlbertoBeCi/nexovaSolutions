"""
Modelos Pydantic de la API: validacion de entrada, forma de las respuestas
JSON y su documentacion en Swagger.

- Proveedores (/suppliers): ProviderCreate (entrada) separado de
  ProviderResponse (salida), para que el cliente nunca envie `id` ni
  `updated_at`: ambos los asigna el sistema.
- Incidencias (/api/incidents): resumen agregado del analisis de CSV.
"""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


# ─── Proveedores ──────────────────────────────────────────────────────


class ProviderCategory(str, Enum):
    SOFTWARE = "software"
    INFRASTRUCTURE = "infrastructure"
    LOGISTICS = "logistics"
    MARKETING = "marketing"
    PAYMENTS = "payments"
    SECURITY = "security"
    OTHER = "other"


class StatusEnum(str, Enum):
    """Estado del proveedor. La UI lo muestra como 'Activo' / 'Suspendido'."""

    ACTIVE = "active"
    SUSPENDED = "suspended"


class ProviderCreate(BaseModel):
    """Payload de POST /suppliers. No incluye `updated_at`: lo fija el sistema."""

    name: str = Field(
        ...,
        min_length=1,
        description="Nombre comercial del proveedor o plataforma",
    )
    country: Literal["Spain", "USA"] = Field(
        ..., description="Pais del contrato activo"
    )
    # min_length es el equivalente en Pydantic v2 de min_items para listas.
    categories: List[ProviderCategory] = Field(
        ...,
        min_length=1,
        description="Tipo de servicio que provee (minimo 1)",
    )
    monthly_rate: float = Field(
        ...,
        gt=0,
        description="Coste mensual vigente en la moneda del contrato",
    )
    currency: Literal["EUR", "USD"] = Field(
        ..., description="'EUR' para Spain, 'USD' para USA"
    )
    status: StatusEnum = Field(..., description="Estado del proveedor")
    contract_renewal_date: Optional[date] = Field(
        default=None,
        description="Fecha de renovacion del contrato (YYYY-MM-DD)",
    )
    contact_email: Optional[EmailStr] = Field(
        default=None,
        description="Email del account manager del proveedor",
    )
    notes: Optional[str] = Field(default=None, description="Observaciones internas")

    @model_validator(mode="after")
    def validate_country_currency_match(self) -> "ProviderCreate":
        if self.country == "Spain" and self.currency != "EUR":
            raise ValueError("Para contratos en Spain, la moneda debe ser 'EUR'.")
        if self.country == "USA" and self.currency != "USD":
            raise ValueError("Para contratos en USA, la moneda debe ser 'USD'.")
        return self

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "Stripe",
                "country": "USA",
                "categories": ["payments"],
                "monthly_rate": 450.0,
                "currency": "USD",
                "status": "active",
                "contract_renewal_date": "2027-03-01",
                "contact_email": "accounts@stripe.example",
                "notes": "Pasarela de pagos de la sede de Miami",
            }
        }
    }


class ProviderResponse(ProviderCreate):
    id: int = Field(..., description="ID unico asignado por TinyDB")
    updated_at: datetime = Field(
        ...,
        description="Timestamp UTC de la ultima modificacion (alta, tarifa o estado)",
    )


class UpdateRateRequest(BaseModel):
    monthly_rate: float = Field(
        ...,
        gt=0,
        description="Nueva tarifa mensual (debe ser mayor que 0)",
    )


class UpdateStatusRequest(BaseModel):
    status: StatusEnum = Field(
        ...,
        description="Nuevo estado del proveedor ('active' o 'suspended')",
    )


# ─── Incidencias ──────────────────────────────────────────────────────


class InvalidBreakdown(BaseModel):
    missing_company: int = Field(..., description="Registros sin client_company")
    invalid_category: int = Field(
        ..., description="category vacia o fuera de las 5 categorias validas"
    )
    short_description: int = Field(
        ..., description="description vacia o con menos de 5 caracteres"
    )
    invalid_agent_id: int = Field(
        ..., description="agent_id vacio o que no cumple el formato AGT-XX"
    )
    invalid_email: int = Field(..., description="customer_email vacio o sin '@'")
    closed_no_score: int = Field(
        ..., description="Ticket con status=CLOSED sin satisfaction_score"
    )
    score_out_of_range: int = Field(
        ..., description="satisfaction_score presente pero fuera del rango 1-5"
    )


class GroupBreakdown(BaseModel):
    count: int = Field(..., description="Cantidad de registros validos en este grupo")
    percentage: float = Field(
        ..., description="Porcentaje sobre el total de registros validos"
    )


class SatisfactionIndex(BaseModel):
    closed_tickets: int = Field(..., description="Tickets validos con status=CLOSED")
    scored_tickets: int = Field(
        ..., description="De los tickets cerrados, cuantos tienen satisfaction_score"
    )
    average_score: float = Field(
        ..., description="Promedio de satisfaction_score entre los tickets cerrados con puntaje"
    )
    distribution: Dict[str, int] = Field(
        ..., description="Conteo de tickets cerrados por puntuacion (claves '1' a '5')"
    )


class AnalysisSummary(BaseModel):
    source_file: str = Field(..., description="Nombre del archivo CSV analizado")
    analyzed_at: Optional[str] = Field(
        None,
        description="Timestamp ISO 8601 (UTC) de cuando se ejecuto el analisis",
    )
    total_records: int = Field(..., description="Total de filas leidas del CSV")
    valid_records: int = Field(..., description="Filas que no activan ninguna regla de invalidez")
    invalid_records: int = Field(..., description="Filas que activan una o mas reglas de invalidez")
    invalid_breakdown: InvalidBreakdown
    categories: Dict[str, GroupBreakdown] = Field(
        ..., description="Desglose por categoria (solo registros validos)"
    )
    statuses: Dict[str, GroupBreakdown] = Field(
        ..., description="Desglose por estado (solo registros validos)"
    )
    satisfaction: SatisfactionIndex

    model_config = {
        "json_schema_extra": {
            "example": {
                "source_file": "incidents-COMPANY.csv",
                "analyzed_at": "2026-09-21T20:57:00+00:00",
                "total_records": 100,
                "valid_records": 96,
                "invalid_records": 4,
                "invalid_breakdown": {
                    "missing_company": 1,
                    "invalid_category": 1,
                    "short_description": 0,
                    "invalid_agent_id": 0,
                    "invalid_email": 1,
                    "closed_no_score": 1,
                    "score_out_of_range": 0,
                },
                "categories": {
                    "TECHNICAL": {"count": 28, "percentage": 29.2},
                    "BILLING": {"count": 18, "percentage": 18.8},
                    "ACCESS": {"count": 21, "percentage": 21.9},
                    "HR_QUERY": {"count": 17, "percentage": 17.7},
                    "COMPLAINT": {"count": 12, "percentage": 12.5},
                },
                "statuses": {
                    "OPEN": {"count": 27, "percentage": 28.1},
                    "CLOSED": {"count": 56, "percentage": 58.3},
                    "DISCARDED": {"count": 13, "percentage": 13.5},
                },
                "satisfaction": {
                    "closed_tickets": 56,
                    "scored_tickets": 56,
                    "average_score": 3.84,
                    "distribution": {"1": 2, "2": 5, "3": 10, "4": 22, "5": 17},
                },
            }
        }
    }


# ─── Comun ────────────────────────────────────────────────────────────


class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Mensaje de error legible para el cliente")
