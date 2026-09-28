"""
Gestor de Incidencias Centralizado de Nexova: modelo persistente (SQLite),
API REST bajo /api/incidents y seed desde el CSV del analizador de tickets
de soporte (scripts/seed_incidents.py).

Servicio FastAPI independiente de services/api/ (excepcion documentada a la
convencion de AGENTS.md de "una sola app FastAPI": ver README.md,
"Decisiones asumidas").

Ejecutar en desarrollo (desde services/incident-manager-api):
    uv sync
    uv run serve

Documentacion interactiva (Swagger UI) una vez arrancado:
    http://localhost:8001/docs
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

import config
from db import init_db
from errors import (
    ApiError,
    handle_api_error,
    handle_http_error,
    handle_unexpected_error,
    handle_validation_error,
)
from routes import incidents

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crea las tablas si no existen (ver db.init_db: sin Alembic, es una
    # sola tabla de negocio). Idempotente: create_all no toca tablas que ya
    # existen, asi que arrancar el servicio varias veces es seguro.
    init_db()
    yield


app = FastAPI(
    title="Nexova — Gestor de Incidencias",
    description=(
        "Gestor centralizado de incidencias de Nexova: alta, listado con "
        "filtros, resumen agregado por estado/categoria/origen/sede, y "
        "cambio de estado con validacion de transiciones."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

# Formato de error uniforme (ver errors.py): toda excepcion, controlada o
# no, se responde como {"error": {"code", "message", "fields"?}}.
app.add_exception_handler(ApiError, handle_api_error)
app.add_exception_handler(RequestValidationError, handle_validation_error)
app.add_exception_handler(StarletteHTTPException, handle_http_error)
app.add_exception_handler(Exception, handle_unexpected_error)

app.include_router(incidents.router)


def run() -> None:
    """Punto de entrada de `uv run serve` (ver pyproject.toml)."""
    import uvicorn

    uvicorn.run("main:app", host=config.API_HOST, port=config.API_PORT, reload=False)


if __name__ == "__main__":
    run()
