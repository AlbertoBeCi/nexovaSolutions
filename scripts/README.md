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

> _Spanish version: [README.es.md](./README.es.md)._
