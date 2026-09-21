"""
Logica de negocio para analizar tickets de soporte de Nexova.

Es una version portada de scripts/analyze.py (mismas reglas y constantes),
pero pensada para un servicio web: no usa sys.exit, no lee stdin/argv y
nunca deja pasar el DataFrame completo hacia fuera de este modulo (solo
agregados), para garantizar que un customer_email nunca llegue a una
respuesta HTTP.
"""
from __future__ import annotations

import io
import operator
from functools import reduce

import pandas as pd

VALID_CATEGORIES = ["TECHNICAL", "BILLING", "ACCESS", "HR_QUERY", "COMPLAINT"]
VALID_STATUSES = ["OPEN", "CLOSED", "DISCARDED"]
REQUIRED_COLUMNS = [
    "ticket_id", "date", "client_company", "category", "description",
    "agent_id", "status", "customer_email", "satisfaction_score",
]
AGENT_ID_PATTERN = r"^AGT-\d{2}$"

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


def load_dataframe(raw_bytes: bytes) -> pd.DataFrame:
    """Construye un DataFrame a partir de los bytes crudos de un CSV subido."""
    try:
        df = pd.read_csv(
            io.BytesIO(raw_bytes),
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


def build_summary(df: pd.DataFrame, source_filename: str) -> dict:
    """Unica fuente de verdad del resumen: la usan tanto la respuesta JSON
    del analisis como la exportacion a CSV. Solo contiene agregados."""
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
        "source_file": source_filename,
        "total_records": len(df),
        "valid_records": valid_count,
        "invalid_records": int(invalid_mask.sum()),
        "invalid_breakdown": {
            name: int(mask.sum()) for name, mask in masks.items()
        },
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


def summary_to_csv_bytes(summary: dict) -> bytes:
    """Aplana el resumen a filas metric,value (una fila por metrica)."""
    rows: list[tuple[str, object]] = [
        ("source_file", summary["source_file"]),
        ("analyzed_at", summary.get("analyzed_at", "")),
        ("total_records", summary["total_records"]),
        ("valid_records", summary["valid_records"]),
        ("invalid_records", summary["invalid_records"]),
    ]
    rows += [
        (f"rule_{name}", count) for name, count in summary["invalid_breakdown"].items()
    ]
    rows += [
        (f"category_{cat}_count", data["count"])
        for cat, data in summary["categories"].items()
    ]
    rows += [
        (f"category_{cat}_pct", data["percentage"])
        for cat, data in summary["categories"].items()
    ]
    rows += [
        (f"status_{st}_count", data["count"])
        for st, data in summary["statuses"].items()
    ]
    rows += [
        (f"status_{st}_pct", data["percentage"])
        for st, data in summary["statuses"].items()
    ]
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

    buffer = io.StringIO()
    pd.DataFrame(rows, columns=["metric", "value"], dtype=object).to_csv(buffer, index=False)
    return buffer.getvalue().encode("utf-8")


def analyze_csv(raw_bytes: bytes, source_filename: str) -> dict:
    """Punto de entrada unico: bytes de CSV -> resumen agregado (dict serializable a JSON)."""
    df = load_dataframe(raw_bytes)
    return build_summary(df, source_filename)
