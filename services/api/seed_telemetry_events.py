"""Seed script for telemetry demo events aligned with the BRIEFING.

Generates synthetic telemetry events for all five mandatory business metrics:
  - inbound_order_created
  - outbound_order_created
  - stock_threshold_triggered
  - direct_stock_edit_rejected
  - kit_cost_variance_detected

Also generates technical events (page_viewed, auth events) to satisfy the
"at least one technical + one business event" requirement of the delivery.

Usage (from services/api):
    uv run python seed_telemetry_events.py [--dry-run]

Events are inserted directly into Supabase telemetry_events via store_batch.
Requires SUPABASE_DATABASE_URL to be set in the environment.
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Products and programmes from the BRIEFING
# ---------------------------------------------------------------------------

PRODUCTS = [
    {"id": "KIT-VEN-B2B-001", "category": "training_kit",         "programme": "ventas-b2b",      "office": "valencia"},
    {"id": "KIT-VEN-B2B-002", "category": "training_kit",         "programme": "ventas-b2b",      "office": "miami"},
    {"id": "CERT-LID-001",    "category": "certification",        "programme": "liderazgo-basico", "office": "valencia"},
    {"id": "CERT-LID-002",    "category": "certification",        "programme": "liderazgo-basico", "office": "miami"},
    {"id": "KIT-ONB-SUP-001", "category": "onboarding_equipment", "programme": "onboarding-soporte", "office": "valencia"},
    {"id": "KIT-ONB-SUP-002", "category": "onboarding_equipment", "programme": "onboarding-soporte", "office": "miami"},
    {"id": "KIT-FOR-COR-001", "category": "training_kit",         "programme": "formacion-corporativa", "office": "valencia"},
    {"id": "KIT-FOR-COR-002", "category": "training_kit",         "programme": "formacion-corporativa", "office": "miami"},
]

SCHEMA_VERSION = "1.0.0"
_BASE_TS = datetime(2026, 10, 1, 8, 0, 0, tzinfo=timezone.utc)


def _ts(offset_hours: float) -> str:
    return (_BASE_TS + timedelta(hours=offset_hours)).isoformat()


def _evt(event_type: str, properties: dict, offset_hours: float) -> dict:
    return {
        "eventId": str(uuid.uuid4()),
        "timestamp": _ts(offset_hours),
        "sessionId": str(uuid.uuid4()),
        "userId": None,
        "event_type": event_type,
        "schemaVersion": SCHEMA_VERSION,
        "requestId": str(uuid.uuid4()),
        "properties": properties,
    }


def build_events() -> list[dict]:
    events: list[dict] = []
    h = 0.0  # offset hours

    # -----------------------------------------------------------------------
    # 12-15 inbound_order_created (Valencia EUR, Miami USD)
    # -----------------------------------------------------------------------
    inbound_orders = [
        ("KIT-VEN-B2B-001", "valencia", 50, 12.50, "EUR"),
        ("KIT-VEN-B2B-001", "valencia", 40, 12.50, "EUR"),
        ("KIT-VEN-B2B-002", "miami",    60, 14.00, "USD"),
        ("KIT-VEN-B2B-002", "miami",    55, 14.00, "USD"),
        ("CERT-LID-001",    "valencia", 30, 25.00, "EUR"),
        ("CERT-LID-001",    "valencia", 35, 25.00, "EUR"),
        ("CERT-LID-002",    "miami",    25, 28.00, "USD"),
        ("KIT-ONB-SUP-001", "valencia", 20, 80.00, "EUR"),
        ("KIT-ONB-SUP-001", "valencia", 15, 80.00, "EUR"),
        ("KIT-ONB-SUP-002", "miami",    18, 90.00, "USD"),
        ("KIT-FOR-COR-001", "valencia", 45, 10.00, "EUR"),
        ("KIT-FOR-COR-002", "miami",    50, 11.50, "USD"),
        # kit_cost_variance_detected trigger: cost jumps > 10%
        ("KIT-VEN-B2B-001", "valencia", 40, 14.20, "EUR"),  # +13.6% vs 12.50
    ]
    for prod_id, office, qty, unit_cost, currency in inbound_orders:
        prod = next(p for p in PRODUCTS if p["id"] == prod_id)
        events.append(_evt("inbound_order_created", {
            "office": office,
            "product_id": prod_id,
            "product_category": prod["category"],
            "programme_id": prod["programme"],
            "quantity": qty,
            "currency": currency,
            "unit_cost": unit_cost,
            "order_id": str(uuid.uuid4()),
        }, h))
        h += 2

    # -----------------------------------------------------------------------
    # kit_cost_variance_detected (1 case — triggered by last inbound above)
    # -----------------------------------------------------------------------
    events.append(_evt("kit_cost_variance_detected", {
        "office": "valencia",
        "product_id": "KIT-VEN-B2B-001",
        "product_category": "training_kit",
        "programme_id": "ventas-b2b",
        "quantity": 40,
        "currency": "EUR",
        "unit_cost_current": 14.20,
        "unit_cost_reference": 12.50,
        "variance_pct": 13.6,
        "order_id": str(uuid.uuid4()),
    }, h))
    h += 1

    # -----------------------------------------------------------------------
    # 12-15 outbound_order_created
    # -----------------------------------------------------------------------
    outbound_orders = [
        ("KIT-VEN-B2B-001", "valencia", 5, "EUR"),
        ("KIT-VEN-B2B-001", "valencia", 3, "EUR"),
        ("KIT-VEN-B2B-002", "miami",    4, "USD"),
        ("KIT-VEN-B2B-002", "miami",    6, "USD"),
        ("CERT-LID-001",    "valencia", 2, "EUR"),
        ("CERT-LID-001",    "valencia", 3, "EUR"),
        ("CERT-LID-002",    "miami",    2, "USD"),
        ("KIT-ONB-SUP-001", "valencia", 1, "EUR"),
        ("KIT-ONB-SUP-002", "miami",    1, "USD"),
        ("KIT-FOR-COR-001", "valencia", 8, "EUR"),
        ("KIT-FOR-COR-002", "miami",    7, "USD"),
        # These two trigger stock_threshold_triggered below
        ("CERT-LID-001",    "valencia", 28, "EUR"),  # drains to < 6 (threshold=6)
        ("KIT-ONB-SUP-002", "miami",    16, "USD"),  # drains to < 3 (threshold=3)
    ]
    for prod_id, office, qty, currency in outbound_orders:
        prod = next(p for p in PRODUCTS if p["id"] == prod_id)
        events.append(_evt("outbound_order_created", {
            "office": office,
            "product_id": prod_id,
            "product_category": prod["category"],
            "programme_id": prod["programme"],
            "quantity": qty,
            "currency": currency,
            "order_id": str(uuid.uuid4()),
        }, h))
        h += 1.5

    # -----------------------------------------------------------------------
    # stock_threshold_triggered (2 cases)
    # -----------------------------------------------------------------------
    for prod_id, office, remaining, threshold, currency in [
        ("CERT-LID-001",    "valencia", 2, 6, "EUR"),
        ("KIT-ONB-SUP-002", "miami",    2, 3, "USD"),
    ]:
        prod = next(p for p in PRODUCTS if p["id"] == prod_id)
        events.append(_evt("stock_threshold_triggered", {
            "office": office,
            "product_id": prod_id,
            "product_category": prod["category"],
            "programme_id": prod["programme"],
            "quantity": remaining,
            "currency": currency,
            "threshold": threshold,
        }, h))
        h += 0.5

    # -----------------------------------------------------------------------
    # direct_stock_edit_rejected (1 case)
    # -----------------------------------------------------------------------
    events.append(_evt("direct_stock_edit_rejected", {
        "office": "valencia",
        "product_id": "KIT-FOR-COR-001",
        "product_category": "training_kit",
        "programme_id": "formacion-corporativa",
        "quantity": 10,
        "currency": "EUR",
        "reason": "direct_edit_not_allowed",
    }, h))
    h += 0.5

    # -----------------------------------------------------------------------
    # Technical events (page_viewed, login_failed)
    # -----------------------------------------------------------------------
    events.append(_evt("page_viewed", {
        "page": "/inventario",
        "route": "/inventario",
    }, h))
    h += 0.1
    events.append(_evt("login_failed", {
        "reason": "invalid_credentials",
    }, h))

    return events


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed telemetry demo events into Supabase.")
    parser.add_argument("--dry-run", action="store_true", help="Print events as JSON without inserting.")
    args = parser.parse_args()

    events = build_events()

    if args.dry_run:
        print(json.dumps({"events": events}, indent=2, ensure_ascii=False))
        print(f"\nTotal events: {len(events)}", file=sys.stderr)
        return

    # Import here to avoid requiring DB env in dry-run mode
    import os
    if not os.environ.get("SUPABASE_DATABASE_URL"):
        print("ERROR: SUPABASE_DATABASE_URL not set. Use --dry-run to preview events.", file=sys.stderr)
        sys.exit(1)

    from inventory_database import get_engine
    from telemetry_schemas import TelemetryEvent
    from telemetry_storage import init_telemetry_db, insert_telemetry_events
    from sqlmodel import Session

    engine = get_engine()
    init_telemetry_db(engine)

    valid_events = [TelemetryEvent.model_validate(e) for e in events]
    with Session(engine) as session:
        stored = insert_telemetry_events(session, valid_events)

    print(f"Seeded: received={len(events)} stored={stored} rejected=0")


if __name__ == "__main__":
    main()
