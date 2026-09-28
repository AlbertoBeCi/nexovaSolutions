"""
scripts/seed_incidents.py — carga el CSV del analizador de tickets de
soporte (por defecto scripts/incidents-COMPANY.csv) en el gestor de
incidencias (services/incident-manager-api).

Uso (desde la raiz del repo; necesita las dependencias de
services/incident-manager-api, incluida pandas via nexova_shared):

    uv run --project services/incident-manager-api python scripts/seed_incidents.py
    uv run --project services/incident-manager-api python scripts/seed_incidents.py --csv otra/ruta.csv

Es idempotente: ejecutarlo dos veces sobre la misma base de datos no
duplica incidencias (ver la tabla auxiliar seed_ticket_ids, en
services/incident-manager-api/models.py). NUNCA inserta una fila cruda del
CSV: cada fila pasa primero por las 7 reglas de negocio del analizador
(nexova_shared.incidents_analysis.csv_row_violations, LAS MISMAS que usa
scripts/analyze.py) y despues por el mapeo CSV -> Incident
(nexova_shared.csv_mapping.map_csv_row) antes de llegar a la base de datos.

Transformaciones (ver nexova_shared/csv_mapping.py para el detalle):
    - description -> title (primeros 120 caracteres, recortado) y
      description (copiado literal).
    - date (YYYY-MM-DD) -> created_at/updated_at, medianoche UTC.
    - origin siempre "customer", branch siempre "central" (el CSV del
      analizador no distingue sede).
    - status: OPEN->open, CLOSED->resolved, DISCARDED->discarded.
    - category: TECHNICAL/ACCESS->technical_failure,
      BILLING/HR_QUERY->process_error, COMPLAINT->client_complaint.
"""
from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass, field
from pathlib import Path

# Este script vive en scripts/, fuera de packages/shared/ y de
# services/incident-manager-api/: ninguno de los dos esta instalado como
# dependencia del otro (ver packages/shared/README.md, "Uso desde un
# consumidor nuevo"), asi que añadimos ambos a sys.path a mano. Se ejecuta
# con el venv de services/incident-manager-api
# (`uv run --project services/incident-manager-api python scripts/seed_incidents.py`)
# porque es el unico que tiene TODAS las dependencias que hacen falta aqui:
# SQLAlchemy (db.py/models.py) y pandas (via nexova_shared.incidents_analysis).
_REPO_ROOT = Path(__file__).resolve().parent.parent
_INCIDENT_MANAGER_API = _REPO_ROOT / "services" / "incident-manager-api"
_PACKAGES_SHARED = _REPO_ROOT / "packages" / "shared"
for _path in (_INCIDENT_MANAGER_API, _PACKAGES_SHARED):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from nexova_shared.csv_mapping import RowMappingError, map_csv_row, ticket_dedupe_key  # noqa: E402
from nexova_shared.incident_validation import validate_incident_fields  # noqa: E402
from nexova_shared.incidents_analysis import RULE_LABELS, csv_row_violations  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from db import SessionLocal, init_db  # noqa: E402
from models import Incident, SeedTicketId  # noqa: E402

DEFAULT_CSV_PATH = _REPO_ROOT / "scripts" / "incidents-COMPANY.csv"
HEADER_ROW_OFFSET = 2  # la fila 1 del CSV es la cabecera; los datos empiezan en la 2


@dataclass
class SeedReport:
    """Resumen de una ejecucion del seed: leidas / insertadas / duplicadas
    omitidas / descartadas, mas el motivo de cada fila descartada (numero
    de fila + motivo en espanol)."""

    read: int = 0
    inserted: int = 0
    duplicates_skipped: int = 0
    discarded: list[tuple[int, str]] = field(default_factory=list)

    def print_summary(self) -> None:
        print(f"Filas leidas: {self.read}")
        print(f"Insertadas: {self.inserted}")
        print(f"Duplicadas omitidas: {self.duplicates_skipped}")
        print(f"Descartadas: {len(self.discarded)}")
        if self.discarded:
            print("\nMotivo de cada fila descartada:")
            for line_number, reason in self.discarded:
                print(f"  linea {line_number}: {reason}")


def _analyzer_rejection_reason(row: dict) -> str | None:
    """Aplica las 7 reglas de negocio del analizador (las mismas que
    scripts/analyze.py, via csv_row_violations: ver
    packages/shared/nexova_shared/incidents_analysis.py). Devuelve un
    motivo en espanol si la fila es invalida, o None si pasa las 7 reglas."""
    violations = csv_row_violations(row)
    if not violations:
        return None
    labels = ", ".join(RULE_LABELS[name] for name in violations)
    return f"no pasa la validacion del analizador ({labels})"


def run_seed(session: Session, csv_path: Path) -> SeedReport:
    """Logica del seed, separada de main() para poder probarla directamente
    (ver services/incident-manager-api/tests/test_seed.py) sin pasar por
    argparse ni por la salida de consola."""
    report = SeedReport()

    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        rows = list(csv.DictReader(csv_file))

    # Ademas de comprobar seed_ticket_ids (ya cargados en ejecuciones
    # anteriores), llevamos un set de las claves vistas EN ESTE CSV: dos
    # filas del mismo archivo con el mismo ticket_id tambien cuentan como
    # duplicado, no solo entre ejecuciones distintas del seed.
    seen_in_this_run: set[str] = set()

    for line_number, row in enumerate(rows, start=HEADER_ROW_OFFSET):
        report.read += 1

        rejection = _analyzer_rejection_reason(row)
        if rejection is not None:
            report.discarded.append((line_number, rejection))
            continue

        try:
            mapped = map_csv_row(row)
        except RowMappingError as exc:
            report.discarded.append((line_number, str(exc)))
            continue

        dedupe_key = ticket_dedupe_key(row, mapped)

        if dedupe_key in seen_in_this_run:
            report.duplicates_skipped += 1
            continue
        if session.get(SeedTicketId, dedupe_key) is not None:
            report.duplicates_skipped += 1
            continue

        # Defensa en profundidad: aunque CSV_STATUS_MAP/CSV_CATEGORY_MAP
        # (nexova_shared.csv_mapping) solo producen valores permitidos, se
        # revalida con la misma logica que usaria la API antes de insertar,
        # para no depender en silencio de que esas tablas nunca cambien.
        validation_errors = validate_incident_fields(mapped.as_dict())
        if validation_errors:
            reasons = "; ".join(validation_errors.values())
            report.discarded.append(
                (line_number, f"incidencia invalida tras el mapeo: {reasons}")
            )
            continue

        incident = Incident(
            title=mapped.title,
            description=mapped.description,
            category=mapped.category,
            status=mapped.status,
            origin=mapped.origin,
            branch=mapped.branch,
            created_at=mapped.created_at,
            updated_at=mapped.updated_at,
        )
        session.add(incident)
        session.flush()  # asigna incident.id antes de insertar en seed_ticket_ids

        session.add(SeedTicketId(ticket_id=dedupe_key, incident_id=incident.id))
        seen_in_this_run.add(dedupe_key)
        report.inserted += 1

    session.commit()
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Carga el CSV del analizador de tickets en el gestor de incidencias."
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help=f"Ruta al CSV a cargar (por defecto: {DEFAULT_CSV_PATH}).",
    )
    args = parser.parse_args()

    if not args.csv.exists():
        print(f"Error: el archivo '{args.csv}' no existe.")
        sys.exit(1)

    init_db()  # crea las tablas si no existen (BD nueva en un checkout limpio)
    session = SessionLocal()
    try:
        report = run_seed(session, args.csv)
    finally:
        session.close()

    report.print_summary()


if __name__ == "__main__":
    main()
