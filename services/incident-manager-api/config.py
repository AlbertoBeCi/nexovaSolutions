"""
Configuracion del gestor de incidencias, cargada desde variables de entorno
(.env). `.env` vive en services/incident-manager-api/ y nunca se commitea
(ver .gitignore); `.env.example` documenta las variables sin valores reales.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

_DEFAULT_DB_PATH = Path(__file__).resolve().parent / "data" / "incidents.db"
DATABASE_URL = os.environ.get(
    "INCIDENTS_DATABASE_URL", f"sqlite:///{_DEFAULT_DB_PATH.as_posix()}"
)

API_HOST = os.environ.get("API_HOST", "0.0.0.0")
API_PORT = int(os.environ.get("API_PORT", "8001"))

# Frontends de desarrollo: uis/backoffice (3000) y uis/application (3001),
# mismo valor por defecto que services/api/main.py.
DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000,http://127.0.0.1:3000,"
    "http://localhost:3001,http://127.0.0.1:3001"
)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]
