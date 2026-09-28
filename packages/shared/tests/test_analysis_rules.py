"""
Tests de nexova_shared.incidents_analysis: reglas del analizador de tickets
de soporte (7 reglas de invalidez) y el cross-check entre la version
vectorizada (apply_validation_rules, sobre un DataFrame) y la version
fila-a-fila (csv_row_violations, usada por scripts/seed_incidents.py).
"""
from __future__ import annotations

import csv
from pathlib import Path

import pandas as pd
import pytest

from nexova_shared.incidents_analysis import (
    RULE_LABELS,
    apply_validation_rules,
    build_summary,
    csv_row_violations,
    load_dataframe,
)

FIXTURE_CSV = Path(__file__).resolve().parents[2].parent / "scripts" / "incidents-COMPANY.csv"


@pytest.fixture(scope="module")
def fixture_df() -> pd.DataFrame:
    return load_dataframe(str(FIXTURE_CSV))


@pytest.fixture(scope="module")
def fixture_rows() -> list[dict[str, str]]:
    with FIXTURE_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def test_summary_counts_match_expected_values(fixture_df):
    """Los conteos esperados documentados en el prompt del gestor de
    incidencias, verificados contra el CSV real del analizador."""
    summary = build_summary(fixture_df, "incidents-COMPANY.csv")

    assert summary["total_records"] == 100
    assert summary["valid_records"] == 96
    assert summary["invalid_records"] == 4

    statuses = {name: data["count"] for name, data in summary["statuses"].items()}
    assert statuses == {"OPEN": 27, "CLOSED": 56, "DISCARDED": 13}

    categories = {name: data["count"] for name, data in summary["categories"].items()}
    assert categories["TECHNICAL"] + categories["ACCESS"] == 49
    assert categories["BILLING"] + categories["HR_QUERY"] == 35
    assert categories["COMPLAINT"] == 12


def test_row_violations_match_vectorized_masks_for_every_row(fixture_df, fixture_rows):
    """Cross-check: csv_row_violations() (escalar, usada por el seed) y
    apply_validation_rules() (vectorizada, usada por el analizador) deben
    marcar exactamente las mismas filas como invalidas, por la misma razon,
    fila por fila. Si alguna vez divergen, esta prueba lo detecta."""
    masks = apply_validation_rules(fixture_df)
    assert len(fixture_rows) == len(fixture_df)

    for i, row in enumerate(fixture_rows):
        expected_rules = {name for name in RULE_LABELS if bool(masks[name].iloc[i])}
        actual_rules = set(csv_row_violations(row))
        assert actual_rules == expected_rules, f"fila {i}: {row}"


def test_csv_row_violations_valid_row_has_no_violations():
    row = {
        "ticket_id": "NXV-000001",
        "date": "2026-08-15",
        "client_company": "Acme Corp",
        "category": "TECHNICAL",
        "description": "Cliente reporta incidencia de tipo technical en el sistema.",
        "agent_id": "AGT-02",
        "status": "OPEN",
        "customer_email": "cliente@empresa.test",
        "satisfaction_score": "",
    }
    assert csv_row_violations(row) == []


@pytest.mark.parametrize(
    "overrides,expected_rule",
    [
        ({"client_company": "  "}, "missing_company"),
        ({"category": "UNKNOWN"}, "invalid_category"),
        ({"description": "hi"}, "short_description"),
        ({"agent_id": "AGENT-1"}, "invalid_agent_id"),
        ({"customer_email": "sin-arroba.test"}, "invalid_email"),
        ({"status": "CLOSED", "satisfaction_score": ""}, "closed_no_score"),
        ({"satisfaction_score": "9"}, "score_out_of_range"),
    ],
)
def test_csv_row_violations_detects_each_rule(overrides, expected_rule):
    row = {
        "ticket_id": "NXV-000001",
        "date": "2026-08-15",
        "client_company": "Acme Corp",
        "category": "TECHNICAL",
        "description": "Cliente reporta incidencia de tipo technical en el sistema.",
        "agent_id": "AGT-02",
        "status": "OPEN",
        "customer_email": "cliente@empresa.test",
        "satisfaction_score": "",
    }
    row.update(overrides)
    assert expected_rule in csv_row_violations(row)
