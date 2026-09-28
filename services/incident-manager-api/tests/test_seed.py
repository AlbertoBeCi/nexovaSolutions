"""Tests de scripts/seed_incidents.py: conteos esperados sobre el CSV real,
idempotencia, filas invalidas/no mapeables no insertadas, y los mapeos
CSV -> Incident.

scripts/ no es un proyecto uv (es un script suelto, ver scripts/README.md):
este archivo se ejecuta con el venv de services/incident-manager-api (el
unico con TODAS las dependencias que run_seed() necesita: SQLAlchemy +
pandas via nexova_shared), asi que importa scripts/seed_incidents.py
añadiendolo a sys.path a mano, igual que hace el propio script."""
from __future__ import annotations

import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCRIPTS_DIR = _REPO_ROOT / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from seed_incidents import DEFAULT_CSV_PATH, run_seed  # noqa: E402

from models import Incident, SeedTicketId  # noqa: E402

CSV_FIELDNAMES = [
    "ticket_id", "date", "client_company", "category", "description",
    "agent_id", "status", "customer_email", "satisfaction_score",
]

VALID_ROW = {
    "ticket_id": "NXV-000001",
    "date": "2026-08-15",
    "client_company": "Acme Corp",
    "category": "TECHNICAL",
    "description": "Cliente reporta incidencia de tipo technical en el sistema.",
    "agent_id": "AGT-01",
    "status": "OPEN",
    "customer_email": "cliente@acme.test",
    "satisfaction_score": "",
}


def _write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


# ─── Sobre el CSV real (scripts/incidents-COMPANY.csv) ───────────────────


def test_run_seed_against_real_csv_matches_expected_counts(db_session):
    report = run_seed(db_session, DEFAULT_CSV_PATH)

    assert report.read == 100
    assert report.inserted == 96
    assert report.duplicates_skipped == 0
    assert len(report.discarded) == 4

    incidents = db_session.query(Incident).all()
    assert len(incidents) == 96

    status_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    for incident in incidents:
        status_counts[incident.status] = status_counts.get(incident.status, 0) + 1
        category_counts[incident.category] = category_counts.get(incident.category, 0) + 1

    assert status_counts == {"open": 27, "resolved": 56, "discarded": 13}
    assert category_counts["technical_failure"] == 49
    assert category_counts["process_error"] == 35
    assert category_counts["client_complaint"] == 12

    assert all(incident.origin == "customer" for incident in incidents)
    assert all(incident.branch == "central" for incident in incidents)
    assert all(incident.created_at.tzinfo is not None for incident in incidents)
    assert all(
        incident.created_at.hour == 0 and incident.created_at.minute == 0
        for incident in incidents
    )


def test_run_seed_is_idempotent(db_session):
    first = run_seed(db_session, DEFAULT_CSV_PATH)
    second = run_seed(db_session, DEFAULT_CSV_PATH)

    assert first.inserted == 96
    assert second.inserted == 0
    assert second.duplicates_skipped == 96

    assert db_session.query(Incident).count() == 96
    assert db_session.query(SeedTicketId).count() == 96


# ─── Sobre CSVs pequenos a medida, para casos concretos ──────────────────


def test_run_seed_discards_row_failing_analyzer_rules(db_session, tmp_path):
    bad_row = {**VALID_ROW, "client_company": ""}
    csv_path = tmp_path / "custom.csv"
    _write_csv(csv_path, [bad_row])

    report = run_seed(db_session, csv_path)

    assert report.inserted == 0
    assert len(report.discarded) == 1
    assert db_session.query(Incident).count() == 0


def test_run_seed_discards_row_with_unmappable_status(db_session, tmp_path):
    bad_row = {**VALID_ROW, "status": "PENDING"}
    csv_path = tmp_path / "custom.csv"
    _write_csv(csv_path, [bad_row])

    report = run_seed(db_session, csv_path)

    assert report.inserted == 0
    assert len(report.discarded) == 1


def test_run_seed_discards_row_with_invalid_date(db_session, tmp_path):
    bad_row = {**VALID_ROW, "date": "15/08/2026"}
    csv_path = tmp_path / "custom.csv"
    _write_csv(csv_path, [bad_row])

    report = run_seed(db_session, csv_path)

    assert report.inserted == 0
    assert len(report.discarded) == 1


def test_run_seed_discards_row_with_empty_description(db_session, tmp_path):
    bad_row = {**VALID_ROW, "description": "abc"}  # >=5 chars: pasa el analizador...
    # ...pero queda vacia tras recortar a 120 y strip solo si es puro espacio;
    # usamos una description de puros espacios largos para forzar el caso.
    bad_row["description"] = " " * 10
    csv_path = tmp_path / "custom.csv"
    _write_csv(csv_path, [bad_row])

    report = run_seed(db_session, csv_path)

    # Las 7 reglas del analizador ya descartan una description tan corta
    # (short_description exige >= 5 caracteres tras strip), asi que esta
    # fila se descarta en el primer paso, no en el mapeo.
    assert report.inserted == 0
    assert len(report.discarded) == 1


def test_run_seed_maps_fields_correctly_for_a_single_row(db_session, tmp_path):
    csv_path = tmp_path / "custom.csv"
    _write_csv(csv_path, [VALID_ROW])

    report = run_seed(db_session, csv_path)

    assert report.inserted == 1
    incident = db_session.query(Incident).one()
    assert incident.title == VALID_ROW["description"]
    assert incident.description == VALID_ROW["description"]
    assert incident.category == "technical_failure"  # TECHNICAL -> technical_failure
    assert incident.status == "open"  # OPEN -> open
    assert incident.origin == "customer"
    assert incident.branch == "central"
    assert incident.created_at == datetime(2026, 8, 15, tzinfo=timezone.utc)
    assert incident.updated_at == incident.created_at


def test_run_seed_dedupes_within_same_csv_by_ticket_id(db_session, tmp_path):
    csv_path = tmp_path / "custom.csv"
    _write_csv(csv_path, [VALID_ROW, VALID_ROW])  # mismo ticket_id, dos veces

    report = run_seed(db_session, csv_path)

    assert report.inserted == 1
    assert report.duplicates_skipped == 1
    assert db_session.query(Incident).count() == 1


def test_run_seed_fallback_key_without_ticket_id(db_session, tmp_path):
    row_without_ticket = {**VALID_ROW, "ticket_id": ""}
    csv_path = tmp_path / "custom.csv"
    _write_csv(csv_path, [row_without_ticket, row_without_ticket])

    report = run_seed(db_session, csv_path)

    # Sin ticket_id, la clave de respaldo (title + created_at) sigue
    # detectando el duplicado dentro del mismo CSV.
    assert report.inserted == 1
    assert report.duplicates_skipped == 1
