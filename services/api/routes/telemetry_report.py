"""Cached, administrator-only technical report for stored telemetry."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session

from inventory_database import get_database_url
from response_cache import TTLResponseCache
from routes.telemetry import get_telemetry_session
from security import get_current_admin
from telemetry_analysis import (
    auth_failure_rate,
    events_per_day,
    latency_by_route,
    request_error_rate,
)

logger = logging.getLogger("telemetry.report")
router = APIRouter(prefix="/telemetry", tags=["telemetry"])
_cache = TTLResponseCache(max_entries=128)
_CACHE_TAG = "telemetry-report"
_CACHE_TTL_SECONDS = 60


class ReportPeriod(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    start: datetime = Field(alias="from")
    end: datetime = Field(alias="to")


class EventsPerDayRow(BaseModel):
    date: str
    event_type: str
    events: int


class RequestErrorRateRow(BaseModel):
    date: str
    route_template: str
    requests: int
    errors: int
    error_rate: float


class LatencyByRouteRow(BaseModel):
    date: str
    route_template: str
    samples: int
    mean_ms: float
    p95_ms: float


class AuthFailureRateRow(BaseModel):
    date: str
    attempts: int
    failures: int
    failure_rate: float


class TelemetryReportMetrics(BaseModel):
    events_per_day: list[EventsPerDayRow]
    request_error_rate: list[RequestErrorRateRow]
    latency_by_route: list[LatencyByRouteRow]
    auth_failure_rate: list[AuthFailureRateRow]


class TelemetryReport(BaseModel):
    period: ReportPeriod
    metrics: TelemetryReportMetrics


def _utc_window(
    start_date: datetime | None,
    end_date: datetime | None,
    *,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Resolve and validate one half-open UTC reporting window."""
    current_time = now or datetime.now(timezone.utc)
    if start_date is not None and start_date.tzinfo is None:
        raise HTTPException(status_code=422, detail="start_date debe incluir zona horaria.")
    if end_date is not None and end_date.tzinfo is None:
        raise HTTPException(status_code=422, detail="end_date debe incluir zona horaria.")
    end = end_date.astimezone(timezone.utc) if end_date is not None else current_time
    start = start_date.astimezone(timezone.utc) if start_date is not None else end - timedelta(days=7)
    if start >= end:
        raise HTTPException(status_code=422, detail="start_date debe ser anterior a end_date.")
    return start, end


def _cache_key(start_date: datetime | None, end_date: datetime | None) -> str:
    start_key = start_date.astimezone(timezone.utc).isoformat() if start_date else "default-start"
    end_key = end_date.astimezone(timezone.utc).isoformat() if end_date else "default-end"
    return f"{start_key}|{end_key}"


def _build_report(session: Session, start: datetime, end: datetime) -> dict[str, Any]:
    return {
        "period": {"from": start, "to": end},
        "metrics": {
            "events_per_day": events_per_day(session, start, end),
            "request_error_rate": request_error_rate(session, start, end),
            "latency_by_route": latency_by_route(session, start, end),
            "auth_failure_rate": auth_failure_rate(session, start, end),
        },
    }


@router.get("/report", response_model=TelemetryReport)
def read_telemetry_report(
    _admin: Annotated[Any, Depends(get_current_admin)],
    session: Session | None = Depends(get_telemetry_session),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
) -> TelemetryReport:
    """Serve a cached technical report for the requested UTC time window."""
    start, end = _utc_window(start_date, end_date)
    if session is None or not get_database_url():
        raise HTTPException(status_code=503, detail="El almacenamiento de telemetria no esta disponible.")

    try:
        result = _cache.get_or_create(
            _cache_key(start_date, end_date),
            tag=_CACHE_TAG,
            ttl_seconds=_CACHE_TTL_SECONDS,
            loader=lambda: _build_report(session, start, end),
        )
    except Exception as exc:
        logger.error("telemetry_report_error error_type=%s", type(exc).__name__)
        raise HTTPException(
            status_code=503,
            detail="El reporte tecnico de telemetria no esta disponible.",
        ) from exc
    return TelemetryReport.model_validate(result)
