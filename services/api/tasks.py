"""Celery background tasks for heavy/long-running operations (Ticket #DEV-55)."""
from __future__ import annotations

import base64
import json
import logging
from datetime import datetime
from time import perf_counter
from typing import Any

from sqlmodel import Session

import store
from analysis import analyze_csv
from celery_app import (
    LAST_INCIDENTS_RESULT_KEY,
    MAX_TASK_ATTEMPTS,
    DLQTask,
    _get_redis_client,
    celery_app,
)
from inventory_database import get_database_url, get_engine
from models import AnalysisSummary
from telemetry_analysis import (
    auth_failure_rate,
    events_per_day,
    latency_by_route,
    request_error_rate,
)
from telemetry_capture import record_analysis

logger = logging.getLogger("nexova.tasks")


def _persist_last_result_shared(summary: dict[str, Any]) -> dict[str, Any]:
    """Store last analysis in process memory and Redis (for multi-container export)."""
    store.set_last_result(summary)
    persisted = store.get_last_result() or summary
    client = _get_redis_client()
    if client is not None:
        try:
            client.set(LAST_INCIDENTS_RESULT_KEY, json.dumps(persisted, ensure_ascii=False))
        except Exception as exc:
            logger.warning("redis_last_result_set_failed reason=%s", exc)
    return persisted


def get_last_result_shared() -> dict[str, Any] | None:
    """Retrieve last analysis from Redis (if available) or local process memory."""
    client = _get_redis_client()
    if client is not None:
        try:
            raw = client.get(LAST_INCIDENTS_RESULT_KEY)
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return store.get_last_result()


def store_upload_payload(upload_id: str, raw_bytes: bytes) -> None:
    """Store raw CSV bytes by reference (Redis or shared /data/uploads) so queue messages stay lightweight."""
    client = _get_redis_client()
    if client is not None:
        try:
            client.setex(f"nexova:uploads:{upload_id}", 3600, base64.b64encode(raw_bytes).decode("ascii"))
            return
        except Exception:
            pass
    _in_memory_uploads[upload_id] = raw_bytes


def load_upload_payload(upload_id: str) -> bytes:
    """Load raw CSV bytes by reference from Redis or local fallback."""
    client = _get_redis_client()
    if client is not None:
        try:
            encoded = client.get(f"nexova:uploads:{upload_id}")
            if encoded:
                return base64.b64decode(encoded.encode("ascii"))
        except Exception:
            pass
    if upload_id in _in_memory_uploads:
        return _in_memory_uploads[upload_id]
    raise FileNotFoundError(f"No se encontro el payload para upload_id={upload_id}")


_in_memory_uploads: dict[str, bytes] = {}


@celery_app.task(
    bind=True,
    base=DLQTask,
    name="tasks.analyze_incidents_csv",
    max_retries=MAX_TASK_ATTEMPTS - 1,
)
def analyze_incidents_csv_task(
    self,
    upload_id: str,
    filename: str,
) -> dict[str, Any]:
    """Analyze a support-tickets CSV batch asynchronously using only its `upload_id` reference."""
    started_at = perf_counter()
    try:
        raw_bytes = load_upload_payload(upload_id)
        summary = analyze_csv(raw_bytes, filename)
        persisted = _persist_last_result_shared(summary)
        record_analysis(persisted, started_at)
        return persisted
    except Exception as exc:
        if self.request.retries < self.max_retries:
            backoff_seconds = 0 if celery_app.conf.task_always_eager else 2 ** (self.request.retries + 1)
            raise self.retry(exc=exc, countdown=backoff_seconds)
        raise


@celery_app.task(
    bind=True,
    base=DLQTask,
    name="tasks.generate_telemetry_report",
    max_retries=MAX_TASK_ATTEMPTS - 1,
)
def generate_telemetry_report_task(
    self,
    start_iso: str,
    end_iso: str,
) -> dict[str, Any]:
    """Generate the Pandas operational telemetry report asynchronously."""
    try:
        if not get_database_url():
            raise RuntimeError("El almacenamiento de telemetria no esta disponible.")
        start = datetime.fromisoformat(start_iso)
        end = datetime.fromisoformat(end_iso)
        with Session(get_engine()) as session:
            return {
                "period": {"from": start.isoformat(), "to": end.isoformat()},
                "metrics": {
                    "events_per_day": events_per_day(session, start, end),
                    "request_error_rate": request_error_rate(session, start, end),
                    "latency_by_route": latency_by_route(session, start, end),
                    "auth_failure_rate": auth_failure_rate(session, start, end),
                },
            }
    except Exception as exc:
        if self.request.retries < self.max_retries:
            backoff_seconds = 0 if celery_app.conf.task_always_eager else 2 ** (self.request.retries + 1)
            raise self.retry(exc=exc, countdown=backoff_seconds)
        raise
