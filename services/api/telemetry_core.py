"""Shared in-process stub sink and server-only pseudonymization."""
import hashlib
import hmac
import logging
from uuid import UUID

from config import TELEMETRY_HMAC_KEY_P1
from telemetry_schemas import TelemetryBatch, TelemetryReceipt

logger = logging.getLogger("telemetry")


def pseudonymize_user(user_uuid: str) -> str | None:
    if not TELEMETRY_HMAC_KEY_P1:
        return None
    stable_id = str(UUID(user_uuid))
    digest = hmac.new(TELEMETRY_HMAC_KEY_P1.encode(), f"user:{stable_id}".encode(), hashlib.sha256).hexdigest()
    return f"p1_{digest}"


def receive_events(batch: TelemetryBatch) -> TelemetryReceipt:
    logger.info("telemetry_batch received=%d event_types=%s", len(batch.events), ",".join(event.event_type for event in batch.events))
    return TelemetryReceipt(received=len(batch.events))
