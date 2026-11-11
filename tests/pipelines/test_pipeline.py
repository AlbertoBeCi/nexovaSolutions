"""Isolated transformation-task tests for the four weekly business KPIs."""
from __future__ import annotations

import copy
import json
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from data.pipelines import pipeline  # noqa: E402
from data.process.business_performance import DuplicateEventConflict  # noqa: E402

WEEK = date(2026, 11, 2)
SCHEMA = json.loads((ROOT / "docs/telemetry/event-schemas.json").read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def forbid_database_access(monkeypatch):
    def unexpected_database(*_args, **_kwargs):
        pytest.fail("Transformation tasks must not access a database")
    monkeypatch.setattr(pipeline, "_engine", unexpected_database)


def kpi_event(event_type, event_id, **tags):
    properties = copy.deepcopy(SCHEMA["definitions"][event_type]["examples"][0]["properties"])
    properties.update(environment="production", office="valencia", programme_id="ventas-b2b",
                      currency="EUR", quantity=99)
    properties.update(tags)
    return {"event_id": event_id, "event_type": event_type,
            "timestamp": "2026-11-03T10:00:00Z", "request_id": None, "tags": properties}


def validated_events(*events):
    return pipeline.validate_and_deduplicate_events_task.fn(list(events), WEEK)


def test_costo_de_material_por_oficina_programa_uses_exact_minor_units():
    validated = validated_events(
        kpi_event("inbound_order_created", "in-1", total_cost_minor=12345),
        kpi_event("inbound_order_created", "in-2", total_cost_minor=55),
    )
    rows = pipeline.aggregate_weekly_performance.fn(validated, WEEK)
    assert rows[0]["total_material_cost"] == Decimal("124.00")
    assert rows[0]["currency"] == "EUR"


def test_kits_entregados_counts_deliveries_not_quantity_and_deduplicates():
    event = kpi_event("outbound_order_created", "out-1", quantity=99)
    validated = validated_events(event, copy.deepcopy(event), kpi_event("outbound_order_created", "out-2"))
    assert validated.events_duplicate == 1
    assert pipeline.aggregate_weekly_performance.fn(validated, WEEK)[0]["kits_delivered_count"] == 2


def test_frecuencia_de_escasez_y_variacion_de_costo_count_each_event():
    validated = validated_events(
        kpi_event("stock_threshold_triggered", "s-1"),
        kpi_event("stock_threshold_triggered", "s-2"),
        kpi_event("kit_cost_variance_detected", "v-1"),
    )
    row = pipeline.aggregate_weekly_performance.fn(validated, WEEK)[0]
    assert row["shortage_events_count"] == 2
    assert row["cost_variance_events_count"] == 1


def test_costo_de_material_keeps_offices_programmes_and_currencies_separate():
    validated = validated_events(
        kpi_event("inbound_order_created", "v", total_cost_minor=100),
        kpi_event("inbound_order_created", "m", total_cost_minor=200, office="miami", currency="USD"),
        kpi_event("inbound_order_created", "p", total_cost_minor=300, programme_id="liderazgo"),
    )
    rows = pipeline.aggregate_weekly_performance.fn(validated, WEEK)
    assert {(r["office"], r["programme_id"], r["currency"], r["total_material_cost"]) for r in rows} == {
        ("valencia", "ventas-b2b", "EUR", Decimal("1.00")),
        ("miami", "ventas-b2b", "USD", Decimal("2.00")),
        ("valencia", "liderazgo", "EUR", Decimal("3.00")),
    }


@pytest.mark.parametrize("invalid_cost", [None, "1250", -1, True])
def test_costo_de_material_rejects_malformed_cost_without_zero_filling(invalid_cost):
    validated = validated_events(kpi_event("inbound_order_created", "bad", total_cost_minor=invalid_cost))
    assert validated.events_rejected == 1
    assert validated.events == ()
    assert pipeline.aggregate_weekly_performance.fn(validated, WEEK) == []


def test_weekly_kpis_reject_null_tags_and_exclude_non_production():
    malformed = kpi_event("outbound_order_created", "bad")
    malformed["tags"] = None
    validated = validated_events(malformed, kpi_event("outbound_order_created", "dev", environment="development"))
    assert validated.events_rejected == 1
    assert validated.events_non_production == 1
    assert validated.events == ()


def test_weekly_kpis_report_missing_programme_as_pending():
    validated = validated_events(kpi_event("outbound_order_created", "bad", programme_id=None))
    assert validated.events_pending == 1
    assert validated.events == ()


def test_kits_entregados_conflicting_duplicate_fails():
    with pytest.raises(DuplicateEventConflict):
        validated_events(kpi_event("outbound_order_created", "same"),
                         kpi_event("outbound_order_created", "same", quantity=1))


def test_weekly_kpis_validation_confirms_all_four_totals_and_stable_digest():
    validated = validated_events(
        kpi_event("inbound_order_created", "in", total_cost_minor=12345),
        kpi_event("outbound_order_created", "out"),
        kpi_event("stock_threshold_triggered", "short"),
        kpi_event("kit_cost_variance_detected", "variance"),
    )
    rows = pipeline.aggregate_weekly_performance.fn(validated, WEEK)
    checked, digest = pipeline.validate_weekly_aggregates_task.fn(rows, WEEK, validated)
    assert checked == rows
    assert len(digest) == 64
    assert pipeline.validate_weekly_aggregates_task.fn(copy.deepcopy(rows), WEEK, validated)[1] == digest


@pytest.mark.parametrize("field,value,error", [
    ("total_material_cost", Decimal("999"), "material_cost_total_mismatch"),
    ("kits_delivered_count", 0, "delivered_event_total_mismatch"),
    ("shortage_events_count", 1, "shortage_event_total_mismatch"),
    ("cost_variance_events_count", 1, "cost_variance_event_total_mismatch"),
    ("currency", "USD", "aggregate_currency_invalid"),
])
def test_weekly_kpis_validation_detects_incorrect_business_results(field, value, error):
    validated = validated_events(kpi_event("outbound_order_created", "out"))
    rows = pipeline.aggregate_weekly_performance.fn(validated, WEEK)
    rows[0][field] = value
    with pytest.raises(ValueError, match=error):
        pipeline.validate_weekly_aggregates_task.fn(rows, WEEK, validated)
