# `services/api` — Nexova Incidents API

FastAPI HTTP service that exposes the same support-ticket analysis logic as
`scripts/analyze.py`, so a CSV can be uploaded from a frontend or any HTTP
client instead of running it from the command line.

## Requirements

- Python 3.10+
- Dependencies in `requirements.txt` (FastAPI, Uvicorn, python-multipart, pandas)

## Install and run (development)

```bash
cd services/api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive docs (Swagger UI) once running:

```
http://localhost:8000/docs
```

Also available as Redoc at `http://localhost:8000/redoc` and the raw OpenAPI
schema at `http://localhost:8000/openapi.json`.

## Endpoints

### `POST /api/incidents/analyze`

Accepts a support-ticket CSV as `multipart/form-data` (field `file`), applies
the 7 business validation rules, and returns an aggregated JSON summary
(never row-level data, never `customer_email`). The result is stored in
memory as the "last analysis".

- `200`: analysis summary (see `AnalysisSummary` in `app/schemas.py`).
- `400`: no `.csv` file attached, empty file, invalid CSV, or missing
  required columns.
- `422`: no `file` field sent (FastAPI's automatic validation).

### `GET /api/incidents/results/export`

Downloads the result of the last analysis run in this process, as a CSV (one
row per metric).

- `200`: downloadable `results.csv` file (`Content-Disposition: attachment`).
- `404`: no analysis has been run yet in this process.

## "Last result" persistence

Stored in a process-memory variable (`app/store.py`), with no database or
disk. This is a deliberate choice to keep the service simple: it works fine
for local development or a single instance, but it is **lost on process
restart** and not shared across multiple instances/workers. If that is
needed later, migrate to an external store (Redis, a database table, etc.).

## Privacy

Just like `scripts/analyze.py`, this service never prints, logs, or returns
an individual `customer_email` in any response: every output path
(`AnalysisSummary` and the CSV export) only works with aggregates computed in
`app/analysis.py::build_summary`.

## Structure

```
services/api/
├── requirements.txt
├── app/
│   ├── main.py        # FastAPI routes
│   ├── analysis.py     # validation/metrics logic (ported from scripts/analyze.py)
│   ├── schemas.py       # Pydantic request/response models (Swagger)
│   └── store.py         # in-memory store for the last result
```

> _Spanish version: [README.es.md](./README.es.md)._
