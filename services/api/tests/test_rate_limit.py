"""Tests de rate_limit.py: la ventana deslizante en si, y que las claves
vencidas se olviden (auditoria de manejo de errores: _attempts no debe
crecer sin limite)."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

import rate_limit
from rate_limit import enforce_rate_limit


def test_allows_up_to_max_attempts():
    for _ in range(3):
        enforce_rate_limit("k1", max_attempts=3, window_seconds=60)  # no debe lanzar


def test_blocks_after_max_attempts():
    for _ in range(3):
        enforce_rate_limit("k2", max_attempts=3, window_seconds=60)

    with pytest.raises(HTTPException) as exc_info:
        enforce_rate_limit("k2", max_attempts=3, window_seconds=60)
    assert exc_info.value.status_code == 429


def test_different_keys_have_independent_limits():
    for _ in range(3):
        enforce_rate_limit("k3-a", max_attempts=3, window_seconds=60)

    enforce_rate_limit("k3-b", max_attempts=3, window_seconds=60)  # no debe lanzar


def test_expired_key_is_pruned_and_does_not_leak_memory(monkeypatch):
    """Sin la limpieza de auditoria, _attempts["k4"] seguiria existiendo para
    siempre despues de que su ventana expirara."""
    fake_now = [1_000.0]
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: fake_now[0])

    enforce_rate_limit("k4", max_attempts=1, window_seconds=10)
    assert "k4" in rate_limit._attempts

    # Avanza el reloj mas alla de la ventana de "k4" y golpea OTRA clave:
    # eso debe disparar la limpieza y olvidar "k4" por completo.
    fake_now[0] += 11
    enforce_rate_limit("k5", max_attempts=1, window_seconds=10)

    assert "k4" not in rate_limit._attempts
