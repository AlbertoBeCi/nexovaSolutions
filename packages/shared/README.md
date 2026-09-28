# `packages/shared`

Esta carpeta aloja **dos paquetes independientes**, uno por lenguaje, porque
ambos cumplen el mismo rol de `packages/` (código que importan 2+ carpetas):
`@repo/shared-types` (TypeScript) y `nexova-shared` (Python). Cada uno con su
propio manifiesto (`package.json` / `pyproject.toml`) y sus propios tests.

## `@repo/shared-types` (TypeScript)

Tipos TypeScript compartidos entre aplicaciones, servicios y agentes del
monorepo.

### Estado

Plantilla. `types/index.ts` solo tiene los placeholders `Id` y `BaseEntity`.

### Qué poner aquí

- Interfaces que **dos o más** áreas (`uis/`, `services/`, `agents/`) necesitan
  compartir — p. ej. el contrato de la API de candidatos.
- Nada específico de una sola app: eso vive en la carpeta de esa app.
- Lógica de negocio (scoring, filtros) no va aquí; va en
  [`@repo/domain`](../domain/README.md).

### Uso

```jsonc
// package.json del consumidor
"dependencies": { "@repo/shared-types": "*" }
```

```ts
import type { BaseEntity } from "@repo/shared-types";
```

## `nexova-shared` (Python)

Lógica de dominio Python compartida entre `scripts/`, `services/api/` y
`services/incident-manager-api/`, para que la validación no pueda divergir
entre esos consumidores. Proyecto `uv` independiente (`pyproject.toml`
propio); no forma parte de un workspace `uv` — cada consumidor lo alcanza
con el mismo patrón de `sys.path` que ya usaba el repo para `shared/` (ver
`shared/README.md`), no como una dependencia `uv`/`pip` instalada.

### Submódulos

- **`nexova_shared/incidents_analysis.py`** — reglas de validación y
  métricas del **analizador** de CSVs de tickets de soporte
  (`scripts/analyze.py`, `POST /api/incidents/analyze`). Es el módulo
  histórico, movido aquí desde `shared/incidents_analysis.py` (que ahora
  solo reexporta este módulo como *shim* de compatibilidad — ver su
  docstring). Añade `csv_row_violations(row)`, la versión fila a fila de
  `apply_validation_rules(df)` que usa `scripts/seed_incidents.py`; un test
  de regresión (`tests/test_analysis_rules.py`) verifica que ambas
  versiones nunca divergen.
- **`nexova_shared/incident_constants.py`** — enums, etiquetas en español y
  transiciones de estado del **gestor de incidencias** (modelo persistente
  en `services/incident-manager-api/`). No confundir con las categorías en
  mayúsculas del analizador de arriba: son dos dominios distintos.
- **`nexova_shared/incident_validation.py`** — `validate_incident()` (campos
  obligatorios y valores permitidos, errores por campo en español) e
  `is_valid_transition()` (máquina de estados del gestor).
- **`nexova_shared/csv_mapping.py`** — `map_csv_row()`: transforma una fila
  del CSV del analizador en los campos del modelo `Incident` del gestor
  (usado solo por `scripts/seed_incidents.py`).

### Tests

```bash
cd packages/shared
uv sync
uv run pytest
```

### Uso desde un consumidor nuevo (sin instalar el paquete)

```python
import sys
from pathlib import Path

_PACKAGES_SHARED = Path(__file__).resolve().parents[N] / "packages" / "shared"
if str(_PACKAGES_SHARED) not in sys.path:
    sys.path.insert(0, str(_PACKAGES_SHARED))

from nexova_shared.incident_constants import CATEGORIES, STATUSES
from nexova_shared.incident_validation import validate_incident, is_valid_transition
```
