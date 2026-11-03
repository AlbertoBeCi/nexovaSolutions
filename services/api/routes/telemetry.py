"""Telemetry collector: stub sink (no DB) and real persistent endpoint.

The real POST /telemetry/events replaces the stub:
- Parses the batch loosely (events: list[Any]) so a malformed individual event
  does not reject the whole batch with a 422.
- Validates each event individually with TelemetryEvent.model_validate().
- Inserts all valid events in a single bulk operation into telemetry_events.
- Returns { "received": N, "stored": M, "rejected": R }.

The frontend TelemetryService only checks the HTTP status code (200), so
this is 100% backwards-compatible.
"""
from __future__ import annotations

import logging
from collections.abc import Generator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session

from inventory_database import get_database_url, get_engine
from security import CurrentUser
from telemetry_core import pseudonymize_user, receive_events
from telemetry_schemas import SCHEMA_VERSION, TelemetryBatch, TelemetryEvent, TelemetryReceipt
from telemetry_storage import insert_telemetry_events

logger = logging.getLogger("telemetry")

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


def get_telemetry_session() -> Generator[Session | None, None, None]:
    """Yield a database session if SUPABASE_DATABASE_URL is set, else None."""
    db_url = get_database_url()
    if not db_url:
        yield None
        return
    with Session(get_engine()) as session:
        yield session


class _LooseBatch(BaseModel):
    """Accept events as raw dicts so we can validate each one individually."""
    model_config = ConfigDict(extra="forbid")
    events: list[Any]


@router.post("/events", response_model=TelemetryReceipt)
def capture_events(
    raw: _LooseBatch,
    session: Session | None = Depends(get_telemetry_session),
) -> TelemetryReceipt:
    """Validate events individually, bulk insert valid ones, return receipt."""
    received = len(raw.events)
    rejected = 0
    valid_events: list[TelemetryEvent] = []

    for item in raw.events:
        try:
            valid_events.append(TelemetryEvent.model_validate(item))
        except Exception as exc:
            event_type = item.get("event_type", "?") if isinstance(item, dict) else "?"
            logger.warning("telemetry_event_rejected event_type=%s reason=%s", event_type, exc)
            rejected += 1

    stored = 0
    if session is not None and valid_events:
        try:
            stored = insert_telemetry_events(session, valid_events)
            logger.info(
                "telemetry_batch_stored received=%d stored=%d rejected=%d",
                received,
                stored,
                rejected,
            )
        except Exception as exc:
            logger.error("telemetry_storage_error error_type=%s", type(exc).__name__)
            raise HTTPException(
                status_code=503,
                detail="El almacenamiento de telemetria no esta disponible.",
            ) from exc

    if session is None and valid_events:
        receive_events(TelemetryBatch(events=valid_events))

    return TelemetryReceipt(received=received, stored=stored, rejected=rejected)


class TelemetryContext(BaseModel):
    model_config = ConfigDict(serialize_by_alias=True)
    user_id: str = Field(alias="userId")
    key_version: str = Field(default="p1", alias="keyVersion")
    schema_version: str = Field(default=SCHEMA_VERSION, alias="schemaVersion")


@router.get("/context", response_model=TelemetryContext)
def read_context(current_user: CurrentUser) -> TelemetryContext:
    user_id = pseudonymize_user(current_user.uuid)
    if user_id is None:
        raise HTTPException(status_code=503, detail="La identidad de telemetria no esta configurada.")
    return TelemetryContext(userId=user_id)
