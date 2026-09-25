"""
Almacen en memoria del ultimo resultado de analisis.

Deliberadamente simple: una variable de proceso, sin base de datos ni
disco. Suficiente para un solo proceso/instancia (por ejemplo, desarrollo
local con `uvicorn main:app`). Si el servicio se reinicia, o corre con
varios workers/instancias detras de un balanceador, el resultado no se
comparte entre ellos: seria necesario un store externo (Redis, DB, etc.)
para ese caso, fuera del alcance de este ejercicio.
"""
from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock

_lock = Lock()
_last_result: dict | None = None


def set_last_result(summary: dict) -> None:
    global _last_result
    with _lock:
        _last_result = {
            **summary,
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }


def get_last_result() -> dict | None:
    with _lock:
        return _last_result
