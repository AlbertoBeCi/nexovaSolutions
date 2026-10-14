"""Optional PostgreSQL/SQLModel database for inventory, independent of TinyDB."""
from __future__ import annotations

import os
from collections.abc import Generator
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy.engine import Engine, make_url
from sqlmodel import Session, SQLModel, create_engine

import inventory_models  # noqa: F401 - registers inventory tables in SQLModel metadata


def get_database_url() -> str | None:
    return os.environ.get("SUPABASE_DATABASE_URL")


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = get_database_url()
    if not database_url:
        raise RuntimeError("SUPABASE_DATABASE_URL no esta configurada.")
    if database_url.startswith("postgres://"):
        database_url = "postgresql://" + database_url.removeprefix("postgres://")
    url = make_url(database_url)
    # SQLAlchemy versions with psycopg as their default PostgreSQL driver may
    # otherwise choose psycopg 3, although this service installs psycopg2-binary.
    if url.get_backend_name() == "postgresql" and url.drivername == "postgresql":
        url = url.set(drivername="postgresql+psycopg2")
    return create_engine(url, pool_pre_ping=True)


def init_inventory_db() -> None:
    if get_database_url():
        SQLModel.metadata.create_all(get_engine())


def get_inventory_session() -> Generator[Session, None, None]:
    if not get_database_url():
        raise HTTPException(
            status_code=503,
            detail="La base de datos de inventario no esta configurada.",
        )
    with Session(get_engine()) as session:
        yield session


def is_remote_database(database_url: str) -> bool:
    url = make_url(database_url)
    if url.get_backend_name() == "sqlite":
        return False
    return url.host not in {None, "localhost", "127.0.0.1", "::1"}
