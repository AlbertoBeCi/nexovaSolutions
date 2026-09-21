"""
Analiza un CSV de tickets de soporte de Nexova con pandas.

Uso:
    python scripts/analyze.py ruta/al/archivo.csv
    python scripts/analyze.py                     (pide la ruta de forma interactiva)

La logica de validacion y calculo de metricas vive en
shared/incidents_analysis.py (la misma que usa services/api): este
archivo solo se ocupa de lo especifico de la linea de comandos (leer
argv/input, imprimir el reporte, preguntar por la exportacion).

Nota de privacidad: este script nunca imprime, registra ni exporta un
customer_email individual. Solo trabaja con agregados (conteos, promedios,
porcentajes). Ver scripts/APRENDIENDO.md para una explicacion paso a paso.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

# shared/ vive en la raiz del repo, un nivel por encima de scripts/.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from shared.incidents_analysis import (  # noqa: E402
    InvalidCsvError,
    RULE_LABELS,
    build_summary,
    load_dataframe,
    summary_to_csv_rows,
)

RESULTS_FILENAME = "results.csv"
DIVIDER = "=" * 60
EXPORT_YES = {"s", "si", "sí", "y", "yes"}

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


def _row(branch: str, label: str, value: str, width: int = 32) -> str:
    dots = "." * max(1, width - len(label))
    return f"  {branch} {label} {dots} {value}"


def format_console_report(summary: dict, filename: str) -> str:
    lines = [
        DIVIDER,
        "  NEXOVA — SUPPORT TICKET ANALYSIS",
        f"  Source file: {filename}",
        DIVIDER,
        "",
        f"TOTAL RECORDS IN FILE {'.' * 10} {summary['total_records']}",
        f"  ├─ Valid records {'.' * 16} {summary['valid_records']}",
        f"  └─ Invalid / incomplete {'.' * 10} {summary['invalid_records']}",
        "",
        "INVALID RECORDS BREAKDOWN",
    ]

    rule_items = list(RULE_LABELS.items())
    for i, (key, label) in enumerate(rule_items):
        branch = "└─" if i == len(rule_items) - 1 else "├─"
        lines.append(_row(branch, label, summary["invalid_breakdown"][key]))

    lines += ["", "BREAKDOWN BY CATEGORY (valid records)"]
    cats = list(summary["categories"].items())
    for i, (cat, data) in enumerate(cats):
        branch = "└─" if i == len(cats) - 1 else "├─"
        value = f"{data['count']}  ({data['percentage']:.1f}%)"
        lines.append(_row(branch, cat, value))

    lines += ["", "BREAKDOWN BY STATUS (valid records)"]
    stats = list(summary["statuses"].items())
    for i, (st, data) in enumerate(stats):
        branch = "└─" if i == len(stats) - 1 else "├─"
        value = f"{data['count']}  ({data['percentage']:.1f}%)"
        lines.append(_row(branch, st, value))

    satisfaction = summary["satisfaction"]
    lines += [
        "",
        "SATISFACTION INDEX (closed tickets)",
        f"  Scored tickets: {satisfaction['scored_tickets']} of {satisfaction['closed_tickets']}",
        f"  Average score: {satisfaction['average_score']:.2f} / 5.00",
    ]
    score_items = list(satisfaction["distribution"].items())
    for i, (score, count) in enumerate(score_items):
        branch = "└─" if i == len(score_items) - 1 else "├─"
        lines.append(_row(branch, SCORE_LABELS[int(score)], count))

    lines += ["", DIVIDER]
    return "\n".join(lines)


def export_to_csv(summary: dict, output_path: Path) -> None:
    rows = summary_to_csv_rows(summary)
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

    try:
        df = load_dataframe(str(csv_path))
    except InvalidCsvError as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    summary = build_summary(df, csv_path.name)

    print(format_console_report(summary, csv_path.name))
    prompt_export(summary)


if __name__ == "__main__":
    main()
