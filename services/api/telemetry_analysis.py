"""Adapter importing shared telemetry metrics from the services package."""
from __future__ import annotations

import sys
from pathlib import Path

_SERVICES_ROOT = Path(__file__).resolve().parents[1]
if str(_SERVICES_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICES_ROOT))

from telemetry.analysis import (  # noqa: E402
    auth_failure_rate,
    events_per_day,
    latency_by_route,
    request_error_rate,
)

__all__ = ["auth_failure_rate", "events_per_day", "latency_by_route", "request_error_rate"]
