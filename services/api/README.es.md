# `services/api` — Nexova Incidents API

API HTTP (FastAPI) que expone por web la misma lógica de análisis de tickets de
soporte que `scripts/analyze.py`, para poder subir un CSV desde un frontend o
cualquier cliente HTTP en lugar de ejecutarlo por línea de comandos.

## Requisitos

- Python 3.10+
- Dependencias en `requirements.txt` (FastAPI, Uvicorn, python-multipart, pandas)

## Instalación y arranque (desarrollo)

```bash
cd services/api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Documentación interactiva (Swagger UI) una vez arrancado:

```
http://localhost:8000/docs
```

También disponible en formato Redoc en `http://localhost:8000/redoc` y el
esquema OpenAPI crudo en `http://localhost:8000/openapi.json`.

## Endpoints

### `POST /api/incidents/analyze`

Recibe un CSV de tickets de soporte como `multipart/form-data` (campo `file`),
aplica las 7 reglas de validación de negocio y devuelve un resumen agregado en
JSON (nunca datos de fila, nunca `customer_email`). El resultado queda
guardado en memoria como "último análisis".

- `200`: resumen del análisis (ver `AnalysisSummary` en `app/schemas.py`).
- `400`: no se adjuntó un `.csv`, el archivo está vacío, no es un CSV válido,
  o le faltan columnas requeridas.
- `422`: no se envió el campo `file` (validación automática de FastAPI).

### `GET /api/incidents/results/export`

Descarga el resultado del último análisis ejecutado en este proceso, como CSV
(una fila por métrica).

- `200`: archivo `results.csv` descargable (`Content-Disposition: attachment`).
- `404`: todavía no se ha ejecutado ningún análisis en este proceso.

## Persistencia del "último resultado"

Se guarda en una variable en memoria del proceso (`app/store.py`), sin base de
datos ni disco. Es una decisión deliberada para mantener el servicio simple:
funciona bien para desarrollo local o una sola instancia, pero **se pierde si
el proceso se reinicia** y no se comparte entre varias instancias/workers. Si
en el futuro se necesita eso, habría que migrar a un store externo (Redis, una
tabla en base de datos, etc.).

## Privacidad

Igual que `scripts/analyze.py`, este servicio nunca imprime, registra ni
devuelve un `customer_email` individual en ninguna respuesta: todas las rutas
de salida (`AnalysisSummary` y la exportación a CSV) solo trabajan con
agregados calculados en `app/analysis.py::build_summary`.

## Estructura

```
services/api/
├── requirements.txt
├── app/
│   ├── main.py        # rutas FastAPI
│   ├── analysis.py     # logica de validacion/metricas (portada de scripts/analyze.py)
│   ├── schemas.py       # modelos Pydantic de request/response (Swagger)
│   └── store.py         # almacen en memoria del ultimo resultado
```

> _English version: [README.md](./README.md)._
