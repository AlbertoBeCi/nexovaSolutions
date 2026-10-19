"""Auditoria de manejo de errores: una excepcion no controlada nunca debe
filtrar un stack trace ni el texto de la excepcion original al cliente."""
from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_unexpected_error_returns_generic_500_without_leaking_details(monkeypatch):
    def _boom(*args, **kwargs):
        raise RuntimeError("detalle interno sensible que no debe llegar al cliente")

    # get_suppliers_table() (dependencia de /suppliers) llama a get_db() por
    # nombre en el namespace de database.py en cada invocacion: parchear el
    # atributo del modulo si tiene efecto (a diferencia de parchear
    # get_suppliers_table directamente, que Depends() ya capturo por
    # referencia al definir el router, antes de este test).
    monkeypatch.setattr("database.get_db", _boom)
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/suppliers")

    assert response.status_code == 500
    body = response.json()
    assert body == {"detail": "Ha ocurrido un error interno. Intentalo de nuevo mas tarde."}
    assert "detalle interno sensible" not in response.text
    assert "RuntimeError" not in response.text
    assert "Traceback" not in response.text
