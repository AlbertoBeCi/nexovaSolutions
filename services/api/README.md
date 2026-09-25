# `services/api` — Nexova API

Nexova's single FastAPI backend, with one router per domain:

- **incidents** (`/api/incidents`): exposes the same support-ticket analysis
  logic as `scripts/analyze.py` over HTTP, so a CSV can be uploaded from a
  frontend or any HTTP client.
- **suppliers** (`/suppliers`): supplier directory with each contract's monthly
  rate (Spain in EUR, USA in USD), persisted in TinyDB. Consumed by
  `uis/application` (`/suppliers` page).

## Requirements

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recommended). Dependencies are declared in
  `pyproject.toml` (FastAPI, Uvicorn, python-multipart, pandas, TinyDB,
  email-validator); `requirements.txt` is kept in sync for pip users.

## Install and run (development)

```bash
cd services/api
uv sync                                      # creates .venv, installs deps + dev group
uv run seed                                  # loads the initial suppliers (idempotent)
uv run uvicorn main:app --reload --port 8000
```

With pip: `pip install -r requirements.txt`, `python seed.py` and
`uvicorn main:app --reload --port 8000`.

Interactive docs (Swagger UI) once running:

```
http://localhost:8000/docs
```

Also available as Redoc at `http://localhost:8000/redoc` and the raw OpenAPI
schema at `http://localhost:8000/openapi.json`.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPPLIERS_DB_PATH` | `services/api/data/suppliers.json` | TinyDB file for suppliers (git-ignored). |
| `CORS_ORIGINS` | `localhost`/`127.0.0.1` on ports 3000 and 3001 | Allowed origins, comma-separated. |

### Tests

```bash
uv run pytest
```

`tests/test_suppliers.py` covers every `/suppliers` endpoint and the seeder's
idempotency, against a temporary TinyDB per test.

## Endpoints — incidents

### `POST /api/incidents/analyze`

Accepts a support-ticket CSV as `multipart/form-data` (field `file`), applies
the 7 business validation rules, and returns an aggregated JSON summary
(never row-level data, never `customer_email`). The result is stored in
memory as the "last analysis".

- `200`: analysis summary (see `AnalysisSummary` in `models.py`).
- `400`: no `.csv` file attached, empty file, invalid CSV, or missing
  required columns.
- `422`: no `file` field sent (FastAPI's automatic validation).

### `GET /api/incidents/results/export`

Downloads the result of the last analysis run in this process, as a CSV (one
row per metric).

- `200`: downloadable `results.csv` file (`Content-Disposition: attachment`).
- `404`: no analysis has been run yet in this process.

## Endpoints — suppliers

Models in `models.py`: `ProviderCreate` (input) and `ProviderResponse`
(output = `ProviderCreate` + `id` + `updated_at`). Clients never send `id` or
`updated_at`: `id` is TinyDB's `doc_id`, and `updated_at` (UTC) is set by the
system on creation and on every change.

Validation (automatic `422` on failure): non-empty `name`; `country` `Spain` or
`USA`; `categories` with at least one of `software`, `infrastructure`,
`logistics`, `marketing`, `payments`, `security`, `other`; `monthly_rate` > 0;
`currency` `EUR` for Spain and `USD` for USA; `status` `active` or `suspended`;
optional `contract_renewal_date` (`YYYY-MM-DD`), `contact_email` and `notes`.

| Method and path | Response |
| --- | --- |
| `POST /suppliers` | `201` with the created supplier. `422` on an invalid payload. |
| `GET /suppliers?country=&category=` | `200` with the list. Optional, combinable filters; none returns all. |
| `GET /suppliers/{id}` | `200` with the detail. `404` if it does not exist. |
| `PATCH /suppliers/{id}/rate` | Body `{"monthly_rate": > 0}`. `200` with the record and a new `updated_at`. `422` if ≤ 0, `404` if missing. |
| `PATCH /suppliers/{id}/status` | Body `{"status": "active" \| "suspended"}`. `200` with the record. `422` / `404`. |
| `DELETE /suppliers/{id}` | `204` with no body. `404` if it does not exist. |

`404` errors return `{"detail": "Proveedor no encontrado."}` (Spanish, shown as-is by the UI).

### Seed data (`uv run seed`)

`seed.py` reads `fixtures/suppliers.json`, validates each supplier with
`ProviderCreate`, and only inserts those not already present by `name`
(case- and extra-whitespace-insensitive). It can be run any number of times:

```
[INFO] Seed completed: 9 new suppliers added, 0 already existed.
[INFO] Seed completed: 0 new suppliers added, 9 already existed.
```

## Persistence

- **Suppliers**: TinyDB, a single JSON file (`SUPPLIERS_DB_PATH`). Designed for
  one process: reads/writes are serialized with a lock because TinyDB is not
  thread-safe. Multiple workers/instances would require a real database.
- **Last incidents analysis**: process-memory variable (`store.py`), no disk.
  It is **lost on restart** and not shared across instances; if needed,
  migrate to an external store (Redis, a table, etc.).

## Privacy

Just like `scripts/analyze.py`, this service never prints, logs, or returns
an individual `customer_email` in any response: every incidents output path
(`AnalysisSummary` and the CSV export) only works with aggregates computed in
`shared/incidents_analysis.py::build_summary`.

## Structure

```
services/api/
├── pyproject.toml          # uv project: deps, dev group, `seed` command
├── uv.lock
├── requirements.txt        # same deps, for pip
├── main.py                 # FastAPI app: CORS + routers
├── models.py               # Pydantic models (suppliers, incidents, errors)
├── database.py             # TinyDB setup + lock
├── routes/
│   ├── incidents.py        # /api/incidents
│   └── suppliers.py        # /suppliers
├── analysis.py             # HTTP adapter over shared/incidents_analysis.py
├── store.py                # in-memory store for the last analysis
├── seed.py                 # idempotent supplier loader
├── fixtures/suppliers.json # seeder input data
├── tests/test_suppliers.py
└── data/                   # local TinyDB (git-ignored)
```

> _Spanish version: [README.es.md](./README.es.md)._
