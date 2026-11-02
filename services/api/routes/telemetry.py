"""Temporary verification sink. It deliberately stores no events."""
import logging

from fastapi import APIRouter

from telemetry_schemas import TelemetryBatch, TelemetryReceipt

router = APIRouter(prefix="/telemetry", tags=["telemetry"])
logger = logging.getLogger("telemetry")


def receive_events(batch: TelemetryBatch) -> TelemetryReceipt:
    logger.info(
        "telemetry_batch received=%d event_types=%s",
        len(batch.events),
        ",".join(event.event_type for event in batch.events),
    )
    return TelemetryReceipt(received=len(batch.events))


@router.post("/events", response_model=TelemetryReceipt)
def capture_events(batch: TelemetryBatch) -> TelemetryReceipt:
    return receive_events(batch)
