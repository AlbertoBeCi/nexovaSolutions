# Nexova telemetry analysis

This module loads bounded, relevant event rows from the append-only Supabase
`telemetry_events` table and transforms them with Pandas. Its independent
metrics are used by `GET /telemetry/report` in `services/api`:

- Event volume by UTC day and event type.
- Client-observed request failures by day and route.
- Client-observed request latency by day and route.
- Daily failed login ratio.

Every metric receives an explicit UTC window, applies its time and event-type
filters in SQL, converts timestamps before grouping, and returns JSON-ready
records. The module does not create a separate service or database connection.

Run its tests with `uv run pytest tests/test_telemetry_analysis.py` from
`services/api`.
