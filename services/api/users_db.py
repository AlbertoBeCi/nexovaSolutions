"""
Inicializacion de TinyDB para usuarios y perfiles (autenticacion).

Fichero propio (no el de proveedores): USERS_DB_PATH, por defecto
services/api/data/users.json, ignorado por git. Lock propio porque es un
TinyDB distinto al de suppliers y TinyDB no es thread-safe.
"""
from __future__ import annotations

import os
from pathlib import Path
from threading import Lock
from typing import Annotated

from fastapi import Depends
from tinydb import TinyDB
from tinydb.table import Table

from database import open_db

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "data" / "users.json"
USERS_TABLE = "users"
PROFILES_TABLE = "profiles"

users_db_lock = Lock()
_db: TinyDB | None = None


def get_users_db_path() -> Path:
    return Path(os.environ.get("USERS_DB_PATH", DEFAULT_DB_PATH))


def get_users_db() -> TinyDB:
    global _db
    with users_db_lock:
        if _db is None:
            _db = open_db(get_users_db_path())
        return _db


def get_users_table() -> Table:
    """Dependencia FastAPI: tabla de usuarios. Los tests la sustituyen."""
    return get_users_db().table(USERS_TABLE)


def get_profiles_table() -> Table:
    """Dependencia FastAPI: tabla de perfiles. Los tests la sustituyen."""
    return get_users_db().table(PROFILES_TABLE)


# Alias de tipo compartidos: routes/users.py, routes/profiles.py, routes/auth.py
# y security.py inyectan las tablas asi.
UsersTable = Annotated[Table, Depends(get_users_table)]
ProfilesTable = Annotated[Table, Depends(get_profiles_table)]
