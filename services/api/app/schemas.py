"""Modelos Pydantic usados para las respuestas JSON y su documentacion Swagger."""
from __future__ import annotations

from typing import Dict, Optional

from pydantic import BaseModel, Field


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


class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Mensaje de error legible para el cliente")
