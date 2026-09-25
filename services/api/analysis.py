"""
Adaptador HTTP sobre la logica de negocio compartida de shared/incidents_analysis.py.

No repite ninguna regla de validacion ni de calculo de metricas: solo
adapta el modulo compartido a lo que necesita un servicio web (bytes de
un UploadFile como entrada, CSV en bytes como salida) y re-exporta lo que
routes/incidents.py necesita, para que ese archivo no tenga que
conocer la ruta hacia shared/.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

# shared/ vive en la raiz del repo, dos niveles por encima de services/api/.
# Se añade a sys.path en vez de convertir el repo en un paquete pip
# instalado, siguiendo la convencion de shared/README.md ("recursos
# compartidos no empaquetados").
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from shared.incidents_analysis import (  # noqa: E402
    InvalidCsvError,
    build_summary,
    load_dataframe,
    summary_to_csv_rows,
)

__all__ = ["InvalidCsvError", "analyze_csv", "summary_to_csv_bytes"]


def analyze_csv(raw_bytes: bytes, source_filename: str) -> dict:
    """Bytes de un CSV subido por HTTP -> resumen agregado (dict serializable a JSON)."""
    df = load_dataframe(io.BytesIO(raw_bytes))
    return build_summary(df, source_filename)


def summary_to_csv_bytes(summary: dict) -> bytes:
    """Resumen (con o sin 'analyzed_at') -> bytes de un CSV de una fila por metrica."""
    import pandas as pd

    rows = summary_to_csv_rows(summary)
    buffer = io.StringIO()
    pd.DataFrame(rows, columns=["metric", "value"], dtype=object).to_csv(buffer, index=False)
    return buffer.getvalue().encode("utf-8")
