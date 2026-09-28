# `scripts` folder

This folder contains **helper scripts** for the monorepo: development automation, maintenance utilities, repetitive tasks (setup, lint, migrations, data generation, etc.), and internal tooling.

- **Main purpose**: group support tools that do not belong to a specific app, agent, or pipeline but make the team’s work easier.
- **Recommendation**: document each script (what it does, parameters, requirements, usage examples) and keep them reproducible (and safe) across environments.

## `analyze.py` — support ticket analysis (Nexova)

Python script (requires `pandas`, install with `pip install pandas`) that processes a
support ticket CSV, flags invalid records, and computes metrics by category, status,
and customer satisfaction, without ever exposing individual customer emails.

```bash
pip install pandas
python scripts/analyze.py scripts/incidents-COMPANY.csv   # or run with no argument to be prompted
```

- `generate_incidents_fixture.py`: generates a reproducible synthetic test CSV
  (`incidents-COMPANY.csv`) with fictitious data, used to test `analyze.py`.
- `APRENDIENDO.md`: step-by-step walkthrough of the script, written (in Spanish) for
  someone new to Python and pandas.

## `seed_incidents.py` — loads the incident manager (Nexova)

Loads `incidents-COMPANY.csv` into the persisted incident manager
(`services/incident-manager-api/`), applying the same 7 validation rules as
`analyze.py` plus a CSV → `Incident` mapping (see that service's README).
Needs `services/incident-manager-api`'s dependencies (SQLAlchemy + pandas),
so it's run with its `uv` environment rather than a bare `python`:

```bash
uv run --project services/incident-manager-api python scripts/seed_incidents.py
```

Idempotent: running it twice inserts 0 the second time (see
`services/incident-manager-api/README.md` for the expected counts and the
CHECK-constraint-backed data model it feeds).

> _Spanish version: [README.es.md](./README.es.md)._
