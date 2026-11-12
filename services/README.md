# `services` folder

This folder contains **all the backend services** (APIs and background workers) related to the company for the cross-functional AI Engineering project.

Each subfolder inside `services/` must correspond to **one specific service** (for example: `admin-api`, `data-processor-worker`) and include its own technical and functional documentation.

- **Main purpose**: to centralize all the backend logic, APIs, and queue consumers that support the company's use cases.
- **Recommendation**: document in this file (or in sub-READMEs) the services you add, their objective, the technology used, and how to run them.

## Services Overview

- `api/`: Main FastAPI backend application for talent, suppliers, inventory, auth, telemetry storage, and reporting endpoints.
- `incident-manager-api/`: Dedicated SQLite/SQLAlchemy incident management service.
- `job_runner/`: State-control module for background jobs (`job_runs` table). Manages the canonical state machine (`pending -> processing -> completed | failed`), distributed locks via `processing`, and daily idempotency. Independent of FastAPI.
- `reporting/`: Business reporting endpoints and adapters.
- `telemetry/`: Operational telemetry analysis.

> _Spanish version: [README.es.md](./README.es.md)._
