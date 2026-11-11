"""Adapter that exposes the business reporting router from its domain module."""
from __future__ import annotations

import sys
from pathlib import Path

_SERVICES_ROOT = Path(__file__).resolve().parents[1]
if str(_SERVICES_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICES_ROOT))

from reporting.router import router  # noqa: E402

__all__ = ["router"]
