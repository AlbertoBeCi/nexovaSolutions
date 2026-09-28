"""
Shim de compatibilidad: este modulo se movio a
packages/shared/nexova_shared/incidents_analysis.py (paquete Python
instalable `nexova-shared`, importado por 2+ carpetas: scripts/ y
services/api/, ver AGENTS.md seccion 3).

Se deja este re-export para que los importadores existentes
(`from shared.incidents_analysis import ...` en scripts/analyze.py y
services/api/analysis.py) sigan funcionando sin cambios: este shim resuelve
por su cuenta la ruta a packages/shared/ (mismo patron de sys.path que ya
usaban esos consumidores para llegar a shared/), asi que ninguno de los dos
necesita saber que el codigo se movio. El codigo nuevo debe importar
directamente `nexova_shared.incidents_analysis`.
"""
from __future__ import annotations

import sys
from pathlib import Path

# packages/shared/ vive en la raiz del repo, un nivel por encima de shared/.
_PACKAGES_SHARED = Path(__file__).resolve().parent.parent / "packages" / "shared"
if str(_PACKAGES_SHARED) not in sys.path:
    sys.path.insert(0, str(_PACKAGES_SHARED))

from nexova_shared.incidents_analysis import (  # noqa: E402,F401
    AGENT_ID_PATTERN,
    REQUIRED_COLUMNS,
    RULE_LABELS,
    VALID_CATEGORIES,
    VALID_STATUSES,
    InvalidCsvError,
    analyze_csv,
    apply_validation_rules,
    build_summary,
    csv_row_violations,
    load_dataframe,
    summary_to_csv_rows,
)
