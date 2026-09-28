"""
Modelo ORM (SQLAlchemy 2.0) del gestor de incidencias.

Las restricciones de negocio (valores permitidos de category/status/
origin/branch) se aplican en DOS capas, como pide el prompt: aqui, a nivel
de base de datos (CHECK constraints, generados desde las mismas constantes
de nexova_shared.incident_constants para que nunca puedan divergir de la
validacion de aplicacion); y en routes/incidents.py, a nivel de aplicacion,
via nexova_shared.incident_validation.validate_incident() (que da errores
por campo en espanol antes de llegar a intentar el INSERT).
"""
from __future__ import annotations

import shared_bootstrap  # noqa: F401  (efecto: agrega packages/shared a sys.path)
from datetime import datetime, timezone

from nexova_shared.incident_constants import (
    BRANCHES,
    CATEGORIES,
    DEFAULT_STATUS,
    ORIGINS,
    STATUSES,
)
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator


def utc_now() -> datetime:
    """Valor de created_at/updated_at: datetime consciente de zona horaria (UTC)."""
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """DateTime consciente de zona horaria en Python, almacenado como UTC
    "naive" en la columna (SQLite no tiene un tipo de fecha con offset
    real: un `DateTime(timezone=True)` a secas se guarda y se LEE de
    vuelta como naive, perdiendo el `tzinfo` -comprobado manualmente: un
    datetime UTC-aware escrito, al recuperarlo, vuelve con
    `tzinfo=None`-. Este TypeDecorator exige un valor consciente de zona
    horaria al escribir (lo convierte a UTC) y reasigna `tzinfo=UTC` al
    leer, para que created_at/updated_at sean siempre UTC-aware en Python
    y se sirvan en la API con el sufijo `+00:00`."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Los datetimes de Incident deben ser conscientes de zona horaria (UTC).")
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)


class Base(DeclarativeBase):
    pass


def _enum_check(column: str, values: tuple[str, ...]) -> CheckConstraint:
    """CHECK constraint de SQLite: `column IN ('a', 'b', ...)`, generado a
    partir de las constantes de nexova_shared (una sola fuente de verdad
    para los valores permitidos, tanto en la app como en la BD)."""
    quoted = ", ".join(f"'{value}'" for value in values)
    return CheckConstraint(f"{column} IN ({quoted})", name=f"ck_incidents_{column}")


class Incident(Base):
    """Una incidencia del gestor centralizado.

    No confundir con una fila del CSV del analizador de tickets de soporte
    (shared/incidents_analysis.py): son dos dominios distintos que
    comparten monorepo pero no modelo. scripts/seed_incidents.py es el
    puente entre ambos (ver packages/shared/nexova_shared/csv_mapping.py).
    """

    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint("length(trim(title)) > 0", name="ck_incidents_title_not_blank"),
        CheckConstraint(
            "length(trim(description)) > 0", name="ck_incidents_description_not_blank"
        ),
        _enum_check("category", CATEGORIES),
        _enum_check("status", STATUSES),
        _enum_check("origin", ORIGINS),
        _enum_check("branch", BRANCHES),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # Indices en status/origin/branch/category: filtrar por cualquiera de
    # ellos (incluido category='sla_breach', ver GET /api/incidents) es
    # trivial y usa el indice en vez de un table scan.
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=DEFAULT_STATUS, server_default=DEFAULT_STATUS, index=True
    )
    origin: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    branch: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # Sin default= aqui: se asignan juntos en _set_incident_timestamps
    # (evento before_insert), para que created_at == updated_at al crear
    # una incidencia (dos defaults independientes podrian diferir por
    # microsegundos entre columna y columna).
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, onupdate=utc_now)


class SeedTicketId(Base):
    """Registro de idempotencia de scripts/seed_incidents.py: cada
    ticket_id (o clave de respaldo `title + created_at` cuando el CSV no
    trae ticket_id) ya cargado por el seed. El ticket_id NUNCA se guarda en
    Incident (ver el prompt original): esta tabla auxiliar es el unico
    lugar donde vive, exclusivamente para que una segunda ejecucion del
    seed no duplique incidencias."""

    __tablename__ = "seed_ticket_ids"

    ticket_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    incident_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("incidents.id"), nullable=False
    )
    loaded_at: Mapped[datetime] = mapped_column(UTCDateTime(), nullable=False, default=utc_now)


@event.listens_for(Incident, "before_insert")
def _set_incident_timestamps(mapper, connection, target: Incident) -> None:
    """Asigna created_at/updated_at al mismo instante exacto al insertar
    (ver el comentario junto a esas columnas): un unico event listener en
    vez de dos `default=utc_now` independientes."""
    now = utc_now()
    if target.created_at is None:
        target.created_at = now
    if target.updated_at is None:
        target.updated_at = now
