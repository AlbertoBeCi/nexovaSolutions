"""
Motor y sesiones de SQLAlchemy para el gestor de incidencias.

Persistencia en SQLite (ver config.DATABASE_URL). No hay Alembic ni
migraciones formales: `init_db()` crea el esquema con `create_all()` si no
existe, que basta para un modelo con una sola tabla de negocio (ver
README.md, "Decisiones asumidas"). Los tests sustituyen `get_session` por
una sesion sobre una BD SQLite temporal (ver tests/conftest.py), igual que
services/api sustituye sus dependencias de tabla TinyDB en sus tests.
"""
from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import config
from models import Base

_SQLITE_FILE_PREFIX = "sqlite:///"


def _ensure_sqlite_directory(url: str) -> None:
    """SQLite no crea por su cuenta el directorio del archivo (a diferencia
    de TinyDB en services/api, que usa `create_dirs=True`): si la URL es un
    SQLite de archivo, nos aseguramos de que su carpeta exista antes de
    conectar, o `create_engine`/`create_all` fallan con
    'unable to open database file'."""
    if not url.startswith(_SQLITE_FILE_PREFIX):
        return
    db_file = url[len(_SQLITE_FILE_PREFIX) :]
    if db_file in ("", ":memory:"):
        return
    Path(db_file).resolve().parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_directory(config.DATABASE_URL)

# check_same_thread=False: SQLite por defecto solo permite usar una
# conexion desde el hilo que la creo; FastAPI ejecuta los endpoints `def`
# (no `async def`) en un threadpool, igual que TinyDB en services/api.
_connect_args = (
    {"check_same_thread": False} if config.DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(config.DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    """Crea las tablas si no existen. Se llama al arrancar la app (ver
    main.py, lifespan) y desde scripts/seed_incidents.py antes de insertar,
    para que el seed tambien funcione contra una BD nueva."""
    Base.metadata.create_all(bind=engine)


def get_session() -> Generator[Session, None, None]:
    """Dependencia FastAPI: una sesion por request, cerrada al finalizar."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
