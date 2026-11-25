"""
Endpoints de analisis de tickets de soporte (/api/incidents).

Exponen via HTTP la misma logica de validacion/metricas que
scripts/analyze.py, para que el CSV se pueda subir desde un frontend o
cualquier cliente HTTP en lugar de ejecutarse por linea de comandos.
"""
from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from analysis import InvalidCsvError, summary_to_csv_bytes, validate_csv_bytes
from models import ErrorResponse
from routes.tasks import TaskAcceptedResponse
from security import get_current_user
from tasks import analyze_incidents_csv_task, get_last_result_shared, store_upload_payload

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.post(
    "/analyze",
    response_model=TaskAcceptedResponse,
    status_code=202,
    summary="Encola el analisis asincrono de un CSV de tickets de soporte",
    description=(
        "Requiere login. Valida el archivo CSV de entrada, encola el procesamiento "
        "en Celery y devuelve inmediatamente 202 Accepted con un `task_id` para "
        "consultar el estado y resultado en GET /tasks/{task_id}."
    ),
    responses={
        400: {
            "model": ErrorResponse,
            "description": "El archivo no se adjunto, no es un CSV o le faltan columnas requeridas.",
        },
    },
    dependencies=[Depends(get_current_user)],
)
async def analyze_incidents(
    file: UploadFile = File(..., description="Archivo CSV de tickets de soporte"),
) -> TaskAcceptedResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe tener extension .csv.",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    try:
        # Fast structural check (UTF-8 + required columns) before queuing
        validate_csv_bytes(raw_bytes)
    except InvalidCsvError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    upload_id = str(uuid.uuid4())
    store_upload_payload(upload_id, raw_bytes)
    async_result = analyze_incidents_csv_task.delay(upload_id, file.filename)
    return TaskAcceptedResponse(task_id=str(async_result.id), status="pending")


@router.get(
    "/results/export",
    response_model=None,
    summary="Descarga el ultimo analisis como CSV",
    description=(
        "Requiere login. Devuelve, como archivo CSV descargable (una fila por metrica), el "
        "resumen del ultimo analisis ejecutado con POST /api/incidents/analyze. "
        "El resultado se guarda en memoria del proceso: se pierde si el "
        "servicio se reinicia."
    ),
    responses={
        200: {
            "content": {"text/csv": {}},
            "description": "CSV con una fila por metrica (columnas metric,value).",
        },
        404: {
            "model": ErrorResponse,
            "description": "Todavia no se ha ejecutado ningun analisis en este proceso.",
        },
    },
    dependencies=[Depends(get_current_user)],
)
async def export_last_result() -> Response:
    last_result = get_last_result_shared()
    if last_result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No hay ningun analisis previo para exportar. "
                "Ejecuta POST /api/incidents/analyze primero."
            ),
        )

    csv_bytes = summary_to_csv_bytes(last_result)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="results.csv"'},
    )
