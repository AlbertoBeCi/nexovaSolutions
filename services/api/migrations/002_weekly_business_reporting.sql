-- Business reporting storage for the Prefect weekly performance pipeline.
-- Apply explicitly after 001_telemetry_events_eight_columns.sql.
BEGIN;

CREATE SCHEMA IF NOT EXISTS reporting;

CREATE TABLE reporting.weekly_office_program_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office text NOT NULL CHECK (office IN ('valencia', 'miami')),
    programme_id text NOT NULL CHECK (length(trim(programme_id)) > 0),
    week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    total_material_cost numeric NOT NULL DEFAULT 0 CHECK (total_material_cost >= 0),
    kits_delivered_count integer NOT NULL DEFAULT 0 CHECK (kits_delivered_count >= 0),
    shortage_events_count integer NOT NULL DEFAULT 0 CHECK (shortage_events_count >= 0),
    cost_variance_events_count integer NOT NULL DEFAULT 0 CHECK (cost_variance_events_count >= 0),
    currency text NOT NULL CHECK (
        (office = 'valencia' AND currency = 'EUR') OR
        (office = 'miami' AND currency = 'USD')
    ),
    computed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT weekly_office_program_performance_grain
        UNIQUE (office, programme_id, week_start)
);

CREATE TABLE reporting.pipeline_runs (
    run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_name text NOT NULL,
    trigger text NOT NULL CHECK (trigger IN ('schedule', 'manual', 'backfill')),
    status text NOT NULL CHECK (status IN ('Running', 'Completed', 'Failed')),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    requested_by text,
    week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    source_window_end timestamptz NOT NULL,
    phase text NOT NULL,
    checkpoint text NOT NULL,
    source_watermark timestamptz,
    events_read integer NOT NULL DEFAULT 0 CHECK (events_read >= 0),
    events_valid integer NOT NULL DEFAULT 0 CHECK (events_valid >= 0),
    events_duplicate integer NOT NULL DEFAULT 0 CHECK (events_duplicate >= 0),
    events_rejected integer NOT NULL DEFAULT 0 CHECK (events_rejected >= 0),
    rows_written integer NOT NULL DEFAULT 0 CHECK (rows_written >= 0),
    input_digest text,
    output_digest text,
    prefect_flow_run_id text,
    error_code text,
    error_summary text,
    CONSTRAINT pipeline_runs_finished_after_start
        CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX pipeline_runs_latest_idx
    ON reporting.pipeline_runs (pipeline_name, started_at DESC);

CREATE TABLE reporting.pipeline_staging (
    run_id uuid NOT NULL REFERENCES reporting.pipeline_runs(run_id) ON DELETE CASCADE,
    office text NOT NULL CHECK (office IN ('valencia', 'miami')),
    programme_id text NOT NULL CHECK (length(trim(programme_id)) > 0),
    week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    total_material_cost numeric NOT NULL CHECK (total_material_cost >= 0),
    kits_delivered_count integer NOT NULL CHECK (kits_delivered_count >= 0),
    shortage_events_count integer NOT NULL CHECK (shortage_events_count >= 0),
    cost_variance_events_count integer NOT NULL CHECK (cost_variance_events_count >= 0),
    currency text NOT NULL CHECK (
        (office = 'valencia' AND currency = 'EUR') OR
        (office = 'miami' AND currency = 'USD')
    ),
    aggregate_json jsonb NOT NULL,
    output_digest text NOT NULL,
    staged_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (run_id, office, programme_id, week_start)
);

CREATE TABLE reporting.pipeline_locks (
    pipeline_name text NOT NULL,
    week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    owner_run_id uuid NOT NULL REFERENCES reporting.pipeline_runs(run_id) ON DELETE CASCADE,
    lease_expires_at timestamptz NOT NULL,
    heartbeat_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (pipeline_name, week_start)
);

CREATE TABLE reporting.pipeline_lineage (
    run_id uuid NOT NULL REFERENCES reporting.pipeline_runs(run_id) ON DELETE CASCADE,
    event_id text NOT NULL,
    event_type text NOT NULL,
    source_timestamp timestamptz NOT NULL,
    office text NOT NULL,
    programme_id text NOT NULL,
    week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    PRIMARY KEY (run_id, event_id)
);

CREATE INDEX pipeline_lineage_output_idx
    ON reporting.pipeline_lineage (run_id, office, programme_id, week_start);

COMMIT;
