"""
Endpoints de analisis de tickets de soporte (/api/incidents).

Exponen via HTTP la misma logica de validacion/metricas que
scripts/analyze.py, para que el CSV se pueda subir desde un frontend o
cualquier cliente HTTP en lugar de ejecutarse por linea de comandos.
"""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

import store
from analysis import InvalidCsvError, analyze_csv, summary_to_csv_bytes
from models import AnalysisSummary, ErrorResponse

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.post(
    "/analyze",
    response_model=AnalysisSummary,
    status_code=200,
    summary="Analiza un CSV de tickets de soporte",
    description=(
        "Recibe un archivo CSV de tickets de soporte (multipart/form-data), "
        "aplica las 7 reglas de validacion de negocio y devuelve un resumen "
        "agregado (nunca datos de fila, nunca emails individuales). El "
        "resultado se guarda en memoria como 'ultimo analisis' para "
        "poder exportarlo despues con GET /api/incidents/results/export."
    ),
    responses={
        400: {
            "model": ErrorResponse,
            "description": "El archivo no se adjunto, no es un CSV o le faltan columnas requeridas.",
        },
    },
)
async def analyze_incidents(
    file: UploadFile = File(..., description="Archivo CSV de tickets de soporte"),
) -> AnalysisSummary:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="El archivo debe tener extension .csv.",
        )

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")

    try:
        summary = analyze_csv(raw_bytes, file.filename)
    except InvalidCsvError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    store.set_last_result(summary)
    return store.get_last_result()


@router.get(
    "/results/export",
    summary="Descarga el ultimo analisis como CSV",
    description=(
        "Devuelve, como archivo CSV descargable (una fila por metrica), el "
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
)
async def export_last_result() -> Response:
    last_result = store.get_last_result()
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
