from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

from data.process.business_performance import (  # noqa: E402
    DuplicateEventConflict,
    REQUIRED_EVENT_FIELDS,
    aggregate_weekly_performance,
    validate_and_deduplicate_events,
    validate_weekly_aggregates,
)

SCHEMA = json.loads((REPO_ROOT / "docs/telemetry/event-schemas.json").read_text(encoding="utf-8"))
WEEK = date(2026, 11, 2)
EVENT_TIMESTAMP = datetime(2026, 11, 3, 10, tzinfo=timezone.utc)


def _event(event_type: str, event_id: str, **overrides):
    payload = SCHEMA["definitions"][event_type]["examples"][0]
    tags = dict(payload["properties"])
    tags.update(
        {
            "event_type": event_type,
            "environment": "production",
            "office": "valencia",
            "programme_id": "ventas-b2b",
            "currency": "EUR",
            "quantity": 99,
        }
    )
    tags.update(overrides)
    return {
        "event_id": event_id,
        "timestamp": EVENT_TIMESTAMP,
        "event_type": event_type,
        "request_id": payload.get("requestId"),
        "tags": tags,
    }


def test_required_fields_match_telemetry_event_schemas():
    for event_type, expected in REQUIRED_EVENT_FIELDS.items():
        actual = {
            name
            for name, definition in SCHEMA["definitions"][event_type]["properties"]["properties"]["properties"].items()
            if definition.get("x-required") is True
        }
        assert actual == expected


def test_aggregates_exact_four_business_kpis_and_counts_delivery_events():
    rows = [
        _event("inbound_order_created", "in-1", total_cost_minor=12345),
        _event("inbound_order_created", "in-2", total_cost_minor=55),
        _event("outbound_order_created", "out-1"),
        _event("stock_threshold_triggered", "short-1"),
        _event("kit_cost_variance_detected", "variance-1"),
    ]

    validated = validate_and_deduplicate_events(rows, WEEK)
    aggregate = aggregate_weekly_performance(validated, WEEK)

    assert aggregate == [
        {
            "office": "valencia",
            "programme_id": "ventas-b2b",
            "week_start": WEEK,
            "total_material_cost": Decimal("124.00"),
            "kits_delivered_count": 1,
            "shortage_events_count": 1,
            "cost_variance_events_count": 1,
            "currency": "EUR",
        }
    ]
    assert aggregate[0]["kits_delivered_count"] != rows[2]["tags"]["quantity"]


def test_identical_event_delivery_is_counted_once():
    event = _event("outbound_order_created", "out-1")
    validated = validate_and_deduplicate_events([event, event], WEEK)

    assert len(validated.events) == 1
    assert validated.events_duplicate == 1
    assert aggregate_weekly_performance(validated, WEEK)[0]["kits_delivered_count"] == 1


def test_same_event_id_with_different_business_payload_fails_visibly():
    first = _event("outbound_order_created", "out-1")
    conflicting = _event("outbound_order_created", "out-1", office="miami", currency="USD")

    with pytest.raises(DuplicateEventConflict):
        validate_and_deduplicate_events([first, conflicting], WEEK)


def test_missing_reporting_dimensions_are_pending_reconciliation():
    event = _event("inbound_order_created", "in-1", total_cost_minor=1200)
    del event["tags"]["programme_id"]

    validated = validate_and_deduplicate_events([event], WEEK)

    assert validated.events_pending == 1
    assert validated.events_rejected == 0
    assert aggregate_weekly_performance(validated, WEEK) == []


def test_wrong_currency_is_pending_instead_of_mixed_into_aggregate():
    event = _event("inbound_order_created", "in-1", total_cost_minor=1200, currency="USD")

    validated = validate_and_deduplicate_events([event], WEEK)

    assert validated.events_pending == 1
    assert aggregate_weekly_performance(validated, WEEK) == []


def test_non_production_event_is_excluded():
    event = _event("outbound_order_created", "out-1", environment="test")

    validated = validate_and_deduplicate_events([event], WEEK)

    assert validated.events_non_production == 1
    assert validated.events_rejected == 0
    assert validated.events == ()


@pytest.mark.parametrize("event_time", [
    datetime(2026, 11, 2, 0, tzinfo=timezone.utc),
    datetime(2026, 11, 8, 23, 59, 59, tzinfo=timezone.utc),
])
def test_utc_week_window_includes_both_semibounded_edges(event_time):
    event = _event("outbound_order_created", "out-1")
    event["timestamp"] = event_time

    assert len(validate_and_deduplicate_events([event], WEEK).events) == 1


def test_next_monday_is_outside_the_requested_week():
    event = _event("outbound_order_created", "out-1")
    event["timestamp"] = datetime.combine(WEEK + timedelta(days=7), datetime.min.time(), timezone.utc)

    validated = validate_and_deduplicate_events([event], WEEK)

    assert validated.events_rejected == 1
    assert validated.events == ()


def test_aggregate_validation_checks_event_counts_and_digest():
    validated = validate_and_deduplicate_events(
        [_event("outbound_order_created", "out-1")], WEEK
    )
    aggregate = aggregate_weekly_performance(validated, WEEK)

    accepted, digest = validate_weekly_aggregates(aggregate, WEEK, validated)

    assert accepted == aggregate
    assert len(digest) == 64
    aggregate[0]["kits_delivered_count"] = 0
    with pytest.raises(ValueError, match="delivered_event_total_mismatch"):
        validate_weekly_aggregates(aggregate, WEEK, validated)
