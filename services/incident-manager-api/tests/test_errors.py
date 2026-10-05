"""Manejo de errores inesperados: formato uniforme
{"error": {"code", "message", "fields"?}} y que un 500 nunca filtre detalle."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize("method,path,kwargs", [
    ("get", "/api/incidents", {}),
    ("get", "/api/incidents/summary", {}),
    ("get", "/api/incidents/1", {}),
    ("post", "/api/incidents", {"json": {}}),
    ("patch", "/api/incidents/1/status", {"json": {"status": "in_progress"}}),
])
def test_unexpected_error_returns_generic_500_without_leaking(
    client: TestClient, method: str, path: str, kwargs: dict
):
    from db import get_session
    from main import app

    secret = "SECRETO-INTERNO-no-debe-salir"

    def boom():
        raise RuntimeError(secret)

    app.dependency_overrides[get_session] = boom

    response = getattr(client, method)(path, **kwargs)

    assert response.status_code == 500
    error = response.json()["error"]
    assert error["code"] == "internal_error"
    assert secret not in response.text


def test_http_exception_with_non_string_detail_falls_back_to_default_message(
    client: TestClient
):
    from fastapi import HTTPException

    from main import app

    @app.get("/__test_http_error_detail")
    def _raise():  # pragma: no cover - se ejecuta via cliente
        raise HTTPException(status_code=418, detail={"x": 1})

    try:
        response = client.get("/__test_http_error_detail")
    finally:
        app.router.routes.pop()

    assert response.status_code == 418
    assert response.json()["error"]["code"] == "http_error"
    assert isinstance(response.json()["error"]["message"], str)


# ─── CORS ───────────────────────────────────────────────────────────────


