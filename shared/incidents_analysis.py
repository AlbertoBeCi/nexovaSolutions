"""
Logica de negocio compartida para analizar tickets de soporte de Nexova.

Este modulo es la UNICA fuente de verdad de las reglas de validacion y del
calculo de metricas: tanto scripts/analyze.py (CLI) como
services/api/app/analysis.py (FastAPI) importan de aqui en vez de tener su
propia copia de las reglas, para que no puedan divergir con el tiempo.

Es codigo puro (pandas + stdlib), sin dependencias de CLI (argparse/input)
ni de un framework web (FastAPI): esos detalles viven en cada consumidor.
Vive en shared/ (no en scripts/ ni en services/api/) porque lo usan ambos
por igual: ver shared/README.md.
"""
from __future__ import annotations

import operator
from functools import reduce
from typing import IO

import pandas as pd

VALID_CATEGORIES = ["TECHNICAL", "BILLING", "ACCESS", "HR_QUERY", "COMPLAINT"]
VALID_STATUSES = ["OPEN", "CLOSED", "DISCARDED"]
REQUIRED_COLUMNS = [
    "ticket_id", "date", "client_company", "category", "description",
    "agent_id", "status", "customer_email", "satisfaction_score",
]
AGENT_ID_PATTERN = r"^AGT-\d{2}$"

# Orden canonico de las 7 reglas de invalidez, con su etiqueta en ingles
# (formato de consola original). Cada consumidor puede traducir estas
# claves a su propio idioma/formato de presentacion (ver, por ejemplo,
# uis/backoffice/src/types/incidents.ts para las etiquetas en espanol
# que usa el frontend) sin duplicar la logica de deteccion en si.
RULE_LABELS = {
    "missing_company": "Missing client_company",
    "invalid_category": "Invalid or missing category",
    "short_description": "Description too short/empty",
    "invalid_agent_id": "Invalid or missing agent_id",
    "invalid_email": "Invalid or missing email",
    "closed_no_score": "Closed ticket, no score",
    "score_out_of_range": "Score out of range",
}


class InvalidCsvError(ValueError):
    """Se lanza cuando el CSV no se puede parsear o le faltan columnas requeridas."""


def load_dataframe(source: str | IO[bytes] | IO[str]) -> pd.DataFrame:
    """Carga un CSV de tickets desde una ruta de archivo o un buffer de bytes.

    `pandas.read_csv` acepta indistintamente una ruta (`Path`/`str`) o un
    objeto tipo archivo (por ejemplo `io.BytesIO`), asi que la misma
    funcion sirve tanto para scripts/analyze.py (ruta en disco) como para
    services/api (bytes subidos por HTTP), sin necesidad de dos variantes.
    """
    try:
        df = pd.read_csv(
            source,
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
        )
    except pd.errors.EmptyDataError as exc:
        raise InvalidCsvError("El archivo esta vacio.") from exc
    except pd.errors.ParserError as exc:
        raise InvalidCsvError("El archivo no es un CSV valido.") from exc
    except UnicodeDecodeError as exc:
        raise InvalidCsvError("El archivo no esta codificado en UTF-8.") from exc

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise InvalidCsvError(
            f"Faltan columnas requeridas en el CSV: {', '.join(missing)}"
        )

    return df


def apply_validation_rules(df: pd.DataFrame) -> dict[str, pd.Series]:
    """Devuelve las 7 mascaras booleanas de invalidez, una por regla de negocio."""
    score_num = pd.to_numeric(df["satisfaction_score"], errors="coerce")
    status = df["status"].str.strip()

    return {
        "missing_company": df["client_company"].str.strip() == "",
        "invalid_category": ~df["category"].str.strip().isin(VALID_CATEGORIES),
        "short_description": df["description"].str.strip().str.len() < 5,
        "invalid_agent_id": ~df["agent_id"].str.match(AGENT_ID_PATTERN, na=False),
        "invalid_email": ~df["customer_email"].str.contains("@", na=False),
        "closed_no_score": (status == "CLOSED") & score_num.isna(),
        "score_out_of_range": score_num.notna() & ~score_num.between(1, 5),
    }


def build_summary(df: pd.DataFrame, source_name: str) -> dict:
    """Unica fuente de verdad del resumen agregado: la consumen tanto la
    salida de consola del script como la respuesta JSON y el CSV de
    exportacion de la API. Solo contiene agregados (nunca filas ni
    customer_email), para que ningun consumidor pueda filtrar PII por
    accidente."""
    masks = apply_validation_rules(df)
    invalid_mask = reduce(operator.or_, masks.values())
    valid_mask = ~invalid_mask
    valid_df = df.loc[valid_mask]

    valid_count = int(valid_mask.sum())

    category_counts = (
        valid_df["category"].str.strip().value_counts().reindex(VALID_CATEGORIES, fill_value=0)
    )
    status_counts = (
        valid_df["status"].str.strip().value_counts().reindex(VALID_STATUSES, fill_value=0)
    )

    closed_valid = valid_df[valid_df["status"].str.strip() == "CLOSED"]
    scores = pd.to_numeric(closed_valid["satisfaction_score"], errors="coerce")
    scored = scores.dropna()
    score_dist = scored.value_counts().reindex([1, 2, 3, 4, 5], fill_value=0)

    def _pct(count: int) -> float:
        return round(count / valid_count * 100, 1) if valid_count else 0.0

    return {
        "source_file": source_name,
        "total_records": len(df),
        "valid_records": valid_count,
        "invalid_records": int(invalid_mask.sum()),
        "invalid_breakdown": {name: int(mask.sum()) for name, mask in masks.items()},
        "categories": {
            cat: {"count": int(count), "percentage": _pct(int(count))}
            for cat, count in category_counts.items()
        },
        "statuses": {
            st: {"count": int(count), "percentage": _pct(int(count))}
            for st, count in status_counts.items()
        },
        "satisfaction": {
            "closed_tickets": len(closed_valid),
            "scored_tickets": int(scored.count()),
            "average_score": round(float(scored.mean()), 2) if len(scored) else 0.0,
            "distribution": {str(score): int(count) for score, count in score_dist.items()},
        },
    }


def summary_to_csv_rows(summary: dict) -> list[tuple[str, object]]:
    """Aplana un resumen (de build_summary, opcionalmente con 'analyzed_at'
    añadido por el consumidor) a pares (metric, value): una fila por
    metrica, formato usado tanto por `results.csv` del script como por el
    CSV que exporta GET /api/incidents/results/export."""
    rows: list[tuple[str, object]] = [
        ("source_file", summary["source_file"]),
    ]
    if "analyzed_at" in summary:
        rows.append(("analyzed_at", summary.get("analyzed_at") or ""))
    rows += [
        ("total_records", summary["total_records"]),
        ("valid_records", summary["valid_records"]),
        ("invalid_records", summary["invalid_records"]),
    ]
    rows += [(f"rule_{name}", count) for name, count in summary["invalid_breakdown"].items()]
    rows += [
        (f"category_{cat}_count", data["count"]) for cat, data in summary["categories"].items()
    ]
    rows += [
        (f"category_{cat}_pct", data["percentage"]) for cat, data in summary["categories"].items()
    ]
    rows += [(f"status_{st}_count", data["count"]) for st, data in summary["statuses"].items()]
    rows += [(f"status_{st}_pct", data["percentage"]) for st, data in summary["statuses"].items()]

    satisfaction = summary["satisfaction"]
    rows += [
        ("satisfaction_scored", satisfaction["scored_tickets"]),
        ("satisfaction_closed_total", satisfaction["closed_tickets"]),
        ("satisfaction_average", satisfaction["average_score"]),
    ]
    rows += [
        (f"satisfaction_score_{score}", count)
        for score, count in satisfaction["distribution"].items()
    ]
    return rows


def analyze_csv(source: str | IO[bytes] | IO[str], source_name: str) -> dict:
    """Punto de entrada unico: ruta o bytes de CSV -> resumen agregado."""
    df = load_dataframe(source)
    return build_summary(df, source_name)
