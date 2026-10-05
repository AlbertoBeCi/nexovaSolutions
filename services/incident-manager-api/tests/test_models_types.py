"""UTCDateTime, defaults de columna, indices, SeedTicketId y el listener
before_insert, que test_models.py no cubre."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from models import Incident, SeedTicketId, UTCDateTime


def _incident(**overrides) -> Incident:
    data = {
        "title": "Fallo",
        "description": "Detalle",
        "category": "other",
        "origin": "internal",
        "branch": "remote",
    }
    data.update(overrides)
    return Incident(**data)


# ─── UTCDateTime ────────────────────────────────────────────────────────


def test_utc_datetime_rejects_naive_values_on_write():
    with pytest.raises(ValueError, match="zona horaria"):
        UTCDateTime().process_bind_param(datetime(2025, 1, 1), None)


def test_utc_datetime_converts_other_timezones_to_utc_naive():
    plus_two = timezone(timedelta(hours=2))

    stored = UTCDateTime().process_bind_param(datetime(2025, 1, 1, 12, 0, tzinfo=plus_two), None)

    assert stored == datetime(2025, 1, 1, 10, 0)
    assert stored.tzinfo is None


def test_utc_datetime_restores_utc_on_read():
    value = UTCDateTime().process_result_value(datetime(2025, 1, 1, 10, 0), None)

    assert value.tzinfo == timezone.utc


@pytest.mark.parametrize("method", ["process_bind_param", "process_result_value"])
def test_utc_datetime_passes_none_through(method: str):
    assert getattr(UTCDateTime(), method)(None, None) is None


def test_persisted_datetimes_come_back_utc_aware(db_session):
    incident = _incident()
    db_session.add(incident)
    db_session.commit()
    db_session.expire_all()

    loaded = db_session.get(Incident, incident.id)

    assert loaded.created_at.tzinfo == timezone.utc
    assert loaded.updated_at.tzinfo == timezone.utc


def test_assigning_naive_datetime_fails_on_flush(db_session):
    db_session.add(_incident(created_at=datetime(2025, 1, 1)))

    with pytest.raises(Exception, match="zona horaria"):
        db_session.commit()


# ─── Listener before_insert y timestamps ────────────────────────────────


def test_before_insert_sets_identical_timestamps(db_session):
    incident = _incident()
    db_session.add(incident)
    db_session.commit()

    assert incident.created_at == incident.updated_at


def test_explicit_timestamps_are_respected_on_insert(db_session):
    created = datetime(2024, 5, 17, tzinfo=timezone.utc)
    incident = _incident(created_at=created, updated_at=created)
    db_session.add(incident)
    db_session.commit()
    db_session.expire_all()

    loaded = db_session.get(Incident, incident.id)

    assert loaded.created_at == created
    assert loaded.updated_at == created


def test_update_refreshes_updated_at_but_not_created_at(db_session):
    incident = _incident()
    db_session.add(incident)
    db_session.commit()
    created, first_update = incident.created_at, incident.updated_at

    incident.status = "in_progress"
    db_session.commit()

    assert incident.created_at == created
    assert incident.updated_at > first_update


# ─── Defaults, indices y tablas auxiliares ──────────────────────────────


def test_status_server_default_is_open_for_raw_inserts(db_engine):
    with db_engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO incidents (title, description, category, origin, branch, "
            "created_at, updated_at) VALUES ('t', 'd', 'other', 'internal', 'remote', "
            "'2025-01-01 00:00:00', '2025-01-01 00:00:00')"
        ))
        status = conn.execute(text("SELECT status FROM incidents")).scalar_one()

    assert status == "open"


def test_filterable_columns_are_indexed(db_engine):
    indexed = {
        column
        for index in inspect(db_engine).get_indexes("incidents")
        for column in index["column_names"]
    }

    assert {"category", "status", "origin", "branch"} <= indexed


def test_seed_ticket_id_links_to_an_incident(db_session):
    incident = _incident()
    db_session.add(incident)
    db_session.commit()

    db_session.add(SeedTicketId(ticket_id="TCK-1", incident_id=incident.id))
    db_session.commit()

    assert db_session.get(SeedTicketId, "TCK-1").incident_id == incident.id


def test_seed_ticket_id_primary_key_is_unique(db_session):
    incident = _incident()
    db_session.add(incident)
    db_session.commit()
    db_session.add(SeedTicketId(ticket_id="TCK-1", incident_id=incident.id))
    db_session.commit()

    db_session.add(SeedTicketId(ticket_id="TCK-1", incident_id=incident.id))

    with pytest.raises(IntegrityError):
        db_session.commit()
