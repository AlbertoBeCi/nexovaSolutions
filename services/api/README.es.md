# `services/api` — Nexova API

Backend FastAPI único de Nexova, con un router por dominio:

- **incidents** (`/api/incidents`): expone por web la misma lógica de análisis
  de tickets de soporte que `scripts/analyze.py`, para poder subir un CSV desde
  un frontend o cualquier cliente HTTP.
- **suppliers** (`/suppliers`): directorio de proveedores con su tarifa mensual
  por contrato (Spain en EUR, USA en USD), persistido en TinyDB. Lo consume
  `uis/application` (página `/suppliers`).

## Requisitos

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recomendado). Dependencias declaradas en
  `pyproject.toml` (FastAPI, Uvicorn, python-multipart, pandas, TinyDB,
  email-validator); `requirements.txt` se mantiene igual para quien use pip.

## Instalación y arranque (desarrollo)

```bash
cd services/api
uv sync                                      # crea .venv e instala deps + grupo dev
uv run seed                                  # carga los proveedores iniciales (idempotente)
uv run uvicorn main:app --reload --port 8000
```

Con pip: `pip install -r requirements.txt`, `python seed.py` y
`uvicorn main:app --reload --port 8000`.

Documentación interactiva (Swagger UI) una vez arrancado:

```
http://localhost:8000/docs
```

También disponible en formato Redoc en `http://localhost:8000/redoc` y el
esquema OpenAPI crudo en `http://localhost:8000/openapi.json`.

### Variables de entorno

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `SUPPLIERS_DB_PATH` | `services/api/data/suppliers.json` | Archivo TinyDB de proveedores (ignorado por git). |
| `CORS_ORIGINS` | `localhost`/`127.0.0.1` en los puertos 3000 y 3001 | Orígenes permitidos, separados por comas. |

### Tests

```bash
uv run pytest
```

`tests/test_suppliers.py` cubre todos los endpoints de `/suppliers` y la
idempotencia del seeder, contra una TinyDB temporal por test.

## Endpoints — incidencias

### `POST /api/incidents/analyze`

Recibe un CSV de tickets de soporte como `multipart/form-data` (campo `file`),
aplica las 7 reglas de validación de negocio y devuelve un resumen agregado en
JSON (nunca datos de fila, nunca `customer_email`). El resultado queda
guardado en memoria como "último análisis".

- `200`: resumen del análisis (ver `AnalysisSummary` en `models.py`).
- `400`: no se adjuntó un `.csv`, el archivo está vacío, no es un CSV válido,
  o le faltan columnas requeridas.
- `422`: no se envió el campo `file` (validación automática de FastAPI).

### `GET /api/incidents/results/export`

Descarga el resultado del último análisis ejecutado en este proceso, como CSV
(una fila por métrica).

- `200`: archivo `results.csv` descargable (`Content-Disposition: attachment`).
- `404`: todavía no se ha ejecutado ningún análisis en este proceso.

## Endpoints — proveedores

Modelos en `models.py`: `ProviderCreate` (entrada) y `ProviderResponse`
(salida = `ProviderCreate` + `id` + `updated_at`). El cliente nunca envía `id`
ni `updated_at`: el `id` es el `doc_id` de TinyDB y `updated_at` (UTC) lo fija
el sistema en el alta y en cada modificación.

Validaciones (`422` automático si fallan): `name` no vacío; `country` `Spain` o
`USA`; `categories` con al menos una de `software`, `infrastructure`,
`logistics`, `marketing`, `payments`, `security`, `other`; `monthly_rate` > 0;
`currency` `EUR` para Spain y `USD` para USA; `status` `active` o `suspended`;
`contract_renewal_date` (`YYYY-MM-DD`), `contact_email` y `notes` opcionales.

| Método y ruta | Respuesta |
| --- | --- |
| `POST /suppliers` | `201` con el proveedor creado. `422` si el payload no es válido. |
| `GET /suppliers?country=&category=` | `200` con la lista. Filtros opcionales y combinables; sin ellos, todos. |
| `GET /suppliers/{id}` | `200` con el detalle. `404` si no existe. |
| `PATCH /suppliers/{id}/rate` | Body `{"monthly_rate": > 0}`. `200` con el registro y `updated_at` nuevo. `422` si ≤ 0, `404` si no existe. |
| `PATCH /suppliers/{id}/status` | Body `{"status": "active" \| "suspended"}`. `200` con el registro. `422` / `404`. |
| `DELETE /suppliers/{id}` | `204` sin cuerpo. `404` si no existe. |

Los errores `404` devuelven `{"detail": "Proveedor no encontrado."}`.

### Datos iniciales (`uv run seed`)

`seed.py` lee `fixtures/suppliers.json`, valida cada proveedor con
`ProviderCreate` e inserta solo los que no existen ya por `name` (sin distinguir
mayúsculas ni espacios extra). Se puede ejecutar tantas veces como se quiera:

```
[INFO] Seed completed: 9 new suppliers added, 0 already existed.
[INFO] Seed completed: 0 new suppliers added, 9 already existed.
```

## Persistencia

- **Proveedores**: TinyDB, un archivo JSON (`SUPPLIERS_DB_PATH`). Pensado para
  un solo proceso: las lecturas/escrituras se serializan con un lock porque
  TinyDB no es thread-safe. Con varios workers/instancias habría que migrar a
  una base de datos real.
- **Último análisis de incidencias**: variable en memoria del proceso
  (`store.py`), sin disco. **Se pierde si el proceso se reinicia** y no se
  comparte entre instancias; si hiciera falta, migrar a un store externo
  (Redis, una tabla, etc.).

## Privacidad

Igual que `scripts/analyze.py`, este servicio nunca imprime, registra ni
devuelve un `customer_email` individual en ninguna respuesta: todas las rutas
de salida de incidencias (`AnalysisSummary` y la exportación a CSV) solo
trabajan con agregados calculados en `shared/incidents_analysis.py::build_summary`.

## Estructura

```
services/api/
├── pyproject.toml          # proyecto uv: deps, grupo dev, comando `seed`
├── uv.lock
├── requirements.txt        # mismas deps, para pip
├── main.py                 # app FastAPI: CORS + routers
├── models.py               # modelos Pydantic (proveedores, incidencias, errores)
├── database.py             # inicialización de TinyDB + lock
├── routes/
│   ├── incidents.py        # /api/incidents
│   └── suppliers.py        # /suppliers
├── analysis.py             # adaptador HTTP de shared/incidents_analysis.py
├── store.py                # almacén en memoria del último análisis
├── seed.py                 # carga idempotente de proveedores
├── fixtures/suppliers.json # datos iniciales del seeder
├── tests/test_suppliers.py
└── data/                   # TinyDB local (ignorado por git)
```

> _English version: [README.md](./README.md)._
