# `services/job_runner`

State-control module for background jobs in the Nexova monorepo (`job_runs` table).

## Purpose

Implements the canonical state machine for background orchestration tasks (`nightly_export`):

```
pending -> processing -> completed
                     \-> failed
```

- **Completely independent of FastAPI**: does not import or execute the HTTP API process.
- **Distributed lock via `processing`**: `has_processing_lock(job_name)` checks whether an instance of the job is currently in `processing` state. No separate lock column or table is used.
- **Daily idempotency via `target_date`**: `has_completed_for_date(job_name, target_date)` checks whether a `completed` run already exists for `(job_name, target_date)`.
- **No zombie runs**: `mark_job_failed(job_id, error_message)` transitions failed executions out of `processing` and stores the exception message.

## Main Functions

- `init_job_runs_db(engine)` — creates `job_runs` and its indices (`(job_name, target_date)` and `(job_name, status)`).
- `has_processing_lock(job_name="nightly_export", db=...) -> bool`
- `has_completed_for_date(job_name, target_date, db=...) -> bool`
- `create_job_run(job_name, target_date, status="pending", db=...) -> dict`
- `mark_job_processing(job_id, db=...) -> dict`
- `mark_job_completed(job_id, db=...) -> dict`
- `mark_job_failed(job_id, error_message, db=...) -> dict`
- `get_job_run(job_id, db=...) -> dict | None`
- `list_job_runs(job_name=None, target_date=None, status=None, db=...) -> list[dict]`

> _Spanish version: [README.es.md](./README.es.md)._
