"""Ejecutor raiz: `uv run pytest` desde la raiz del repo corre las baterias de
pruebas Python de cada area y falla si alguna falla.

Cada suite se lanza en su propio entorno (`uv run --directory <area> pytest`)
porque los servicios definen modulos con el mismo nombre (main, models,
config...) y dependencias distintas; no pueden convivir en un solo proceso."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SUITES = [
    "services/api",
    "services/incident-manager-api",
    "packages/shared",
]


@pytest.mark.parametrize("suite", SUITES)
def test_suite_passes(suite: str):
    # Se quita VIRTUAL_ENV del entorno raiz para que el `uv run` anidado use el
    # entorno del propio proyecto de cada area.
    env = {k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"}

    result = subprocess.run(
        ["uv", "run", "--directory", str(ROOT / suite), "pytest", "-q", "-p", "no:cacheprovider"],
        capture_output=True,
        text=True,
        env=env,
    )

    # Si falla, se muestra la salida de la suite (los FAILED con su assert).
    assert result.returncode == 0, f"\n{result.stdout[-4000:]}\n{result.stderr[-1500:]}"
