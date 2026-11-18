"""Celery application configuration, Redis broker/backend, and Dead Letter Queue (DLQ).

Implements Ticket #DEV-55:
- Redis as broker (DB 0) and result backend (DB 1).
- Separate worker processes (never run inside FastAPI's event loop).
- Up to 3 attempts (initial + 2 retries) before routing to the Dead Letter Queue (DLQ).
- DLQ records `task_id`, `task_name`, `attempt`, `error_message`, and `failed_at`.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from celery import Celery, Task
from kombu import Queue

logger = logging.getLogger("nexova.celery")

DEFAULT_BROKER_URL = "redis://localhost:6379/0"
DEFAULT_RESULT_BACKEND = "redis://localhost:6379/1"
DLQ_REDIS_LIST_KEY = "nexova:dlq:records"
LAST_INCIDENTS_RESULT_KEY = "nexova:incidents:last_result"
MAX_TASK_ATTEMPTS = 3

# In-memory fallback for isolated unit tests when Redis is not running
_in_memory_dlq: list[dict[str, Any]] = []


def get_broker_url() -> str:
    return os.environ.get("CELERY_BROKER_URL", DEFAULT_BROKER_URL)


def get_result_backend() -> str:
    return os.environ.get("CELERY_RESULT_BACKEND", DEFAULT_RESULT_BACKEND)


celery_app = Celery(
    "nexova_tasks",
    broker=get_broker_url(),
    backend=get_result_backend(),
    include=["tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_default_queue="default",
    task_queues=(
        Queue("default", routing_key="default"),
        Queue("dlq", routing_key="dlq"),
    ),
    broker_connection_retry_on_startup=True,
)


def _get_redis_client():
    """Return a short-timeout Redis client, or None if Redis is unreachable."""
    try:
        import redis

        client = redis.Redis.from_url(
            get_broker_url(),
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        return client
    except Exception:
        return None


def record_dlq_entry(entry: dict[str, Any]) -> None:
    """Persist a failed task entry in the Dead Letter Queue (Redis + in-memory fallback)."""
    _in_memory_dlq.append(entry)
    client = _get_redis_client()
    if client is not None:
        try:
            client.rpush(DLQ_REDIS_LIST_KEY, json.dumps(entry, ensure_ascii=False))
        except Exception as exc:
            logger.warning("dlq_redis_push_failed task_id=%s reason=%s", entry.get("task_id"), exc)


def list_dlq_entries(limit: int = 100) -> list[dict[str, Any]]:
    """Return Dead Letter Queue entries from Redis or in-memory fallback."""
    client = _get_redis_client()
    if client is not None:
        try:
            raw_items = client.lrange(DLQ_REDIS_LIST_KEY, 0, max(0, limit - 1))
            if raw_items:
                return [json.loads(item) for item in raw_items]
        except Exception:
            pass
    return list(_in_memory_dlq[:limit])


def clear_in_memory_dlq() -> None:
    """Clear in-memory DLQ records (used by tests)."""
    _in_memory_dlq.clear()


class DLQTask(Task):
    """Base Celery Task that retries up to 3 attempts and routes exhausted failures to DLQ."""

    abstract = True
    max_retries = MAX_TASK_ATTEMPTS - 1  # 1 initial attempt + 2 retries = 3 attempts total
    default_retry_delay = 1

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        attempt = int(getattr(self.request, "retries", 0)) + 1
        entry = {
            "task_id": str(task_id),
            "task_name": self.name,
            "attempt": attempt,
            "error_message": str(exc),
            "failed_at": datetime.now(timezone.utc).isoformat(),
        }
        logger.error(
            "task_moved_to_dlq task_id=%s task_name=%s attempt=%d error=%s",
            entry["task_id"],
            entry["task_name"],
            entry["attempt"],
            entry["error_message"],
        )
        record_dlq_entry(entry)
        super().on_failure(exc, task_id, args, kwargs, einfo)
