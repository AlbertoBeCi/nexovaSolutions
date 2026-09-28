"""
Rate limiting en memoria para endpoints sensibles a fuerza bruta/abuso
(forgot-password, reset-password). Ventana deslizante simple: un dict
{clave: [timestamps]} protegido por un lock, mismo patron que store.py.
Sin dependencia nueva.

Limitacion conocida: no se comparte entre workers/instancias (un solo
proceso), igual que TinyDB y store.py en el resto de este servicio.
"""
from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException

_lock = Lock()
_attempts: dict[str, list[float]] = defaultdict(list)


def enforce_rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    now = time.monotonic()
    with _lock:
        recent = [t for t in _attempts[key] if now - t < window_seconds]
        if len(recent) >= max_attempts:
            raise HTTPException(
                status_code=429,
                detail="Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
            )
        recent.append(now)
        _attempts[key] = recent
