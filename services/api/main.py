"""
API de Nexova: un solo backend FastAPI con un router por dominio.

- /api/incidents: analisis de CSVs de tickets de soporte (routes/incidents.py).
- /suppliers: directorio de proveedores persistido en TinyDB (routes/suppliers.py).

Ejecutar en desarrollo (desde services/api):
    uv sync
    uv run uvicorn main:app --reload --port 8000

Documentacion interactiva (Swagger UI) una vez arrancado:
    http://localhost:8000/docs
"""
from __future__ import annotations

import logging
import os
from time import perf_counter
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from inventory_database import init_inventory_db
from routes import auth, incidents, inventory, profiles, suppliers, users

# Sin este basicConfig, logger.info (p. ej. el token de reset que loguea
# routes/auth.py a falta de un proveedor de email) no se ve en la consola de
# `uvicorn main:app`: el logger raiz no tiene handler propio por defecto.
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(name)s: %(message)s")

logger = logging.getLogger("main")

# Frontends de desarrollo: uis/backoffice (3000) y uis/application (3001).
# En produccion, definir CORS_ORIGINS con los origenes reales separados por comas.
DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000,http://127.0.0.1:3000,"
    "http://localhost:3001,http://127.0.0.1:3001"
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inventory is optional in a clean checkout: existing TinyDB routes stay
    # available without a Supabase URL. When configured, create the ORM tables.
    init_inventory_db()
    yield


app = FastAPI(
    title="Nexova API",
    description=(
        "Backend interno de Nexova. **incidents**: analiza CSVs de tickets de "
        "soporte (detecta registros invalidos y calcula metricas; nunca expone "
        "customer_email). **suppliers**: directorio de proveedores con sus "
        "tarifas mensuales por contrato (Spain en EUR, USA en USD). **users** / "
        "**auth** / **profiles**: registro, login (JWT) y perfil de usuarios. "
        "**inventory**: activos y órdenes sobre PostgreSQL/Supabase."
    ),
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(incidents.router)
app.include_router(inventory.router)
app.include_router(suppliers.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(profiles.router)


@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    """Log request timing without query strings, credentials, or request bodies."""
    if os.environ.get("API_REQUEST_TIMING_ENABLED", "true").lower() not in {"1", "true", "yes", "on"}:
        return await call_next(request)

    started_at = perf_counter()
    response = await call_next(request)
    duration_ms = (perf_counter() - started_at) * 1000
    logger.info(
        "http_request method=%s path=%s status=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Red de seguridad para cualquier excepcion no controlada (auditoria de
    manejo de errores): por defecto, sin este handler, no queda ningun log
    propio del servicio con contexto de la request (solo lo que uvicorn
    decida imprimir al re-lanzar la excepcion), y si algun dia `debug=True`
    se activa por error, Starlette devolveria el traceback completo al
    cliente. El detalle real de la excepcion SOLO va al logger; el cliente
    siempre recibe el mismo mensaje generico, en el mismo formato
    {"detail": "..."} que ya usa el resto de esta API."""
    logger.exception("Error interno no controlado en %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Ha ocurrido un error interno. Intentalo de nuevo mas tarde."},
    )
