"""
API de analisis de tickets de soporte de Nexova.

Expone via HTTP la misma logica de validacion/metricas que scripts/analyze.py,
para que el CSV se pueda subir desde un frontend o cualquier cliente HTTP en
lugar de ejecutarse por linea de comandos.

Ejecutar en desarrollo (desde services/api):
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Documentacion interactiva (Swagger UI) una vez arrancado:
    http://localhost:8000/docs
"""
from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response

from . import store
from .analysis import InvalidCsvError, analyze_csv, summary_to_csv_bytes
from .schemas import AnalysisSummary, ErrorResponse

app = FastAPI(
    title="Nexova Incidents API",
    description=(
        "Analiza CSVs de tickets de soporte de Nexova: detecta registros "
        "invalidos y calcula metricas por categoria, estado y satisfaccion "
        "del cliente. Nunca expone customer_email en ninguna respuesta."
    ),
    version="1.0.0",
)


@app.post(
    "/api/incidents/analyze",
    response_model=AnalysisSummary,
    status_code=200,
    tags=["incidents"],
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


@app.get(
    "/api/incidents/results/export",
    tags=["incidents"],
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
