"""Fixtures compartidas: un motor SQLite temporal por test, con las tablas
recien creadas, y un TestClient que usa esa BD via override de get_session."""
from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from db import get_session
from main import app
from models import Base


@pytest.fixture
def db_engine(tmp_path):
    """Motor SQLite sobre un archivo temporal (no en memoria: asi el
    comportamiento de tipos/constraints es identico al de produccion, y
    varias conexiones -como hace TestClient- ven los mismos datos)."""
    db_path = tmp_path / "test_incidents.db"
    engine = create_engine(
        f"sqlite:///{db_path.as_posix()}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Generator[Session, None, None]:
    SessionLocal = sessionmaker(bind=db_engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_engine) -> Generator[TestClient, None, None]:
    SessionLocal = sessionmaker(bind=db_engine, autoflush=False, autocommit=False)

    def _override_get_session() -> Generator[Session, None, None]:
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = _override_get_session
    try:
        # raise_server_exceptions=False: queremos inspeccionar la respuesta
        # 500 que arma errors.handle_unexpected_error (ver test_api.py), no
        # que pytest reciba la excepcion original sin envolver. En este
        # starlette, ese flag solo se puede fijar en el constructor: no
        # tiene efecto asignarlo despues sobre el cliente ya creado.
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.pop(get_session, None)


@pytest.fixture
def valid_payload() -> dict:
    return {
        "title": "Fallo de acceso al portal",
        "description": "El cliente no puede iniciar sesion desde ayer.",
        "category": "technical_failure",
        "origin": "customer",
        "branch": "central",
    }


@pytest.fixture
def create_incident(client: TestClient, valid_payload: dict):
    """Factory fixture: `create_incident(**overrides)` hace POST
    /api/incidents con `valid_payload` mas los overrides indicados, y
    devuelve el recurso creado (falla el test si la API no responde 201)."""

    def _create(**overrides) -> dict:
        payload = {**valid_payload, **overrides}
        response = client.post("/api/incidents", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _create
