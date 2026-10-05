# `services/incident-manager-api` — Gestor de Incidencias de Nexova

Gestor de incidencias centralizado de Nexova: un modelo `Incident`
persistente (SQLAlchemy 2.0 + SQLite), una API REST bajo `/api/incidents`,
y un script de seed que carga el mismo CSV que ya valida el **analizador**
de tickets de soporte (`scripts/analyze.py`, `services/api`).

**No confundir con `/api/incidents/analyze` de `services/api`**: ese
endpoint es un *analizador* de CSV sin estado (subes un archivo, recibes
métricas agregadas, nada se guarda). Este servicio es el *gestor*: las
incidencias son registros persistentes con su propio ciclo de vida
(`open → in_progress → resolved`/`discarded`), independiente de cualquier
subida de CSV puntual.

## Por qué un segundo servicio FastAPI

`AGENTS.md` prefiere un único backend FastAPI centralizado. Este servicio
es una excepción explícita y acotada: el ejercicio del gestor de
incidencias pedía expresamente un servicio nuevo
(`services/<nombre-del-servicio-api>/`), y tiene un modelo de persistencia
genuinamente distinto (SQLAlchemy/SQLite con restricciones CHECK, frente a
TinyDB en `services/api`) que se beneficia de sus propias dependencias y
ciclo de vida en vez de encajarse dentro de `services/api`. No tiene
autenticación propia (el ejercicio no la pedía) y corre en un puerto
distinto (`8001`) para que ambos servicios convivan en desarrollo.

## Requisitos

- Python 3.10+
- [uv](https://docs.astral.sh/uv/). Las dependencias están en
  `pyproject.toml` (FastAPI, Uvicorn, SQLAlchemy, python-dotenv, y pandas
  — la necesita transitivamente `nexova_shared.incidents_analysis`, ver
  abajo).
- `packages/shared/` (el paquete Python `nexova_shared`) debe existir como
  carpeta hermana en este repo. **No** es una dependencia `uv`/`pip`
  instalada: se alcanza con el mismo patrón de `sys.path` que ya usaba el
  repo para `shared/` (ver `shared_bootstrap.py` y
  `packages/shared/README.md`, "Uso desde un consumidor nuevo").

## Instalación y arranque (desarrollo)

```bash
cd services/incident-manager-api
uv sync                                      # crea .venv, instala dependencias
cp .env.example .env                         # opcional: los valores por defecto funcionan sin tocar nada
uv run serve                                 # → http://localhost:8001
```

Documentación interactiva (Swagger UI) una vez arrancado:
`http://localhost:8001/docs`.

### Variables de entorno

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `INCIDENTS_DATABASE_URL` | `sqlite:///./data/incidents.db` | URL de conexión de SQLAlchemy. La carpeta `data/` se crea sola y está en `.gitignore`. |
| `API_HOST` | `0.0.0.0` | Host de `uv run serve`. |
| `API_PORT` | `8001` | Puerto de `uv run serve` (distinto del `8000` de `services/api`). |
| `CORS_ORIGINS` | `localhost`/`127.0.0.1` en los puertos 3000 y 3001 | Orígenes permitidos, separados por comas. |

Copia `.env.example` a `.env` (en `.gitignore`, ver `.gitignore`) solo si
necesitas cambiar algo; los valores por defecto funcionan en un checkout
limpio sin `.env`.

### Tests

```bash
uv run pytest
```

Guía completa de pruebas (qué verifica cada archivo, cómo leer un resultado correcto/fallido, cobertura): [`TESTING.md`](../../entregables/TESTING.md).

- `tests/test_api.py`: caso feliz y de error de cada endpoint (campo
  faltante, valor de enum inválido, cuerpo mal formado, filtros, todas las
  transiciones válidas e inválidas, 404, resumen con BD vacía y con datos,
  y un 500 forzado que nunca filtra el stack trace ni el texto de la
  excepción original).
- `tests/test_models.py`: las mismas reglas de negocio aplicadas a nivel de
  base de datos (los CHECK rechazan una categoría/estado/origen/sede
  desconocidos o un título/descripción en blanco; NOT NULL rechaza un
  campo obligatorio ausente).
- `tests/test_seed.py`: `scripts/seed_incidents.py` sobre el CSV real
  (conteos esperados), idempotencia (la 2ª ejecución inserta 0), y varios
  CSV hechos a mano para filas inválidas/no mapeables y la clave de
  deduplicación.

Todos corren contra un archivo SQLite temporal por test
(`tests/conftest.py`).

## Modelo de datos

`Incident` (tabla `incidents`):

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | int, autoincremental | Clave primaria. |
| `title` | texto, NOT NULL | CHECK: no vacío tras recortar espacios. |
| `description` | texto, NOT NULL | CHECK: no vacío tras recortar espacios. |
| `category` | string, NOT NULL, indexado | CHECK: uno de los 8 valores de `nexova_shared.incident_constants.CATEGORIES` (incluye `sla_breach`, filtrable de forma trivial gracias al índice). |
| `status` | string, NOT NULL, indexado, por defecto `open` | CHECK: `open`/`in_progress`/`resolved`/`discarded`. |
| `origin` | string, NOT NULL, indexado | CHECK: `customer`/`branch`/`internal`. |
| `branch` | string, NOT NULL, indexado | CHECK: `central`/`valencia_operations`/`miami_office`/`remote`. |
| `created_at` / `updated_at` | datetime UTC, NOT NULL | Ver `UTCDateTime` abajo. `updated_at` se refresca en cada cambio. |

Las 4 columnas de tipo enum comparten sus valores permitidos con
`nexova_shared.incident_constants` (una sola fuente de verdad: los CHECK se
generan desde las mismas tuplas de Python que usa el validador de
aplicación), así que la base de datos y la aplicación nunca pueden
divergir.

**`UTCDateTime`** (`models.py`): el `DateTime(timezone=True)` de SQLite
devuelve, al leer, un `datetime` *naive* (comprobado a mano), aunque se
haya escrito un valor UTC consciente de zona horaria. Este `TypeDecorator`
exige un valor con zona horaria al escribir (lo convierte a UTC) y
reasigna `tzinfo=UTC` al leer, para que `created_at`/`updated_at` sean
siempre UTC-aware en Python y se sirvan en la API con el sufijo `+00:00`.

`SeedTicketId` (tabla `seed_ticket_ids`): registro de idempotencia del
seed. Asocia un `ticket_id` del CSV (o, si no hay, `title + created_at`) al
`Incident.id` que generó. **El `ticket_id` nunca se guarda en `Incident`**
— esta tabla es el único lugar donde vive, exclusivamente para que una
segunda ejecución del seed detecte qué ya se cargó.

Sin Alembic ni migraciones formales: `db.init_db()`
(`Base.metadata.create_all`) corre al arrancar la API y antes de que el
seed inserte nada. Para una sola tabla de negocio en un proyecto de
aprendizaje, esto es más simple que integrar una herramienta de
migraciones, a costa de no poder cambiar el esquema de una base de datos
ya existente sin un `ALTER TABLE` manual o una carpeta `data/` nueva.

## Script de seed (`scripts/seed_incidents.py`)

Carga `scripts/incidents-COMPANY.csv` (el fixture del analizador — el
prompt que originó esta funcionalidad nombraba un archivo,
`incidents-nexova.csv`, que no existe en ningún sitio del repo; este es el
más parecido real, generado por `scripts/generate_incidents_fixture.py`)
en el gestor de incidencias. Se ejecuta desde la raíz del repo:

```bash
uv run --project services/incident-manager-api python scripts/seed_incidents.py
uv run --project services/incident-manager-api python scripts/seed_incidents.py --csv otra/ruta.csv
```

Por cada fila, en este orden:

1. **Las mismas 7 reglas de negocio del analizador**
   (`nexova_shared.incidents_analysis.csv_row_violations`, versión fila a
   fila de `apply_validation_rules`) — una fila que falla cualquiera de
   ellas se descarta, nunca se inserta.
2. **Mapeo** (`nexova_shared.csv_mapping.map_csv_row`):
   - `description` → `title` (primeros 120 caracteres, recortado) y
     `description` (copiado literal). Un título vacío tras recortar
     descarta la fila.
   - `date` (`YYYY-MM-DD`) → `created_at`/`updated_at`, medianoche UTC. Una
     fecha no parseable descarta la fila.
   - `status`: `OPEN→open`, `CLOSED→resolved`, `DISCARDED→discarded`.
   - `category`: `TECHNICAL`/`ACCESS→technical_failure`,
     `BILLING`/`HR_QUERY→process_error`, `COMPLAINT→client_complaint`. Un
     status/category sin mapeo descarta la fila.
   - `origin` siempre `customer`, `branch` siempre `central` (el CSV del
     analizador no trae columna de sede/oficina: todas sus filas son
     tickets de clientes contra la sede central).
3. **Idempotencia**: el `ticket_id` del CSV, o `title + created_at` si el
   CSV no tiene columna `ticket_id`, comprobado contra `seed_ticket_ids` y
   contra las filas ya vistas antes en el mismo CSV.

Imprime un resumen (leídas / insertadas / duplicadas omitidas /
descartadas) y, por cada fila descartada, `linea N: motivo` en español.

### Resultado esperado sobre el CSV real (`scripts/incidents-COMPANY.csv`, 100 filas)

```
1ª ejecución:  Filas leidas: 100   Insertadas: 96   Duplicadas omitidas: 0   Descartadas: 4
2ª ejecución:  Filas leidas: 100   Insertadas: 0    Duplicadas omitidas: 96  Descartadas: 4
```

`GET /api/incidents/summary` tras el seed:

| Dimensión | Valores |
| --- | --- |
| `status` | `open`: 27, `in_progress`: 0, `resolved`: 56, `discarded`: 13 |
| `category` | `technical_failure`: 49, `process_error`: 35, `client_complaint`: 12, resto: 0 |
| `origin` | `customer`: 96, `branch`/`internal`: 0 |
| `branch` | `central`: 96, resto: 0 |

Coincide exactamente con lo que esperaba el prompt que originó esta
funcionalidad (status open=27/resolved=56/discarded=13, category
technical_failure=49/process_error=35/client_complaint=12).

## Endpoints — `/api/incidents`

Formato de error uniforme en toda la API:
`{"error": {"code", "message", "fields"?}}` (ver `errors.py`). Toda
excepción no controlada se captura y se convierte en un `500` genérico
(`"Ha ocurrido un error interno. Inténtalo de nuevo más tarde."`); la
excepción real solo se registra en el log del servidor, nunca llega al
cliente.

| Método y ruta | Respuesta |
| --- | --- |
| `POST /api/incidents` | Body `{"title","description","category","origin","branch"}` (el estado siempre nace `open`). `201` con la incidencia creada. `400 validation_error` con `fields` si falta o es inválido un campo. |
| `GET /api/incidents?status=&origin=&branch=&category=` | `200` con la lista, más recientes primero. Todos los filtros son opcionales y combinables. `400 validation_error` ante un valor de filtro desconocido. `[]` si no hay datos. |
| `GET /api/incidents/summary` | `200` con totales por `status`/`category`/`origin`/`branch`. **Declarado antes que `/{id}`** para que FastAPI nunca intente interpretar "summary" como un id. Todas las claves de cada enum siempre presentes, a `0` con la base de datos vacía. |
| `GET /api/incidents/{id}` | `200` con el detalle. `404 not_found` si no existe. |
| `PATCH /api/incidents/{id}/status` | Body `{"status"}`. Validado contra `nexova_shared.incident_validation.is_valid_transition` — `open→in_progress`, `open→discarded`, `in_progress→resolved`, `in_progress→discarded`; `resolved`/`discarded` son finales. `200` con la incidencia actualizada (nuevo `updated_at`). `400 invalid_transition` ante el mismo estado, un estado final, o un salto de paso. `404 not_found` si no existe. |

Sin autenticación: este ejercicio no la pedía, y este servicio no tiene
sistema de usuarios.

## Estructura

```
services/incident-manager-api/
├── pyproject.toml          # proyecto uv: dependencias, `uv run serve`
├── uv.lock
├── .env.example
├── .gitignore              # ignora .env (conserva .env.example)
├── shared_bootstrap.py     # agrega packages/shared/ a sys.path (nexova_shared)
├── config.py               # variables de entorno: DATABASE_URL, API_HOST/PORT, CORS_ORIGINS
├── db.py                   # motor/sesion de SQLAlchemy, init_db()
├── models.py               # Incident, SeedTicketId, UTCDateTime, restricciones CHECK
├── schemas.py               # modelos Pydantic de SALIDA (IncidentOut, SummaryOut, ErrorBody)
├── errors.py                # ApiError + los 4 manejadores de excepcion (formato de error uniforme)
├── main.py                 # app FastAPI: CORS, manejadores de excepcion, lifespan(init_db)
├── routes/
│   └── incidents.py        # /api/incidents (usa solo nexova_shared.incident_validation)
├── tests/
│   ├── conftest.py         # fixtures de TestClient/sesion sobre SQLite temporal
│   ├── test_api.py
│   ├── test_models.py
│   └── test_seed.py        # importa scripts/seed_incidents.py por ruta
└── data/                   # archivo SQLite local (en .gitignore)
```

`scripts/seed_incidents.py` vive en la raíz del repo (según la estructura
de carpetas que pedía el ejercicio), no dentro de este servicio — ver su
propio docstring para cómo alcanza tanto `packages/shared/` como el
`db`/`models` de este servicio.

> _Versión en inglés: [README.md](./README.md)._
