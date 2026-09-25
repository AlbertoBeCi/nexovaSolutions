"""
Inicializacion de TinyDB para el directorio de proveedores.

TinyDB guarda todo en un unico archivo JSON. La ruta se configura con la
variable de entorno SUPPLIERS_DB_PATH (por defecto services/api/data/suppliers.json,
ignorado por git). Es una base de datos de un solo proceso: suficiente para
desarrollo local y este ejercicio; con varios workers/instancias habria que
migrar a una base de datos real.

TinyDB no es thread-safe y FastAPI ejecuta los endpoints `def` en un
threadpool, asi que toda lectura/escritura se hace bajo `db_lock`.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from tinydb import TinyDB
from tinydb.table import Table

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "data" / "suppliers.json"
SUPPLIERS_TABLE = "suppliers"

db_lock = Lock()
_db: TinyDB | None = None


def utc_now_iso() -> str:
    """Valor de `updated_at`: timestamp ISO 8601 en UTC."""
    return datetime.now(timezone.utc).isoformat()


def get_db_path() -> Path:
    return Path(os.environ.get("SUPPLIERS_DB_PATH", DEFAULT_DB_PATH))


def open_db(path: Path) -> TinyDB:
    """Abre (o crea, con sus carpetas) un archivo TinyDB legible en UTF-8."""
    return TinyDB(
        path,
        create_dirs=True,
        encoding="utf-8",
        ensure_ascii=False,
        indent=2,
    )


def get_db() -> TinyDB:
    global _db
    with db_lock:
        if _db is None:
            _db = open_db(get_db_path())
        return _db


def get_suppliers_table() -> Table:
    """Dependencia FastAPI: tabla de proveedores. Los tests la sustituyen."""
    return get_db().table(SUPPLIERS_TABLE)
