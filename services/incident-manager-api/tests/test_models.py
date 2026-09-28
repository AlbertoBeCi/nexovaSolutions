"""Tests del modelo ORM: las restricciones de negocio tambien se aplican a
nivel de base de datos (CHECK/NOT NULL), no solo en la capa de aplicacion
(ver routes/incidents.py + nexova_shared.incident_validation)."""
from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from models import Incident


def _valid_incident(**overrides) -> Incident:
    data = {
        "title": "Fallo de acceso",
        "description": "El cliente no puede iniciar sesion.",
        "category": "technical_failure",
        "origin": "customer",
        "branch": "central",
    }
    data.update(overrides)
    return Incident(**data)


def test_valid_incident_is_persisted_with_default_status(db_session):
    incident = _valid_incident()
    db_session.add(incident)
    db_session.commit()

    assert incident.id is not None
    assert incident.status == "open"
    assert incident.created_at is not None
    assert incident.updated_at == incident.created_at


@pytest.mark.parametrize(
    "field,bad_value",
    [
        ("category", "not_a_category"),
        ("status", "not_a_status"),
        ("origin", "not_an_origin"),
        ("branch", "headquarters"),
    ],
)
def test_check_constraint_rejects_unknown_enum_value(db_session, field, bad_value):
    incident = _valid_incident(**{field: bad_value})
    db_session.add(incident)

    with pytest.raises(IntegrityError):
        db_session.commit()


@pytest.mark.parametrize("field", ["title", "description"])
def test_check_constraint_rejects_blank_text_field(db_session, field):
    incident = _valid_incident(**{field: "   "})
    db_session.add(incident)

    with pytest.raises(IntegrityError):
        db_session.commit()


@pytest.mark.parametrize("field", ["category", "origin", "branch"])
def test_not_null_constraint_rejects_missing_required_field(db_session, field):
    data = {
        "title": "Fallo de acceso",
        "description": "El cliente no puede iniciar sesion.",
        "category": "technical_failure",
        "origin": "customer",
        "branch": "central",
    }
    del data[field]
    incident = Incident(**data)
    db_session.add(incident)

    with pytest.raises(IntegrityError):
        db_session.commit()


def test_updated_at_changes_on_modification(db_session):
    incident = _valid_incident()
    db_session.add(incident)
    db_session.commit()
    created_at = incident.created_at
    updated_at_before = incident.updated_at

    incident.status = "in_progress"
    db_session.commit()

    assert incident.created_at == created_at
    assert incident.updated_at >= updated_at_before
