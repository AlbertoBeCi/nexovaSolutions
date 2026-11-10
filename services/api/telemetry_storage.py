"""SQLModel table and bulk-insert logic for telemetry event persistence.

Design rules (BRIEFING):
- Table `telemetry_events` has exactly 8 columns:
  event_id (PK), timestamp, session_id, user_id, event_type, schema_version,
  request_id, tags (JSONB).
- 3 indices: timestamp, event_type, and GIN on tags (in Postgres).
- Immutable: no UPDATE or DELETE logic.
- Tags (JSONB) preserves the allowlists from the telemetry plan and BRIEFING.
- One single bulk-insert operation per batch.
- Independent metadata so it never contaminates inventory's SQLModel.metadata.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, MetaData, Text, insert, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlmodel import Field, Session, SQLModel

from telemetry_schemas import TelemetryEvent, TelemetryReceipt

logger = logging.getLogger("telemetry.storage")

# Isolated metadata to keep inventory's SQLModel.metadata clean
telemetry_metadata = MetaData()


class TelemetryBase(SQLModel):
    metadata = telemetry_metadata


# ---------------------------------------------------------------------------
# Allowlist of properties to include in tags (JSONB)
# ---------------------------------------------------------------------------

_TAGS_ALLOWLIST = {
    # Business dimensions from the BRIEFING
    "office",
    "product_id",
    "product_category",
    "programme_id",
    "quantity",
    "currency",
    "unit_cost",
    "unit_cost_current",
    "unit_cost_reference",
    "variance_pct",
    "threshold",
    "reason",
    "order_id",
    # Business performance reporting contract (kept inside tags; no new columns)
    "order_type",
    "asset_office",
    "supplier_id",
    "unit_cost_minor",
    "total_cost_minor",
    "exit_type",
    "stock_before",
    "stock_after",
    "threshold_version",
    "baseline_total_cost_minor",
    "baseline_total_quantity",
    "baseline_order_count",
    "window_days",
    "threshold_percent",
    "variance_percent",
    "baseline_cutoff_at",
    # Technical dimensions from the telemetry plan
    "page",
    "route",
    "page_view_id",
    "route_template",
    "source",
    "environment",
    "actor_type",
    "authority",
    "key_version",
    "ui_language",
    "action",
    "error_type",
    "stage",
    "filter_name",
    "status_code",
    "duration_ms",
    "flow_id",
    "flow_name",
    "step_name",
}


def _extract_tags(event_type: str, properties: dict[str, Any]) -> dict[str, Any]:
    """Return a JSONB-safe dictionary preserving allowlists and event_type."""
    tags: dict[str, Any] = {"event_type": event_type}
    for key, val in properties.items():
        if key in _TAGS_ALLOWLIST and val is not None:
            tags[key] = val
    return tags


# ---------------------------------------------------------------------------
# Table definition — exactly 8 columns, immutable
# ---------------------------------------------------------------------------

class TelemetryEventRow(TelemetryBase, table=True):
    """Immutable append-only row for a single telemetry event (8 columns)."""

    __tablename__ = "telemetry_events"
    __table_args__ = {"extend_existing": True}

    event_id: str = Field(sa_column=Column(Text, primary_key=True))
    timestamp: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    session_id: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    user_id: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    event_type: str = Field(sa_column=Column(Text, nullable=False))
    schema_version: str = Field(sa_column=Column(Text, nullable=False))
    request_id: str = Field(sa_column=Column(Text, nullable=False))
    tags: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB().with_variant(JSON(), "sqlite"), nullable=False),
    )


# ---------------------------------------------------------------------------
# Index creation (idempotent)
# ---------------------------------------------------------------------------

def init_telemetry_db(engine: Any) -> None:
    """Create the table and its three indices if they do not exist yet."""
    telemetry_metadata.create_all(engine)

    is_postgres = False
    try:
        from sqlalchemy.engine import make_url
        url = make_url(str(engine.url))
        is_postgres = url.get_backend_name() == "postgresql"
    except Exception:
        pass

    with engine.connect() as conn:
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_telemetry_events_timestamp "
                "ON telemetry_events (timestamp)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_telemetry_events_event_type "
                "ON telemetry_events (event_type)"
            )
        )
        if is_postgres:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_telemetry_events_tags_gin "
                    "ON telemetry_events USING gin (tags)"
                )
            )
            conn.execute(text("ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY"))
            conn.execute(text("REVOKE ALL PRIVILEGES ON TABLE telemetry_events FROM PUBLIC"))
            conn.execute(text(
                """DO $$
                DECLARE
                    role_name text;
                BEGIN
                    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
                    LOOP
                        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                            EXECUTE format(
                                'REVOKE ALL PRIVILEGES ON TABLE public.telemetry_events FROM %I',
                                role_name
                            );
                        END IF;
                    END LOOP;
                END $$"""
            ))
        conn.commit()


# ---------------------------------------------------------------------------
# Bulk-insert logic (one single operation per batch)
# ---------------------------------------------------------------------------

def _event_to_row(event: TelemetryEvent) -> TelemetryEventRow:
    return TelemetryEventRow(
        event_id=str(event.event_id),
        timestamp=event.timestamp,
        session_id=str(event.session_id) if event.session_id is not None else None,
        user_id=event.user_id,
        event_type=event.event_type,
        schema_version=event.schema_version,
        request_id=str(event.request_id),
        tags=_extract_tags(event.event_type, event.properties),
    )


def insert_telemetry_events(session: Session, events: list[TelemetryEvent]) -> int:
    """Insert valid events in a single bulk insert operation."""
    if not events:
        return 0
    rows = [_event_to_row(evt) for evt in events]
    values = [
        {column.name: getattr(row, column.name) for column in TelemetryEventRow.__table__.columns}
        for row in rows
    ]
    session.exec(insert(TelemetryEventRow).values(values))
    session.commit()
    return len(rows)
