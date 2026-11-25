"""Task status and Dead Letter Queue (DLQ) endpoints (/tasks)."""
from __future__ import annotations

from typing import Any, Literal

from celery.result import AsyncResult
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from celery_app import celery_app, list_dlq_entries
from security import get_current_user

router = APIRouter(prefix="/tasks", tags=["tasks"])

_CELERY_STATE_MAP: dict[str, Literal["pending", "started", "success", "failure"]] = {
    "PENDING": "pending",
    "RECEIVED": "pending",
    "STARTED": "started",
    "RETRY": "started",
    "SUCCESS": "success",
    "FAILURE": "failure",
    "REVOKED": "failure",
}


class TaskAcceptedResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_id: str
    status: Literal["pending", "started", "success", "failure"] = "pending"


class TaskStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_id: str
    status: Literal["pending", "started", "success", "failure"]
    result: Any = None
    error: str | None = None
    dlq: bool = False


class DlqEntry(BaseModel):
    task_id: str
    task_name: str
    attempt: int
    error_message: str
    failed_at: str


@router.get(
    "/dlq",
    response_model=list[DlqEntry],
    summary="Lista las tareas fallidas en la Dead Letter Queue (DLQ)",
    dependencies=[Depends(get_current_user)],
)
def read_dlq(limit: int = 100) -> list[dict[str, Any]]:
    """Return tasks that exhausted their 3 attempts and were routed to the DLQ."""
    return list_dlq_entries(limit=limit)


@router.get(
    "/{task_id}",
    response_model=TaskStatusResponse,
    summary="Consulta el estado y resultado de una tarea asincrona",
    dependencies=[Depends(get_current_user)],
)
def get_task_status(task_id: str) -> TaskStatusResponse:
    """Return the normalized status (`pending`, `started`, `success`, `failure`) and result."""
    async_result = AsyncResult(task_id, app=celery_app)
    raw_state = (async_result.state or "PENDING").upper()
    normalized = _CELERY_STATE_MAP.get(raw_state, "pending")

    if normalized == "success":
        return TaskStatusResponse(
            task_id=task_id,
            status="success",
            result=async_result.result,
            error=None,
            dlq=False,
        )

    if normalized == "failure":
        dlq_ids = {entry.get("task_id") for entry in list_dlq_entries(limit=200)}
        error_text = str(async_result.info) if async_result.info is not None else "Error en la tarea."
        return TaskStatusResponse(
            task_id=task_id,
            status="failure",
            result=None,
            error=error_text,
            dlq=task_id in dlq_ids,
        )

    return TaskStatusResponse(
        task_id=task_id,
        status=normalized,
        result=None,
        error=None,
        dlq=False,
    )
