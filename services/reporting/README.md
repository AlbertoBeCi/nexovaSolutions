# Business reporting routes

This module exposes admin-only endpoints for the weekly office/program business
performance pipeline. It is mounted into the existing FastAPI application by
`services/api/reporting_adapter.py`; it is not a separate service.

The router imports its pipeline operations from `data/pipelines/pipeline.py`.
It does not query telemetry or implement ETL. The report endpoint reads only
`reporting.weekly_office_program_performance`; the manual run endpoint submits a
Prefect deployment.

See [the pipeline design and operating instructions](../../data/pipelines/PIPELINE_DESIGN.md)
and [`services/api/README.md`](../api/README.md).
