"""
Añade packages/shared/ a sys.path para poder importar nexova_shared.

packages/shared/ no esta instalado como dependencia uv/pip de este
servicio (ver packages/shared/README.md, seccion "Uso desde un consumidor
nuevo"): se alcanza con el mismo patron de sys.path que ya usaba el repo
para compartir shared/ entre scripts/ y services/api/, para no introducir
un mecanismo de dependencias inter-proyecto nuevo.

Se importa por su efecto secundario (`import shared_bootstrap  # noqa: F401`)
al principio de cualquier modulo de este servicio que necesite
`nexova_shared` (models.py, routes/incidents.py).
"""
from __future__ import annotations

import sys
from pathlib import Path

_PACKAGES_SHARED = Path(__file__).resolve().parents[2] / "packages" / "shared"
if str(_PACKAGES_SHARED) not in sys.path:
    sys.path.insert(0, str(_PACKAGES_SHARED))
