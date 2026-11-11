"""Pure validation and aggregation for the weekly business performance report."""
from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable, Mapping

BUSINESS_EVENT_TYPES = frozenset(
    {
        "inbound_order_created",
        "outbound_order_created",
        "stock_threshold_triggered",
        "kit_cost_variance_detected",
    }
)
OFFICE_CURRENCY = {"valencia": "EUR", "miami": "USD"}
PROGRAMME_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# These keys mirror x-required in docs/telemetry/event-schemas.json. The test
# suite compares them with that schema so the transform cannot drift silently.
REQUIRED_EVENT_FIELDS = {
    "inbound_order_created": frozenset(
        {
            "source", "environment", "actor_type", "authority", "key_version",
            "office", "product_id", "product_category", "programme_id", "quantity",
            "currency", "order_id", "order_type", "asset_office", "supplier_id",
            "unit_cost_minor", "total_cost_minor",
        }
    ),
    "outbound_order_created": frozenset(
        {
            "source", "environment", "actor_type", "authority", "key_version",
            "office", "product_id", "product_category", "programme_id", "quantity",
            "currency", "order_id", "order_type", "asset_office", "exit_type",
        }
    ),
    "stock_threshold_triggered": frozenset(
        {
            "source", "environment", "actor_type", "authority", "key_version",
            "office", "product_id", "product_category", "programme_id", "quantity",
            "currency", "stock_before", "stock_after", "threshold",
            "threshold_version", "order_id", "order_type",
        }
    ),
    "kit_cost_variance_detected": frozenset(
        {
            "source", "environment", "actor_type", "authority", "key_version",
            "office", "product_id", "product_category", "programme_id", "quantity",
            "currency", "order_id", "order_type", "asset_office", "supplier_id",
            "unit_cost_minor", "baseline_total_cost_minor", "baseline_total_quantity",
            "baseline_order_count", "window_days", "threshold_percent",
            "variance_percent", "baseline_cutoff_at",
        }
    ),
}

PENDING_DIMENSIONS = frozenset({"office", "programme_id", "currency"})


class DuplicateEventConflict(ValueError):
    """Raised when one event ID appears with conflicting canonical contents."""


@dataclass(frozen=True)
class ValidatedEvents:
    events: tuple[dict[str, Any], ...]
    events_read: int
    events_duplicate: int
    events_rejected: int
    events_pending: int
    events_non_production: int
    input_digest: str


def _timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise ValueError("timestamp_missing_or_invalid")
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamp_must_include_timezone")
    return parsed.astimezone(timezone.utc)


def _json_default(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value, "f")
    raise TypeError(f"unsupported value: {type(value).__name__}")


def canonical_digest(value: Any) -> str:
    encoded = json.dumps(
        value,
        default=_json_default,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _canonical_event(row: Mapping[str, Any]) -> dict[str, Any]:
    event_id = row.get("event_id")
    event_type = row.get("event_type")
    tags = row.get("tags")
    if not isinstance(event_id, str) or not event_id.strip():
        raise ValueError("event_id_missing")
    if event_type not in BUSINESS_EVENT_TYPES:
        raise ValueError("event_type_not_in_business_report")
    if not isinstance(tags, Mapping):
        raise ValueError("tags_missing_or_invalid")
    timestamp = _timestamp(row.get("timestamp"))
    event = {
        "event_id": event_id,
        "timestamp": timestamp,
        "event_type": event_type,
        "request_id": row.get("request_id"),
        "tags": dict(tags),
    }
    if tags.get("event_type", event_type) != event_type:
        raise ValueError("event_type_mismatch")
    return event


def validate_and_deduplicate_events(
    rows: Iterable[Mapping[str, Any]], week_start: date
) -> ValidatedEvents:
    """Validate event contracts, count quality outcomes, and dedupe by event ID."""
    if week_start.weekday() != 0:
        raise ValueError("week_start_must_be_monday")

    materialized = list(rows)
    valid_by_id: dict[str, dict[str, Any]] = {}
    rejected = pending = non_production = duplicates = 0
    week_open = datetime.combine(week_start, time.min, tzinfo=timezone.utc)
    week_close = week_open + timedelta(days=7)

    for row in materialized:
        try:
            event = _canonical_event(row)
            tags = event["tags"]
            if tags.get("environment") != "production":
                non_production += 1
                continue
            required = REQUIRED_EVENT_FIELDS[event["event_type"]]
            missing = {
                name for name in required
                if name not in tags or (tags[name] is None and name != "key_version")
            }
            if missing:
                if missing & PENDING_DIMENSIONS:
                    pending += 1
                else:
                    rejected += 1
                continue

            timestamp = event["timestamp"]
            if not week_open <= timestamp < week_close:
                rejected += 1
                continue

            office = tags.get("office")
            programme_id = tags.get("programme_id")
            if office not in OFFICE_CURRENCY or not isinstance(programme_id, str) or not PROGRAMME_SLUG.fullmatch(programme_id):
                pending += 1
                continue
            if tags.get("currency") != OFFICE_CURRENCY[office]:
                pending += 1
                continue

            for name in ("quantity",):
                value = tags.get(name)
                if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                    raise ValueError(f"{name}_invalid")

            if event["event_type"] == "inbound_order_created":
                cost = tags.get("total_cost_minor")
                if isinstance(cost, bool) or not isinstance(cost, int) or cost < 0:
                    raise ValueError("total_cost_minor_invalid")
            if event["event_type"] == "stock_threshold_triggered":
                before, after, threshold = (tags.get(k) for k in ("stock_before", "stock_after", "threshold"))
                if any(isinstance(v, bool) or not isinstance(v, int) or v < 0 for v in (before, after, threshold)):
                    raise ValueError("stock_threshold_fields_invalid")

            previous = valid_by_id.get(event["event_id"])
            if previous is not None:
                if canonical_digest(previous) != canonical_digest(event):
                    raise DuplicateEventConflict("duplicate_event_id_payload_conflict")
                duplicates += 1
                continue
            valid_by_id[event["event_id"]] = event
        except DuplicateEventConflict:
            raise
        except (TypeError, ValueError, OverflowError):
            rejected += 1

    ordered_events = tuple(valid_by_id[key] for key in sorted(valid_by_id))
    return ValidatedEvents(
        events=ordered_events,
        events_read=len(materialized),
        events_duplicate=duplicates,
        events_rejected=rejected,
        events_pending=pending,
        events_non_production=non_production,
        input_digest=canonical_digest(ordered_events),
    )


def aggregate_weekly_performance(
    validated: ValidatedEvents, week_start: date
) -> list[dict[str, Any]]:
    """Compute the four design KPIs at office/program/ISO-week grain."""
    if week_start.weekday() != 0:
        raise ValueError("week_start_must_be_monday")

    grouped: dict[tuple[str, str, date], dict[str, Any]] = {}
    for event in validated.events:
        tags = event["tags"]
        key = (tags["office"], tags["programme_id"], week_start)
        aggregate = grouped.setdefault(
            key,
            {
                "office": key[0],
                "programme_id": key[1],
                "week_start": week_start,
                "total_material_cost": Decimal("0.00"),
                "kits_delivered_count": 0,
                "shortage_events_count": 0,
                "cost_variance_events_count": 0,
                "currency": OFFICE_CURRENCY[key[0]],
            },
        )
        event_type = event["event_type"]
        if event_type == "inbound_order_created":
            aggregate["total_material_cost"] += Decimal(tags["total_cost_minor"]) / Decimal(100)
        elif event_type == "outbound_order_created":
            aggregate["kits_delivered_count"] += 1
        elif event_type == "stock_threshold_triggered":
            aggregate["shortage_events_count"] += 1
        elif event_type == "kit_cost_variance_detected":
            aggregate["cost_variance_events_count"] += 1

    return [grouped[key] for key in sorted(grouped)]


def validate_weekly_aggregates(
    aggregates: Iterable[Mapping[str, Any]], week_start: date, validated: ValidatedEvents
) -> tuple[list[dict[str, Any]], str]:
    """Check output grain, currencies, nonnegative values, and event totals."""
    if week_start.weekday() != 0:
        raise ValueError("week_start_must_be_monday")
    rows = [dict(row) for row in aggregates]
    seen: set[tuple[str, str, date]] = set()
    for row in rows:
        key = (row.get("office"), row.get("programme_id"), row.get("week_start"))
        if key in seen or key[2] != week_start:
            raise ValueError("aggregate_grain_invalid")
        seen.add(key)
        office = row["office"]
        if office not in OFFICE_CURRENCY or row.get("currency") != OFFICE_CURRENCY[office]:
            raise ValueError("aggregate_currency_invalid")
        if not isinstance(row.get("total_material_cost"), Decimal) or row["total_material_cost"] < 0:
            raise ValueError("aggregate_cost_invalid")
        for count_key in (
            "kits_delivered_count", "shortage_events_count", "cost_variance_events_count"
        ):
            value = row.get(count_key)
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError("aggregate_count_invalid")

    source_counts = defaultdict(int)
    for event in validated.events:
        source_counts[event["event_type"]] += 1
    if sum(row["kits_delivered_count"] for row in rows) != source_counts["outbound_order_created"]:
        raise ValueError("delivered_event_total_mismatch")
    expected_material_cost = sum(
        (
            Decimal(event["tags"]["total_cost_minor"]) / Decimal(100)
            for event in validated.events
            if event["event_type"] == "inbound_order_created"
        ),
        start=Decimal("0.00"),
    )
    if sum((row["total_material_cost"] for row in rows), start=Decimal("0.00")) != expected_material_cost:
        raise ValueError("material_cost_total_mismatch")
    if sum(row["shortage_events_count"] for row in rows) != source_counts["stock_threshold_triggered"]:
        raise ValueError("shortage_event_total_mismatch")
    if sum(row["cost_variance_events_count"] for row in rows) != source_counts["kit_cost_variance_detected"]:
        raise ValueError("cost_variance_event_total_mismatch")

    materialized = sorted(rows, key=lambda row: (row["office"], row["programme_id"], row["week_start"]))
    return materialized, canonical_digest(materialized)
