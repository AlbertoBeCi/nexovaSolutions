# `services/incident-manager-api` — Nexova Incident Manager

Centralized incident manager for Nexova: a persisted `Incident` model
(SQLAlchemy 2.0 + SQLite), a REST API under `/api/incidents`, and a seed
script that loads the same CSV the support-ticket **analyzer**
(`scripts/analyze.py`, `services/api`) already validates.

**Not to be confused with `services/api`'s `/api/incidents/analyze`**: that
endpoint is a stateless CSV *analyzer* (upload a file, get aggregated
metrics back, nothing is stored). This service is the *manager*: incidents
are persisted records with their own lifecycle (`open → in_progress →
resolved`/`discarded`), independent of any single CSV upload.

## Why a second FastAPI service

`AGENTS.md` prefers one centralized FastAPI backend. This service is an
explicit, scoped exception: the incident-manager exercise asked for a new
service (`services/<nombre-del-servicio-api>/`), and it has a genuinely
different persistence model (SQLAlchemy/SQLite with CHECK constraints,
vs. `services/api`'s TinyDB) that benefits from its own dependency set and
lifecycle rather than being bolted onto `services/api`. It has no
authentication of its own (the exercise didn't ask for any) and runs on a
different port (`8001`) so both services can run side by side in
development.

## Requirements

- Python 3.10+
- [uv](https://docs.astral.sh/uv/). Dependencies are declared in
  `pyproject.toml` (FastAPI, Uvicorn, SQLAlchemy, python-dotenv, and
  pandas — needed transitively by `nexova_shared.incidents_analysis`, see
  below).
- `packages/shared/` (the `nexova_shared` Python package) must exist as a
  sibling folder in this repo. It is **not** an installed `uv`/`pip`
  dependency: it's reached with the same `sys.path` pattern the repo
  already used for `shared/` (see `shared_bootstrap.py` and
  `packages/shared/README.md`, "Uso desde un consumidor nuevo").

## Install and run (development)

```bash
cd services/incident-manager-api
uv sync                                      # creates .venv, installs deps
cp .env.example .env                         # optional: defaults work out of the box
uv run serve                                 # → http://localhost:8001
```

Interactive docs (Swagger UI) once running: `http://localhost:8001/docs`.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `INCIDENTS_DATABASE_URL` | `sqlite:///./data/incidents.db` | SQLAlchemy connection URL. The `data/` folder is created automatically and is git-ignored. |
| `API_HOST` | `0.0.0.0` | Host for `uv run serve`. |
| `API_PORT` | `8001` | Port for `uv run serve` (different from `services/api`'s `8000`). |
| `CORS_ORIGINS` | `localhost`/`127.0.0.1` on ports 3000 and 3001 | Allowed origins, comma-separated. |

Copy `.env.example` to `.env` (git-ignored, see `.gitignore`) if you need to
override any of these; the defaults work in a fresh checkout with no `.env`
at all.

### Tests

```bash
uv run pytest
```

Full test guide (what each file checks, how to read a pass/fail, coverage): [`TESTING.md`](./TESTING.md).

- `tests/test_api.py`: every endpoint's happy path and error cases (missing
  fields, invalid enum values, malformed body, filters, all valid and
  invalid status transitions, 404s, empty-DB and populated summary, and a
  forced 500 that never leaks a stack trace or the original exception text).
- `tests/test_models.py`: the same business rules enforced at the database
  level (CHECK constraints reject an unknown category/status/origin/branch
  or a blank title/description; NOT NULL rejects a missing required field).
- `tests/test_seed.py`: `scripts/seed_incidents.py` against the real CSV
  (expected counts), idempotency (a 2nd run inserts 0), and a few
  hand-crafted CSVs for invalid/unmappable rows and the dedupe key.

All of them run against a temporary SQLite file per test
(`tests/conftest.py`).

## Data model

`Incident` (table `incidents`):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | int, autoincrement | Primary key. |
| `title` | text, NOT NULL | CHECK: non-blank after trim. |
| `description` | text, NOT NULL | CHECK: non-blank after trim. |
| `category` | string, NOT NULL, indexed | CHECK: one of the 8 values in `nexova_shared.incident_constants.CATEGORIES` (includes `sla_breach`, trivially filterable via the index). |
| `status` | string, NOT NULL, indexed, default `open` | CHECK: one of `open`/`in_progress`/`resolved`/`discarded`. |
| `origin` | string, NOT NULL, indexed | CHECK: `customer`/`branch`/`internal`. |
| `branch` | string, NOT NULL, indexed | CHECK: `central`/`valencia_operations`/`miami_office`/`remote`. |
| `created_at` / `updated_at` | UTC datetime, NOT NULL | See `UTCDateTime` below. `updated_at` refreshes on every change. |

All four enum-like columns share their allowed values with
`nexova_shared.incident_constants` (single source of truth: the CHECK
constraints are generated from the same Python tuples the app-level
validator uses), so the database and the application can never drift apart.

**`UTCDateTime`** (`models.py`): SQLite's `DateTime(timezone=True)` silently
returns a *naive* `datetime` on read (confirmed manually), even when a
timezone-aware UTC value was written. This custom `TypeDecorator` requires
a tz-aware value on write (converts it to UTC) and re-attaches
`tzinfo=UTC` on read, so `created_at`/`updated_at` are always UTC-aware in
Python and serialize with the `+00:00` suffix in the API.

`SeedTicketId` (table `seed_ticket_ids`): idempotency ledger for the seed
script. Maps a CSV `ticket_id` (or, if absent, `title + created_at`) to the
`Incident.id` it produced. **The `ticket_id` itself is never stored on
`Incident`** — this table is the only place it lives, exclusively so a
second seed run can detect what was already loaded.

No Alembic / formal migrations: `db.init_db()` (`Base.metadata.create_all`)
runs on API startup and before the seed inserts anything. For a single
business table in a learning-project context this is simpler than wiring
up a migration tool, at the cost of not supporting schema changes on an
existing database without a manual `ALTER TABLE` or a fresh `data/` folder.

## Seed script (`scripts/seed_incidents.py`)

Loads `scripts/incidents-COMPANY.csv` (the analyzer's fixture — the prompt
that started this feature named a file, `incidents-nexova.csv`, that
doesn't exist anywhere in the repo; this is the closest real one, generated
by `scripts/generate_incidents_fixture.py`) into the incident manager.
Run from the repo root:

```bash
uv run --project services/incident-manager-api python scripts/seed_incidents.py
uv run --project services/incident-manager-api python scripts/seed_incidents.py --csv otra/ruta.csv
```

For each row, in order:

1. **The same 7 business rules the analyzer uses**
   (`nexova_shared.incidents_analysis.csv_row_violations`, row-by-row
   version of `apply_validation_rules`) — a row that fails any of them is
   discarded, never inserted.
2. **Mapping** (`nexova_shared.csv_mapping.map_csv_row`):
   - `description` → `title` (first 120 chars, trimmed) and `description`
     (copied verbatim). An empty title after trimming discards the row.
   - `date` (`YYYY-MM-DD`) → `created_at`/`updated_at`, UTC midnight. An
     unparsable date discards the row.
   - `status`: `OPEN→open`, `CLOSED→resolved`, `DISCARDED→discarded`.
   - `category`: `TECHNICAL`/`ACCESS→technical_failure`,
     `BILLING`/`HR_QUERY→process_error`, `COMPLAINT→client_complaint`. An
     unmapped status/category discards the row.
   - `origin` is always `customer`, `branch` is always `central` (the
     analyzer's CSV has no branch/office column — every row is a customer
     ticket against the central office).
3. **Idempotency**: the CSV's `ticket_id`, or `title + created_at` if the
   CSV has no `ticket_id` column, checked against `seed_ticket_ids` and
   against the rows already seen earlier in the *same* CSV.

Prints a summary (read / inserted / duplicates skipped / discarded) and,
for every discarded row, `line N: reason` in Spanish.

### Expected result on the real CSV (`scripts/incidents-COMPANY.csv`, 100 rows)

```
1st run:  Filas leidas: 100   Insertadas: 96   Duplicadas omitidas: 0   Descartadas: 4
2nd run:  Filas leidas: 100   Insertadas: 0    Duplicadas omitidas: 96  Descartadas: 4
```

`GET /api/incidents/summary` after the seed:

| Dimension | Values |
| --- | --- |
| `status` | `open`: 27, `in_progress`: 0, `resolved`: 56, `discarded`: 13 |
| `category` | `technical_failure`: 49, `process_error`: 35, `client_complaint`: 12, rest: 0 |
| `origin` | `customer`: 96, `branch`/`internal`: 0 |
| `branch` | `central`: 96, rest: 0 |

These match exactly what the prompt that started this feature expected
(status open=27/resolved=56/discarded=13, category
technical_failure=49/process_error=35/client_complaint=12).

## Endpoints — `/api/incidents`

Error format, uniform across the whole API:
`{"error": {"code", "message", "fields"?}}` (see `errors.py`). Every
unhandled exception is caught and turned into a generic `500`
(`"Ha ocurrido un error interno. Inténtalo de nuevo más tarde."`); the real
exception is only ever logged server-side, never sent to the client.

| Method and path | Response |
| --- | --- |
| `POST /api/incidents` | Body `{"title","description","category","origin","branch"}` (status always starts `open`). `201` with the created incident. `400 validation_error` with `fields` on a missing/invalid field. |
| `GET /api/incidents?status=&origin=&branch=&category=` | `200` with the list, newest first. All filters optional and combinable. `400 validation_error` on an unknown filter value. `[]` if there is no data. |
| `GET /api/incidents/summary` | `200` with totals per `status`/`category`/`origin`/`branch`. **Declared before `/{id}`** so FastAPI never tries to parse "summary" as an id. Every enum key is always present, at `0` on an empty database. |
| `GET /api/incidents/{id}` | `200` with the detail. `404 not_found` if it doesn't exist. |
| `PATCH /api/incidents/{id}/status` | Body `{"status"}`. Validated against `nexova_shared.incident_validation.is_valid_transition` — `open→in_progress`, `open→discarded`, `in_progress→resolved`, `in_progress→discarded`; `resolved`/`discarded` are final. `200` with the updated incident (new `updated_at`). `400 invalid_transition` on the same status, a final status, or a skipped step. `404 not_found` if missing. |

No authentication: this exercise didn't ask for any, and there's no user
system in this service.

## Structure

```
services/incident-manager-api/
├── pyproject.toml          # uv project: deps, `uv run serve`
├── uv.lock
├── .env.example
├── .gitignore              # ignores .env (keeps .env.example)
├── shared_bootstrap.py     # adds packages/shared/ to sys.path (nexova_shared)
├── config.py               # env vars: DATABASE_URL, API_HOST/PORT, CORS_ORIGINS
├── db.py                   # SQLAlchemy engine/session, init_db()
├── models.py               # Incident, SeedTicketId, UTCDateTime, CHECK constraints
├── schemas.py               # Pydantic OUTPUT models (IncidentOut, SummaryOut, ErrorBody)
├── errors.py                # ApiError + the 4 exception handlers (uniform error format)
├── main.py                 # FastAPI app: CORS, exception handlers, lifespan(init_db)
├── routes/
│   └── incidents.py        # /api/incidents (uses nexova_shared.incident_validation only)
├── tests/
│   ├── conftest.py         # temp-SQLite TestClient/session fixtures
│   ├── test_api.py
│   ├── test_models.py
│   └── test_seed.py        # imports scripts/seed_incidents.py by path
└── data/                   # local SQLite file (git-ignored)
```

`scripts/seed_incidents.py` lives at the repo root (per the exercise's
required folder layout), not inside this service — see its own docstring
for how it reaches both `packages/shared/` and this service's `db`/`models`.

> _Spanish version: [README.es.md](./README.es.md)._
