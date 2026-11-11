"""Admin-only transport layer for the business performance pipeline."""
from __future__ import annotations

import logging
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

_SERVICES_ROOT = Path(__file__).resolve().parents[1]
_API_ROOT = _SERVICES_ROOT / "api"
_REPO_ROOT = _SERVICES_ROOT.parent
for _path in (_REPO_ROOT, _SERVICES_ROOT, _API_ROOT):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from data.pipelines.pipeline import (  # noqa: E402
    get_latest_pipeline_run,
    get_weekly_office_program_performance,
    submit_weekly_office_program_performance_flow,
)
from security import get_current_admin  # noqa: E402

logger = logging.getLogger("reporting.api")
router = APIRouter(prefix="/reporting", tags=["reporting"])


class PipelineRunMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    pipeline_name: str
    trigger: Literal["schedule", "manual", "backfill"]
    status: Literal["Running", "Completed", "Failed"]
    started_at: datetime
    finished_at: datetime | None
    requested_by: str | None
    week_start: date
    source_window_end: datetime
    phase: str
    checkpoint: str
    source_watermark: datetime | None = None
    events_read: int = Field(ge=0)
    events_valid: int = Field(ge=0)
    events_duplicate: int = Field(ge=0)
    events_rejected: int = Field(ge=0)
    events_pending: int = Field(ge=0)
    rows_written: int = Field(ge=0)
    input_digest: str | None
    output_digest: str | None
    prefect_flow_run_id: str | None
    error_code: str | None
    error_summary: str | None


class PipelineRunSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    week_start: date
    status: str


class ManualRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    week_start: date | None = None

    @field_validator("week_start")
    @classmethod
    def require_monday(cls, value: date | None) -> date | None:
        if value is not None and value.weekday() != 0:
            raise ValueError("week_start debe ser lunes ISO.")
        return value


class PerformanceEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    office: Literal["valencia", "miami"]
    programme_id: str
    total_material_cost: float
    kits_delivered_count: int = Field(ge=0)
    shortage_events_count: int = Field(ge=0)
    cost_variance_events_count: int = Field(ge=0)
    currency: Literal["EUR", "USD"]


class WeeklyOfficeProgramPerformance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    week_start: date
    entries: list[PerformanceEntry]


def _handle_pipeline_service_error(exc: Exception, detail: str) -> HTTPException:
    logger.error("reporting_pipeline_service_unavailable error_type=%s", type(exc).__name__)
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


@router.get("/pipeline-runs/latest", response_model=PipelineRunMetadata)
def latest_pipeline_run(
    _admin: Annotated[Any, Depends(get_current_admin)],
) -> dict[str, Any]:
    """Return durable metadata for the latest business reporting run."""
    try:
        run = get_latest_pipeline_run()
    except Exception as exc:
        raise _handle_pipeline_service_error(exc, "El estado del pipeline no está disponible.") from exc
    if run is None:
        raise HTTPException(status_code=404, detail="Todavía no hay corridas del pipeline.")
    return run


@router.post(
    "/pipeline-runs",
    response_model=PipelineRunSubmission,
    status_code=status.HTTP_202_ACCEPTED,
)
def submit_manual_pipeline_run(
    current_user: Annotated[Any, Depends(get_current_admin)],
    body: ManualRunRequest | None = None,
) -> dict[str, Any]:
    """Delegate a manual/backfill run to Prefect; ETL stays in data/pipelines."""
    try:
        return submit_weekly_office_program_performance_flow(
            week_start=body.week_start if body else None,
            requested_by=current_user.uuid,
        )
    except Exception as exc:
        raise _handle_pipeline_service_error(
            exc, "Prefect no está disponible para iniciar la corrida."
        ) from exc


@router.get(
    "/weekly-office-program-performance",
    response_model=WeeklyOfficeProgramPerformance,
)
def weekly_office_program_performance(
    _admin: Annotated[Any, Depends(get_current_admin)],
    week_start: Annotated[date | None, Query(description="Lunes ISO de la semana solicitada.")] = None,
) -> dict[str, Any]:
    """Return only the business KPI contract consumed by the dashboard."""
    if week_start is not None and week_start.weekday() != 0:
        raise HTTPException(status_code=422, detail="week_start debe ser lunes ISO.")
    try:
        report = get_weekly_office_program_performance(week_start)
    except Exception as exc:
        raise _handle_pipeline_service_error(exc, "El reporte de desempeño no está disponible.") from exc
    return {
        "week_start": report["week_start"],
        "entries": [
            {
                key: value
                for key, value in row.items()
                if key
                in {
                    "office",
                    "programme_id",
                    "total_material_cost",
                    "kits_delivered_count",
                    "shortage_events_count",
                    "cost_variance_events_count",
                    "currency",
                }
            }
            for row in report["entries"]
        ],
    }
