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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import auth, incidents, profiles, suppliers, users

# Sin este basicConfig, logger.info (p. ej. el token de reset que loguea
# routes/auth.py a falta de un proveedor de email) no se ve en la consola de
# `uvicorn main:app`: el logger raiz no tiene handler propio por defecto.
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(name)s: %(message)s")

# Frontends de desarrollo: uis/backoffice (3000) y uis/application (3001).
# En produccion, definir CORS_ORIGINS con los origenes reales separados por comas.
DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000,http://127.0.0.1:3000,"
    "http://localhost:3001,http://127.0.0.1:3001"
)

app = FastAPI(
    title="Nexova API",
    description=(
        "Backend interno de Nexova. **incidents**: analiza CSVs de tickets de "
        "soporte (detecta registros invalidos y calcula metricas; nunca expone "
        "customer_email). **suppliers**: directorio de proveedores con sus "
        "tarifas mensuales por contrato (Spain en EUR, USA en USD). **users** / "
        "**auth** / **profiles**: registro, login (JWT) y perfil de usuarios."
    ),
    version="1.2.0",
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
app.include_router(suppliers.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(profiles.router)
