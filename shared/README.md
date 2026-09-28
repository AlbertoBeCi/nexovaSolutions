# `shared` folder

This folder is reserved for **unbundled shared resources** in the monorepo: templates, schemas, common assets, short technical documentation, or configuration shared across several components.

- **Main purpose**: provide a neutral place for reusable items that do not fit as an application (`apps/`) or as a package/library (`packages/`).
- **Recommendation**: document what each subfolder or file contains and link to it from consuming components to keep traceability.

## `incidents_analysis.py`

Compatibility shim. The actual code moved to
[`packages/shared/nexova_shared/incidents_analysis.py`](../packages/shared/README.md)
(a proper `packages/` module, since it's imported by 2+ folders:
`scripts/` and `services/api/`). This file only re-exports it so existing
`from shared.incidents_analysis import ...` imports keep working. New code
should import `nexova_shared.incidents_analysis` directly.

> _Spanish version: [README.es.md](./README.es.md)._
