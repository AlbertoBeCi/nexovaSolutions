-- Upgrade the earlier telemetry table to the immutable 8-column contract.
-- Existing allowlisted properties are merged into tags before their source
-- column is removed. No event rows are deleted.
BEGIN;

DO $$
DECLARE
    has_properties boolean;
    primary_key_name text;
BEGIN
    IF to_regclass('public.telemetry_events') IS NULL THEN
        RAISE EXCEPTION 'public.telemetry_events must exist before this migration';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'telemetry_events'
          AND column_name = 'properties'
    ) INTO has_properties;

    IF has_properties THEN
        UPDATE public.telemetry_events AS event
        SET tags = jsonb_strip_nulls(
            COALESCE((
                SELECT jsonb_object_agg(property.key, property.value)
                FROM jsonb_each(
                    COALESCE(event.tags, '{}'::jsonb)
                    || COALESCE(event.properties, '{}'::jsonb)
                ) AS property(key, value)
                WHERE property.key = ANY (ARRAY[
                    'office', 'product_id', 'product_category', 'programme_id',
                    'quantity', 'currency', 'unit_cost', 'unit_cost_current',
                    'unit_cost_reference', 'variance_pct', 'threshold', 'reason',
                    'order_id', 'page', 'route', 'page_view_id', 'route_template',
                    'source', 'environment', 'actor_type', 'authority',
                    'key_version', 'ui_language', 'action', 'error_type', 'stage',
                    'filter_name', 'status_code', 'duration_ms', 'flow_id',
                    'flow_name', 'step_name'
                ]) AND property.value <> 'null'::jsonb
            ), '{}'::jsonb)
            || jsonb_build_object('event_type', event.event_type)
        );
    END IF;

    SELECT conname INTO primary_key_name
    FROM pg_constraint
    WHERE conrelid = 'public.telemetry_events'::regclass AND contype = 'p';

    IF primary_key_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.telemetry_events DROP CONSTRAINT %I', primary_key_name);
    END IF;

    ALTER TABLE public.telemetry_events
        DROP CONSTRAINT IF EXISTS telemetry_events_event_id_key,
        DROP COLUMN IF EXISTS id,
        DROP COLUMN IF EXISTS properties,
        DROP COLUMN IF EXISTS stored_at,
        ADD CONSTRAINT telemetry_events_pkey PRIMARY KEY (event_id);

    ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
    REVOKE ALL PRIVILEGES ON TABLE public.telemetry_events FROM PUBLIC;
    REVOKE ALL PRIVILEGES ON TABLE public.telemetry_events FROM anon, authenticated, service_role;
END $$;

CREATE INDEX IF NOT EXISTS ix_telemetry_events_timestamp
    ON public.telemetry_events (timestamp);
CREATE INDEX IF NOT EXISTS ix_telemetry_events_event_type
    ON public.telemetry_events (event_type);
CREATE INDEX IF NOT EXISTS ix_telemetry_events_tags_gin
    ON public.telemetry_events USING gin (tags);

COMMIT;
