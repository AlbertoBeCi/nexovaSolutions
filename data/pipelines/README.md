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
