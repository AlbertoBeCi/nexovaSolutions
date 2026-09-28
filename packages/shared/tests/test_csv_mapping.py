"""Tests de nexova_shared.csv_mapping: map_csv_row() y ticket_dedupe_key()."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from nexova_shared.csv_mapping import RowMappingError, map_csv_row, ticket_dedupe_key

VALID_ROW = {
    "ticket_id": "NXV-000001",
    "date": "2026-08-15",
    "client_company": "Umbrella Retail",
    "category": "BILLING",
    "description": "Cliente reporta incidencia de tipo billing en el sistema.",
    "agent_id": "AGT-02",
    "status": "OPEN",
    "customer_email": "cliente68082@empresa-ficticia.test",
    "satisfaction_score": "",
}


def test_map_csv_row_happy_path():
    mapped = map_csv_row(VALID_ROW)

    assert mapped.title == VALID_ROW["description"][:120].strip()
    assert mapped.description == VALID_ROW["description"]
    assert mapped.category == "process_error"  # BILLING -> process_error
    assert mapped.status == "open"  # OPEN -> open
    assert mapped.origin == "customer"
    assert mapped.branch == "central"
    assert mapped.created_at == datetime(2026, 8, 15, tzinfo=timezone.utc)
    assert mapped.updated_at == mapped.created_at


@pytest.mark.parametrize(
    "csv_status,expected",
    [("OPEN", "open"), ("CLOSED", "resolved"), ("DISCARDED", "discarded")],
)
def test_map_csv_row_status_mapping(csv_status, expected):
    row = {**VALID_ROW, "status": csv_status}
    assert map_csv_row(row).status == expected


@pytest.mark.parametrize(
    "csv_category,expected",
    [
        ("TECHNICAL", "technical_failure"),
        ("ACCESS", "technical_failure"),
        ("BILLING", "process_error"),
        ("HR_QUERY", "process_error"),
        ("COMPLAINT", "client_complaint"),
    ],
)
def test_map_csv_row_category_mapping(csv_category, expected):
    row = {**VALID_ROW, "category": csv_category}
    assert map_csv_row(row).category == expected


def test_map_csv_row_title_truncated_to_120_chars():
    long_description = "x" * 200
    row = {**VALID_ROW, "description": long_description}
    mapped = map_csv_row(row)
    assert len(mapped.title) == 120
    assert mapped.description == long_description


def test_map_csv_row_empty_description_is_rejected():
    row = {**VALID_ROW, "description": "   "}
    with pytest.raises(RowMappingError):
        map_csv_row(row)


def test_map_csv_row_invalid_date_is_rejected():
    row = {**VALID_ROW, "date": "15-08-2026"}
    with pytest.raises(RowMappingError):
        map_csv_row(row)


def test_map_csv_row_unmappable_status_is_rejected():
    row = {**VALID_ROW, "status": "PENDING"}
    with pytest.raises(RowMappingError):
        map_csv_row(row)


def test_map_csv_row_unmappable_category_is_rejected():
    row = {**VALID_ROW, "category": "UNKNOWN"}
    with pytest.raises(RowMappingError):
        map_csv_row(row)


def test_ticket_dedupe_key_uses_ticket_id_when_present():
    mapped = map_csv_row(VALID_ROW)
    assert ticket_dedupe_key(VALID_ROW, mapped) == "NXV-000001"


def test_ticket_dedupe_key_falls_back_to_title_and_created_at():
    row = {**VALID_ROW, "ticket_id": ""}
    mapped = map_csv_row(row)
    key = ticket_dedupe_key(row, mapped)
    assert mapped.title in key
    assert mapped.created_at.isoformat() in key
