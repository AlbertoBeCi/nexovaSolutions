"""Temporary verification sink. It deliberately stores no events."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from security import CurrentUser
from telemetry_core import pseudonymize_user, receive_events
from telemetry_schemas import SCHEMA_VERSION, TelemetryBatch, TelemetryReceipt

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.post("/events", response_model=TelemetryReceipt)
def capture_events(batch: TelemetryBatch) -> TelemetryReceipt:
    return receive_events(batch)


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
