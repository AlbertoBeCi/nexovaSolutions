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


def _prune_expired_keys(now: float, window_seconds: int) -> None:
    """Olvida cualquier clave cuyo intento mas reciente ya haya expirado de
    la ventana (ver auditoria de manejo de errores): sin esto, _attempts
    crece para siempre, una entrada por cada IP distinta que alguna vez llamo
    a un endpoint limitado. Se llama con el lock ya tomado."""
    expired = [
        existing_key
        for existing_key, timestamps in _attempts.items()
        if not timestamps or now - max(timestamps) >= window_seconds
    ]
    for existing_key in expired:
        del _attempts[existing_key]


def enforce_rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    now = time.monotonic()
    with _lock:
        _prune_expired_keys(now, window_seconds)

        recent = [t for t in _attempts[key] if now - t < window_seconds]
        if len(recent) >= max_attempts:
            raise HTTPException(
                status_code=429,
                detail="Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
            )
        recent.append(now)
        _attempts[key] = recent
