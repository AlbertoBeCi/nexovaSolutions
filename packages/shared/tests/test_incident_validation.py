"""Tests de nexova_shared.incident_validation: validate_incident(),
validate_status_value() e is_valid_transition()."""
from __future__ import annotations

import pytest

from nexova_shared.incident_validation import (
    is_valid_transition,
    transition_error_message,
    validate_incident,
    validate_incident_fields,
    validate_status_value,
)

VALID_INCIDENT = {
    "title": "Fallo de acceso al portal",
    "description": "El cliente no puede iniciar sesion desde ayer.",
    "category": "technical_failure",
    "origin": "customer",
    "branch": "central",
}


def test_validate_incident_accepts_valid_payload():
    assert validate_incident(VALID_INCIDENT) == {}


@pytest.mark.parametrize("missing_field", ["title", "description", "category", "origin", "branch"])
def test_validate_incident_reports_missing_required_field(missing_field):
    data = {**VALID_INCIDENT, missing_field: ""}
    errors = validate_incident(data)
    assert missing_field in errors
    assert errors[missing_field]  # mensaje no vacio


def test_validate_incident_reports_missing_field_when_absent_entirely():
    data = dict(VALID_INCIDENT)
    del data["branch"]
    errors = validate_incident(data)
    assert "branch" in errors


@pytest.mark.parametrize(
    "field,bad_value",
    [
        ("category", "not_a_category"),
        ("origin", "not_an_origin"),
        ("branch", "headquarters"),
    ],
)
def test_validate_incident_rejects_unknown_enum_value(field, bad_value):
    data = {**VALID_INCIDENT, field: bad_value}
    errors = validate_incident(data)
    assert field in errors


def test_validate_incident_accepts_status_open_on_create():
    data = {**VALID_INCIDENT, "status": "open"}
    assert validate_incident(data) == {}


@pytest.mark.parametrize("status", ["in_progress", "resolved", "discarded"])
def test_validate_incident_rejects_non_open_status_on_create(status):
    data = {**VALID_INCIDENT, "status": status}
    errors = validate_incident(data)
    assert "status" in errors


@pytest.mark.parametrize("status", ["open", "in_progress", "resolved", "discarded"])
def test_validate_incident_fields_accepts_any_status_value(status):
    """A diferencia de validate_incident(), validate_incident_fields() no
    aplica la regla de "solo open al crear": la usa scripts/seed_incidents.py
    para incidencias historicas con cualquier estado."""
    data = {**VALID_INCIDENT, "status": status}
    assert validate_incident_fields(data) == {}


def test_validate_incident_fields_still_requires_the_other_fields():
    errors = validate_incident_fields({**VALID_INCIDENT, "branch": ""})
    assert "branch" in errors


def test_validate_status_value_requires_known_status():
    assert validate_status_value("open") is None
    assert validate_status_value("") is not None
    assert validate_status_value(None) is not None
    assert validate_status_value("unknown") is not None


@pytest.mark.parametrize(
    "from_status,to_status,expected",
    [
        ("open", "in_progress", True),
        ("open", "discarded", True),
        ("in_progress", "resolved", True),
        ("in_progress", "discarded", True),
        ("open", "resolved", False),
        ("in_progress", "open", False),
        ("resolved", "open", False),
        ("resolved", "discarded", False),
        ("discarded", "open", False),
        ("discarded", "resolved", False),
        ("open", "open", False),
        ("resolved", "resolved", False),
        ("discarded", "discarded", False),
        ("open", "unknown", False),
        ("unknown", "open", False),
    ],
)
def test_is_valid_transition(from_status, to_status, expected):
    assert is_valid_transition(from_status, to_status) is expected


def test_transition_error_message_mentions_final_state():
    message = transition_error_message("resolved", "open")
    assert "resolved" in message


def test_transition_error_message_mentions_same_state():
    message = transition_error_message("open", "open")
    assert "open" in message
