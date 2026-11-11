# `data/pipelines` folder

This folder groups **all data pipelines in the monorepo** related to the company: ingestion, ETL/ELT, cleaning, transformation, and loading into analytical or production systems.

Each subfolder or file under `data/pipelines/` should represent **one pipeline or job set** (for example `sales-etl`, `telemetry-stream`, `customer-segmentation`) and include the required configuration (scripts, orchestration, connectors, schemas, etc.).

- **Main purpose**: consolidate in one place the data movement and transformation logic that powers the company’s applications and analytics.
- **Recommendation**: document pipelines as you add them—their goal, data sources and sinks, dependencies, and how to run them in development, testing, and production.

> _Spanish version: [README.es.md](./README.es.md)._

## Weekly office/program performance

The `weekly_office_program_performance_flow` reads KPI events from
`telemetry_events` in a read-only transaction and publishes the four approved
metrics to `reporting.weekly_office_program_performance`. It requires Prefect 3
and `TELEMETRY_READONLY_DATABASE_URL` plus `REPORTING_DATABASE_URL`. For local
development, `SUPABASE_DATABASE_URL` is accepted as a fallback for both.

From the monorepo root, with the API environment installed:

```bash
uv run --project services/api python data/pipelines/pipeline.py
uv run --project services/api python data/pipelines/pipeline.py --week-start 2026-11-02 --trigger backfill
uv run --project services/api python data/pipelines/pipeline.py --serve
```

The scheduled deployment runs Mondays at 06:00 UTC for the last complete ISO
week. Apply
[`services/api/migrations/002_weekly_business_reporting.sql`](../../services/api/migrations/002_weekly_business_reporting.sql)
first. See [PIPELINE_DESIGN.md](./PIPELINE_DESIGN.md) for v1 scope and operating
details.

## Subflows and verification

The main flow coordinates extraction, event validation, KPI calculation,
staging and publication through five sequential Prefect subflows. A sixth
subflow writes optional evaluation evidence with `return_state=True`; its
failure does not fail an already published report. Database subflows require
an existing audited `run_id` and an acquired lease for their week; arguments
and return values carry all intermediate data. Pure transformations remain in
`data/process/business_performance.py`.

Activate the API virtual environment and run from the repository root:

```bash
python -m pytest tests/pipelines/test_pipeline.py
python -m pytest tests/pipelines data/pipelines/tests
python data/pipelines/pipeline.py
```

Alternatively prefix commands with `uv run --project services/api`.
`uv run pytest` at the root also runs both pipeline test directories in the
API environment. The CLI integration test uses disposable SQLite databases,
verifies a restorable backup, and checks unchanged source bytes and stable
published rows across two runs.

The admin-only backoffice page `/reporting` reads the existing reporting GET
endpoint. It opens the latest published week and accepts a Monday ISO date in
`?week_start=YYYY-MM-DD`. EUR and USD remain separate. No rows means no
published data for the requested week, not zero business activity.
