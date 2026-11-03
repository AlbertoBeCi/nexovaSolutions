"""SQL-backed, Pandas-based operational metrics for stored telemetry events."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import pandas as pd
from sqlalchemy import bindparam, text
from sqlmodel import Session

_EVENT_COLUMNS = ["event_type", "timestamp", "tags"]
_REQUEST_EVENT = "client_request_completed"
_AUTH_EVENTS = ("login_failed", "login_succeeded")


def _load_events(
    session: Session,
    start_date: datetime,
    end_date: datetime,
    event_types: tuple[str, ...] | None = None,
) -> pd.DataFrame:
    """Load only the requested time window and event types from PostgreSQL."""
    statement = """
        SELECT event_type, timestamp, tags
        FROM telemetry_events
        WHERE timestamp >= :start_date AND timestamp < :end_date
    """
    params: dict[str, Any] = {"start_date": start_date, "end_date": end_date}
    query = text(statement)
    if event_types is not None:
        query = text(statement + " AND event_type IN :event_types").bindparams(
            bindparam("event_types", expanding=True)
        )
        params["event_types"] = event_types

    rows = session.execute(query, params).mappings().all()
    frame = pd.DataFrame.from_records(rows, columns=_EVENT_COLUMNS)
    if frame.empty:
        return frame

    frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
    frame = frame.dropna(subset=["timestamp"]).copy()
    frame["date"] = frame["timestamp"].dt.strftime("%Y-%m-%d")
    frame["tags"] = frame["tags"].map(_parse_tags)
    return frame


def _parse_tags(value: Any) -> dict[str, Any]:
    """Normalize PostgreSQL JSONB mappings and SQLite JSON strings."""
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _tag_dimension(frame: pd.DataFrame, name: str) -> pd.Series:
    """Extract one allowlisted dimension from JSON tags."""
    return frame["tags"].map(lambda tags: tags.get(name))


def events_per_day(session: Session, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
    """Count stored events by UTC date and event type."""
    frame = _load_events(session, start_date, end_date)
    if frame.empty:
        return []
    result = (
        frame.groupby(["date", "event_type"])
        .size()
        .rename("events")
        .reset_index()
        .sort_values(["date", "event_type"])
    )
    return result.to_dict(orient="records")


def request_error_rate(
    session: Session, start_date: datetime, end_date: datetime
) -> list[dict[str, Any]]:
    """Summarize client-observed HTTP/network failures by UTC date and route."""
    frame = _load_events(session, start_date, end_date, (_REQUEST_EVENT,))
    if frame.empty:
        return []
    frame["route_template"] = _tag_dimension(frame, "route_template")
    frame["status_code"] = pd.to_numeric(_tag_dimension(frame, "status_code"), errors="coerce")
    frame = frame.dropna(subset=["route_template", "status_code"])
    frame = frame.loc[frame["status_code"].between(0, 599)].copy()
    if frame.empty:
        return []
    frame["is_error"] = frame["status_code"].eq(0) | frame["status_code"].ge(400)
    result = (
        frame.groupby(["date", "route_template"])
        .agg(
            requests=("is_error", "count"),
            errors=("is_error", "sum"),
            error_rate=("is_error", "mean"),
        )
        .reset_index()
        .sort_values(["date", "route_template"])
    )
    return result.to_dict(orient="records")


def latency_by_route(session: Session, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
    """Summarize client-observed request latency by UTC date and route."""
    frame = _load_events(session, start_date, end_date, (_REQUEST_EVENT,))
    if frame.empty:
        return []
    frame["route_template"] = _tag_dimension(frame, "route_template")
    frame["duration_ms"] = pd.to_numeric(_tag_dimension(frame, "duration_ms"), errors="coerce")
    frame = frame.dropna(subset=["route_template", "duration_ms"])
    frame = frame.loc[frame["duration_ms"].between(0, 3_600_000)].copy()
    if frame.empty:
        return []
    result = (
        frame.groupby(["date", "route_template"])
        .agg(
            samples=("duration_ms", "count"),
            mean_ms=("duration_ms", "mean"),
            p95_ms=("duration_ms", lambda values: values.quantile(0.95)),
        )
        .reset_index()
        .sort_values(["date", "route_template"])
    )
    return result.to_dict(orient="records")


def auth_failure_rate(session: Session, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
    """Calculate daily failed login attempts over all recorded login attempts."""
    frame = _load_events(session, start_date, end_date, _AUTH_EVENTS)
    if frame.empty:
        return []
    frame["is_failure"] = frame["event_type"].eq("login_failed")
    result = (
        frame.groupby("date")
        .agg(
            attempts=("is_failure", "count"),
            failures=("is_failure", "sum"),
            failure_rate=("is_failure", "mean"),
        )
        .reset_index()
        .sort_values("date")
    )
    return result.to_dict(orient="records")
