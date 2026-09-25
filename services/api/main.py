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

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import incidents, suppliers

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
        "tarifas mensuales por contrato (Spain en EUR, USA en USD)."
    ),
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(incidents.router)
app.include_router(suppliers.router)
