"""State control and persistence for background jobs (`job_runs` table).

Implements the canonical state machine:
    pending -> processing -> completed
                          \\-> failed

Key rules (Ticket #DEV-53):
- Completely independent of FastAPI; never imports or runs FastAPI app code.
- `processing` status acts as the distributed lock (no separate lock table/column).
- Idempotency is scoped by `(job_name, target_date)` with `status = 'completed'`.
- Any unhandled exception during a run must transition the row to `failed` with
  `error_message` populated so no row remains zombie in `processing`.
"""
from __future__ import annotations

import logging
import os
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Any, Generator

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Index,
    MetaData,
    Table,
    Text,
    create_engine,
    insert,
    select,
    update,
)
from sqlalchemy.engine import Connection, Engine, make_url

JOB_STATUSES = ("pending", "processing", "completed", "failed")
DEFAULT_JOB_NAME = "nightly_export"

logger = logging.getLogger("services.job_runner")

job_runs_metadata = MetaData()

job_runs_table = Table(
    "job_runs",
    job_runs_metadata,
    Column("id", Text, primary_key=True),
    Column("job_name", Text, nullable=False),
    Column("target_date", Date, nullable=False),
    Column("status", Text, nullable=False),
    Column("started_at", DateTime(timezone=True), nullable=True),
    Column("finished_at", DateTime(timezone=True), nullable=True),
    Column("error_message", Text, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    CheckConstraint(
        "status IN ('pending', 'processing', 'completed', 'failed')",
        name="ck_job_runs_status",
    ),
    Index("ix_job_runs_job_name_target_date", "job_name", "target_date"),
    Index("ix_job_runs_job_name_status", "job_name", "status"),
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_date(value: date | str) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise TypeError("target_date debe ser date o cadena YYYY-MM-DD.")


def _normalize_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return None


def _row_to_dict(row: Any) -> dict[str, Any]:
    mapping = dict(row._mapping if hasattr(row, "_mapping") else row)
    target = mapping.get("target_date")
    if isinstance(target, str):
        target = date.fromisoformat(target)
    return {
        "id": str(mapping["id"]),
        "job_name": str(mapping["job_name"]),
        "target_date": target,
        "status": str(mapping["status"]),
        "started_at": _normalize_dt(mapping.get("started_at")),
        "finished_at": _normalize_dt(mapping.get("finished_at")),
        "error_message": mapping.get("error_message"),
        "created_at": _normalize_dt(mapping.get("created_at")),
    }


def resolve_database_url(database_url: str | None = None) -> str:
    """Resolve the database URL from explicit argument or environment variables."""
    url = (
        database_url
        or os.getenv("JOB_RUNNER_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DATABASE_URL")
        or os.getenv("REPORTING_DATABASE_URL")
    )
    if not url:
        raise RuntimeError(
            "Configura SUPABASE_DATABASE_URL (o DATABASE_URL / JOB_RUNNER_DATABASE_URL) para job_runs."
        )
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    parsed = make_url(url)
    if parsed.get_backend_name() == "postgresql" and parsed.drivername == "postgresql":
        parsed = parsed.set(drivername="postgresql+psycopg2")
    return parsed.render_as_string(hide_password=False)


def create_job_engine(database_url: str | None = None) -> Engine:
    """Create a standalone SQLAlchemy engine for job state operations."""
    return create_engine(resolve_database_url(database_url), pool_pre_ping=True, future=True)


def init_job_runs_db(engine_or_conn: Engine | Connection) -> None:
    """Ensure the `job_runs` table and its indices exist."""
    job_runs_metadata.create_all(engine_or_conn)


@contextmanager
def _connection_scope(
    db: Engine | Connection | None = None,
    *,
    transactional: bool = False,
) -> Generator[Connection, None, None]:
    if isinstance(db, Connection):
        if transactional and not db.in_transaction():
            with db.begin():
                yield db
        else:
            yield db
        return

    owns_engine = db is None
    engine = create_job_engine() if db is None else db
    try:
        if transactional:
            with engine.begin() as conn:
                yield conn
        else:
            with engine.connect() as conn:
                yield conn
    finally:
        if owns_engine:
            engine.dispose()


def has_processing_lock(
    job_name: str = DEFAULT_JOB_NAME,
    *,
    db: Engine | Connection | None = None,
) -> bool:
    """Return True if a row in `job_runs` currently has `status = 'processing'` for `job_name`.

    The `processing` state itself is the distributed lock.
    """
    stmt = (
        select(job_runs_table.c.id)
        .where(
            job_runs_table.c.job_name == job_name,
            job_runs_table.c.status == "processing",
        )
        .limit(1)
    )
    with _connection_scope(db, transactional=False) as conn:
        row = conn.execute(stmt).first()
        return row is not None


def has_completed_for_date(
    job_name: str,
    target_date: date | str,
    *,
    db: Engine | Connection | None = None,
) -> bool:
    """Return True if `(job_name, target_date)` already has a `completed` record in `job_runs`."""
    resolved_date = _coerce_date(target_date)
    stmt = (
        select(job_runs_table.c.id)
        .where(
            job_runs_table.c.job_name == job_name,
            job_runs_table.c.target_date == resolved_date,
            job_runs_table.c.status == "completed",
        )
        .limit(1)
    )
    with _connection_scope(db, transactional=False) as conn:
        row = conn.execute(stmt).first()
        return row is not None


def create_job_run(
    job_name: str,
    target_date: date | str,
    *,
    status: str = "pending",
    db: Engine | Connection | None = None,
) -> dict[str, Any]:
    """Insert a new `job_runs` record (defaults to `pending`)."""
    if status not in JOB_STATUSES:
        raise ValueError(f"Estado invalido para job_runs: {status}")
    resolved_date = _coerce_date(target_date)
    now = _utc_now()
    job_id = str(uuid.uuid4())
    values: dict[str, Any] = {
        "id": job_id,
        "job_name": job_name,
        "target_date": resolved_date,
        "status": status,
        "started_at": now if status == "processing" else None,
        "finished_at": now if status in {"completed", "failed"} else None,
        "error_message": None,
        "created_at": now,
    }
    with _connection_scope(db, transactional=True) as conn:
        conn.execute(insert(job_runs_table).values(**values))
    return _row_to_dict(values)


def update_job_status(
    job_id: str,
    status: str,
    *,
    error_message: str | None = None,
    db: Engine | Connection | None = None,
) -> dict[str, Any]:
    """Update a `job_runs` row to `processing`, `completed`, or `failed`."""
    if status not in JOB_STATUSES:
        raise ValueError(f"Estado invalido para job_runs: {status}")
    now = _utc_now()
    updates: dict[str, Any] = {"status": status}
    if status == "processing":
        updates["started_at"] = now
        updates["finished_at"] = None
        updates["error_message"] = None
    elif status == "completed":
        updates["finished_at"] = now
        updates["error_message"] = None
    elif status == "failed":
        updates["finished_at"] = now
        updates["error_message"] = error_message or "Unknown error"

    with _connection_scope(db, transactional=True) as conn:
        result = conn.execute(
            update(job_runs_table)
            .where(job_runs_table.c.id == str(job_id))
            .values(**updates)
        )
        if result.rowcount == 0:
            raise LookupError(f"No existe el registro job_runs con id={job_id}")
        row = conn.execute(
            select(job_runs_table).where(job_runs_table.c.id == str(job_id))
        ).first()
    if row is None:
        raise LookupError(f"No existe el registro job_runs con id={job_id}")
    return _row_to_dict(row)


def mark_job_processing(
    job_id: str,
    *,
    db: Engine | Connection | None = None,
) -> dict[str, Any]:
    """Transition a `pending` job run to `processing` (acquires the distributed lock)."""
    return update_job_status(job_id, "processing", db=db)


def mark_job_completed(
    job_id: str,
    *,
    db: Engine | Connection | None = None,
) -> dict[str, Any]:
    """Transition a `processing` job run to `completed` (releases the lock)."""
    return update_job_status(job_id, "completed", db=db)


def mark_job_failed(
    job_id: str,
    error_message: str,
    *,
    db: Engine | Connection | None = None,
) -> dict[str, Any]:
    """Transition a job run to `failed` with `error_message` (releases the lock)."""
    return update_job_status(job_id, "failed", error_message=error_message, db=db)


def get_job_run(
    job_id: str,
    *,
    db: Engine | Connection | None = None,
) -> dict[str, Any] | None:
    """Fetch a single `job_runs` record by ID."""
    stmt = select(job_runs_table).where(job_runs_table.c.id == str(job_id))
    with _connection_scope(db, transactional=False) as conn:
        row = conn.execute(stmt).first()
        return _row_to_dict(row) if row is not None else None


def list_job_runs(
    job_name: str | None = None,
    target_date: date | str | None = None,
    status: str | None = None,
    *,
    db: Engine | Connection | None = None,
) -> list[dict[str, Any]]:
    """Query `job_runs` rows filtered by optional `job_name`, `target_date`, and `status`."""
    stmt = select(job_runs_table)
    if job_name is not None:
        stmt = stmt.where(job_runs_table.c.job_name == job_name)
    if target_date is not None:
        stmt = stmt.where(job_runs_table.c.target_date == _coerce_date(target_date))
    if status is not None:
        stmt = stmt.where(job_runs_table.c.status == status)
    stmt = stmt.order_by(job_runs_table.c.created_at.asc())
    with _connection_scope(db, transactional=False) as conn:
        rows = conn.execute(stmt).fetchall()
        return [_row_to_dict(row) for row in rows]
