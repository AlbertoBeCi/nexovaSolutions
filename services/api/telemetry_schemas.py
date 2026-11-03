"""Stable wire envelope for the telemetry collector and persistent storage."""
from datetime import datetime, timezone
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

SCHEMA_VERSION = "1.0.0"
Pseudonym = Annotated[str, Field(pattern=r"^p1_[a-f0-9]{64}$")]


class TelemetryEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", serialize_by_alias=True)

    event_id: UUID = Field(alias="eventId")
    timestamp: AwareDatetime
    session_id: UUID | None = Field(alias="sessionId")
    user_id: Pseudonym | None = Field(alias="userId")
    event_type: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=100)
    schema_version: Literal["1.0.0"] = Field(alias="schemaVersion")
    request_id: UUID = Field(alias="requestId")
    properties: dict[str, Any]

    @field_validator("timestamp", mode="before")
    @classmethod
    def require_iso_timestamp(cls, value: Any) -> Any:
        if not isinstance(value, (str, datetime)):
            raise ValueError("timestamp debe ser una fecha ISO 8601 con zona horaria.")
        return value

    @field_validator("timestamp")
    @classmethod
    def normalize_utc(cls, value: datetime) -> datetime:
        return value.astimezone(timezone.utc)


class TelemetryBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    events: list[TelemetryEvent]


class TelemetryReceipt(BaseModel):
    received: int
    stored: int = 0
    rejected: int = 0
