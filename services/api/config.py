"""
Configuracion de autenticacion cargada desde variables de entorno (.env).

`.env` vive en services/api/ y nunca se commitea (ver services/api/.gitignore).
`.env.example` documenta las variables sin valores reales.

SECRET_KEY tiene un valor de desarrollo por defecto (con warning en el log) para
que `uv run pytest` funcione en un checkout limpio sin `.env`: nunca debe usarse
en produccion, donde hay que definir SECRET_KEY explicitamente.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger("config")

load_dotenv(Path(__file__).resolve().parent / ".env")

_DEV_SECRET_KEY = "dev-only-secret-key-nunca-usar-en-produccion"

SECRET_KEY = os.environ.get("SECRET_KEY", _DEV_SECRET_KEY)
if SECRET_KEY == _DEV_SECRET_KEY:
    logger.warning(
        "SECRET_KEY no esta definida en el entorno: usando una clave de "
        "desarrollo. Define SECRET_KEY en services/api/.env antes de desplegar."
    )

ALGORITHM = os.environ.get("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
