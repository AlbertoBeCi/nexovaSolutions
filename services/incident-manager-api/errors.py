"""
Manejo de errores uniforme de la API: todo error de negocio se responde con
el mismo formato JSON, {"error": {"code", "message", "fields"?}}, y ninguna
excepcion no controlada filtra un stack trace ni texto interno al cliente
(ver README.md). Los cuatro handlers de este modulo se registran en
main.py con `app.add_exception_handler`.
"""
from __future__ import annotations

import logging
from typing import Dict, Optional

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("incident_manager")

GENERIC_500_MESSAGE = "Ha ocurrido un error interno. Intentalo de nuevo mas tarde."


class ApiError(Exception):
    """Error de negocio con codigo/mensaje/campos opcionales. status_code
    por defecto 400: la inmensa mayoria de los errores de este servicio son
    de validacion; los pocos casos con otro codigo (404, por ejemplo) lo
    indican explicitamente al construir la excepcion."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        fields: Optional[Dict[str, str]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.fields = fields


def _error_response(
    status_code: int, code: str, message: str, fields: Optional[Dict[str, str]] = None
) -> JSONResponse:
    error_body: Dict[str, object] = {"code": code, "message": message}
    if fields:
        error_body["fields"] = fields
    return JSONResponse(status_code=status_code, content={"error": error_body})


async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
    return _error_response(exc.status_code, exc.code, exc.message, exc.fields)


async def handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Los 422 automaticos de Pydantic (JSON invalido, body que no es un
    # objeto) se homogeneizan al mismo formato {"error": {...}} con 400,
    # en vez del formato propio de FastAPI ({"detail": [...]})."
    return _error_response(
        status.HTTP_400_BAD_REQUEST,
        "validation_error",
        "El cuerpo de la solicitud no es valido.",
    )


async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = "not_found" if exc.status_code == status.HTTP_404_NOT_FOUND else "http_error"
    message = exc.detail if isinstance(exc.detail, str) else "Error al procesar la solicitud."
    return _error_response(exc.status_code, code, message)


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # El detalle real (tipo de excepcion, traceback) SOLO va al log del
    # servidor; el cliente nunca recibe informacion interna.
    logger.exception(
        "Error interno no controlado en %s %s", request.method, request.url.path
    )
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error", GENERIC_500_MESSAGE
    )
