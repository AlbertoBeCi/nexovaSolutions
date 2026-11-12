-- Nightly telemetry job orchestration table (job_runs).
-- Apply explicitly after 002_weekly_business_reporting.sql.
-- Note: job_runs tracks nightly orchestration (CSV backup export, pipeline
-- subprocess trigger, distributed lock via 'processing', and daily idempotency
-- via target_date). It is distinct from reporting.pipeline_runs (internal ETL).
BEGIN;

CREATE TABLE IF NOT EXISTS public.job_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name text NOT NULL CHECK (length(trim(job_name)) > 0),
    target_date date NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    started_at timestamptz,
    finished_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT job_runs_finished_after_start
        CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX IF NOT EXISTS ix_job_runs_job_name_target_date
    ON public.job_runs (job_name, target_date);

CREATE INDEX IF NOT EXISTS ix_job_runs_job_name_status
    ON public.job_runs (job_name, status);

COMMIT;
