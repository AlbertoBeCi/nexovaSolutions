"""
Analiza un CSV de tickets de soporte de Nexova con pandas.

Uso:
    python scripts/analyze.py ruta/al/archivo.csv
    python scripts/analyze.py                     (pide la ruta de forma interactiva)

Nota de privacidad: este script nunca imprime, registra ni exporta un
customer_email individual. Solo trabaja con agregados (conteos, promedios,
porcentajes). Ver scripts/APRENDIENDO.md para una explicacion paso a paso.
"""
from __future__ import annotations

import argparse
import operator
import sys
from functools import reduce
from pathlib import Path

import pandas as pd

VALID_CATEGORIES = ["TECHNICAL", "BILLING", "ACCESS", "HR_QUERY", "COMPLAINT"]
VALID_STATUSES = ["OPEN", "CLOSED", "DISCARDED"]
REQUIRED_COLUMNS = [
    "ticket_id", "date", "client_company", "category", "description",
    "agent_id", "status", "customer_email", "satisfaction_score",
]
AGENT_ID_PATTERN = r"^AGT-\d{2}$"
RESULTS_FILENAME = "results.csv"
DIVIDER = "=" * 60
EXPORT_YES = {"s", "si", "sí", "y", "yes"}

RULE_LABELS = {
    "missing_company": "Missing client_company",
    "invalid_category": "Invalid or missing category",
    "short_description": "Description too short/empty",
    "invalid_agent_id": "Invalid or missing agent_id",
    "invalid_email": "Invalid or missing email",
    "closed_no_score": "Closed ticket, no score",
    "score_out_of_range": "Score out of range",
}

SCORE_LABELS = {
    1: "Score 1 (Very dissatisfied)",
    2: "Score 2 (Dissatisfied)",
    3: "Score 3 (Neutral)",
    4: "Score 4 (Satisfied)",
    5: "Score 5 (Very satisfied)",
}


def get_csv_path() -> Path:
    parser = argparse.ArgumentParser(
        description="Analiza un CSV de tickets de soporte de Nexova."
    )
    parser.add_argument(
        "csv_path",
        nargs="?",
        default=None,
        help="Ruta al archivo CSV de incidentes. Si se omite, se pedira de forma interactiva.",
    )
    args = parser.parse_args()

    if args.csv_path:
        return Path(args.csv_path)

    while True:
        try:
            raw = input("Ruta del archivo CSV de incidentes: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nOperacion cancelada.")
            sys.exit(1)
        if raw:
            return Path(raw)
        print("Debes indicar una ruta.")


def validate_file(path: Path) -> Path:
    if not path.exists() or not path.is_file():
        print(f"Error: el archivo '{path}' no existe.")
        sys.exit(1)
    try:
        with path.open("r", encoding="utf-8-sig"):
            pass
    except OSError:
        print(f"Error: no se pudo leer el archivo '{path}'.")
        sys.exit(1)
    return path


def load_data(path: Path) -> pd.DataFrame:
    try:
        df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except (pd.errors.EmptyDataError, pd.errors.ParserError):
        print(f"Error: '{path}' no es un CSV valido o esta vacio.")
        sys.exit(1)

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        print(f"Error: faltan columnas requeridas en el CSV: {', '.join(missing)}")
        sys.exit(1)

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


def build_summary(df: pd.DataFrame, masks: dict[str, pd.Series]) -> dict:
    invalid_mask = reduce(operator.or_, masks.values())
    valid_mask = ~invalid_mask
    valid_df = df.loc[valid_mask]

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

    return {
        "total": len(df),
        "valid_count": int(valid_mask.sum()),
        "invalid_count": int(invalid_mask.sum()),
        "rule_counts": {name: int(mask.sum()) for name, mask in masks.items()},
        "category_counts": category_counts,
        "status_counts": status_counts,
        "closed_count": len(closed_valid),
        "scored_count": int(scored.count()),
        "average": float(scored.mean()) if len(scored) else 0.0,
        "score_dist": score_dist,
    }


def _row(branch: str, label: str, value: str, width: int = 32) -> str:
    dots = "." * max(1, width - len(label))
    return f"  {branch} {label} {dots} {value}"


def _pct(count: int, total: int) -> str:
    return f"({count / total * 100:.1f}%)" if total else "(0.0%)"


def format_console_report(summary: dict, filename: str) -> str:
    lines = [
        DIVIDER,
        "  NEXOVA — SUPPORT TICKET ANALYSIS",
        f"  Source file: {filename}",
        DIVIDER,
        "",
        f"TOTAL RECORDS IN FILE {'.' * 10} {summary['total']}",
        f"  ├─ Valid records {'.' * 16} {summary['valid_count']}",
        f"  └─ Invalid / incomplete {'.' * 10} {summary['invalid_count']}",
        "",
        "INVALID RECORDS BREAKDOWN",
    ]

    rule_items = list(RULE_LABELS.items())
    for i, (key, label) in enumerate(rule_items):
        branch = "└─" if i == len(rule_items) - 1 else "├─"
        lines.append(_row(branch, label, summary["rule_counts"][key]))

    lines += ["", "BREAKDOWN BY CATEGORY (valid records)"]
    cats = list(summary["category_counts"].items())
    for i, (cat, count) in enumerate(cats):
        branch = "└─" if i == len(cats) - 1 else "├─"
        value = f"{count}  {_pct(count, summary['valid_count'])}"
        lines.append(_row(branch, cat, value))

    lines += ["", "BREAKDOWN BY STATUS (valid records)"]
    stats = list(summary["status_counts"].items())
    for i, (st, count) in enumerate(stats):
        branch = "└─" if i == len(stats) - 1 else "├─"
        value = f"{count}  {_pct(count, summary['valid_count'])}"
        lines.append(_row(branch, st, value))

    lines += [
        "",
        "SATISFACTION INDEX (closed tickets)",
        f"  Scored tickets: {summary['scored_count']} of {summary['closed_count']}",
        f"  Average score: {summary['average']:.2f} / 5.00",
    ]
    score_items = list(summary["score_dist"].items())
    for i, (score, count) in enumerate(score_items):
        branch = "└─" if i == len(score_items) - 1 else "├─"
        lines.append(_row(branch, SCORE_LABELS[score], count))

    lines += ["", DIVIDER]
    return "\n".join(lines)


def export_to_csv(summary: dict, output_path: Path) -> None:
    rows = [
        ("total_records", summary["total"]),
        ("valid_records", summary["valid_count"]),
        ("invalid_records", summary["invalid_count"]),
    ]
    rows += [(f"rule_{name}", count) for name, count in summary["rule_counts"].items()]
    rows += [
        (f"category_{cat}_count", count)
        for cat, count in summary["category_counts"].items()
    ]
    rows += [
        (f"status_{status}_count", count)
        for status, count in summary["status_counts"].items()
    ]
    rows += [
        ("satisfaction_scored", summary["scored_count"]),
        ("satisfaction_closed_total", summary["closed_count"]),
        ("satisfaction_average", round(summary["average"], 2)),
    ]
    rows += [
        (f"satisfaction_score_{score}", count)
        for score, count in summary["score_dist"].items()
    ]

    # dtype=object evita que pandas "sobre-escale" los conteos enteros a
    # float64 solo porque el promedio de satisfaccion es decimal.
    pd.DataFrame(rows, columns=["metric", "value"], dtype=object).to_csv(
        output_path, index=False
    )
    print(f"Resultados exportados a: {output_path}")


def prompt_export(summary: dict) -> None:
    try:
        answer = input("¿Deseas exportar los resultados a CSV? [s / n]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\nNo se exporto nada.")
        return

    if answer in EXPORT_YES:
        output_path = Path(__file__).resolve().parent / RESULTS_FILENAME
        export_to_csv(summary, output_path)
    else:
        print("No se exporto nada.")


def main() -> None:
    # La consola de Windows suele usar cp1252/cp850, que no soportan los
    # caracteres de caja (├─, └─, —) usados en el reporte. Forzamos UTF-8.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    csv_path = validate_file(get_csv_path())
    df = load_data(csv_path)
    masks = apply_validation_rules(df)
    summary = build_summary(df, masks)

    print(format_console_report(summary, csv_path.name))
    prompt_export(summary)


if __name__ == "__main__":
    main()
