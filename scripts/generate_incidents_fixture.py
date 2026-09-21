"""
Genera un CSV sintetico de tickets de soporte para probar scripts/analyze.py.

Uso:
    python scripts/generate_incidents_fixture.py

Sobrescribe scripts/incidents-COMPANY.csv con 100 filas: 96 validas que
cumplen exactamente la distribucion de categorias/estados/satisfaccion
pedida por el negocio, y 4 invalidas que activan (cada una) una sola regla
de invalidez. Usa una semilla fija (SEED) para que el resultado sea siempre
reproducible. Los emails son ficticios (dominio *.test), nunca reales.
"""
from __future__ import annotations

import csv
import random
from pathlib import Path

SEED = 42
OUTPUT_PATH = Path(__file__).resolve().parent / "incidents-COMPANY.csv"

COLUMNS = [
    "ticket_id", "date", "client_company", "category", "description",
    "agent_id", "status", "customer_email", "satisfaction_score",
]

CATEGORY_COUNTS = {
    "TECHNICAL": 28, "BILLING": 18, "ACCESS": 21, "HR_QUERY": 17, "COMPLAINT": 12,
}
STATUS_COUNTS = {"OPEN": 27, "CLOSED": 56, "DISCARDED": 13}
SCORE_COUNTS = {1: 2, 2: 5, 3: 10, 4: 22, 5: 17}

CLIENT_COMPANIES = [
    "Acme Corp", "Globex Ltd", "Initech", "Umbrella Retail", "Soylent Finance",
    "Stark Logistics", "Wayne Retail", "Hooli Tech", "Wonka Foods", "Vandelay Industries",
]
AGENT_IDS = [f"AGT-{i:02d}" for i in range(1, 11)]
DATE_POOL = [f"2026-08-{day:02d}" for day in range(1, 32)]


def expand_counts(counts: dict, rng: random.Random) -> list:
    """Convierte {'TECHNICAL': 28, ...} en una lista de 28 'TECHNICAL', barajada."""
    values = []
    for key, n in counts.items():
        values.extend([key] * n)
    rng.shuffle(values)
    return values


def _random_email(rng: random.Random) -> str:
    return f"cliente{rng.randint(10000, 99999)}@empresa-ficticia.test"


def build_valid_rows(rng: random.Random) -> list[dict]:
    categories = expand_counts(CATEGORY_COUNTS, rng)
    statuses = expand_counts(STATUS_COUNTS, rng)
    scores = expand_counts(SCORE_COUNTS, rng)
    score_iter = iter(scores)

    rows = []
    for category, status in zip(categories, statuses):
        score = next(score_iter) if status == "CLOSED" else ""
        rows.append({
            "date": rng.choice(DATE_POOL),
            "client_company": rng.choice(CLIENT_COMPANIES),
            "category": category,
            "description": f"Cliente reporta incidencia de tipo {category.lower()} en el sistema.",
            "agent_id": rng.choice(AGENT_IDS),
            "status": status,
            "customer_email": _random_email(rng),
            "satisfaction_score": score,
        })

    leftover = list(score_iter)
    assert not leftover, "Sobraron puntajes sin asignar a tickets CLOSED"
    return rows


def _base_invalid_row(rng: random.Random) -> dict:
    return {
        "date": rng.choice(DATE_POOL),
        "client_company": rng.choice(CLIENT_COMPANIES),
        "category": rng.choice(list(CATEGORY_COUNTS)),
        "description": "Descripcion generica valida para el caso invalido.",
        "agent_id": rng.choice(AGENT_IDS),
        "status": "OPEN",
        "customer_email": _random_email(rng),
        "satisfaction_score": "",
    }


def build_invalid_rows(rng: random.Random) -> list[dict]:
    """Cada fila viola exactamente una regla, para que la validacion sea inequivoca."""
    missing_company = _base_invalid_row(rng)
    missing_company["client_company"] = ""

    invalid_category = _base_invalid_row(rng)
    invalid_category["category"] = ""
    invalid_category["status"] = "DISCARDED"

    invalid_email = _base_invalid_row(rng)
    invalid_email["customer_email"] = "sin-arroba.test"

    closed_no_score = _base_invalid_row(rng)
    closed_no_score["status"] = "CLOSED"
    closed_no_score["satisfaction_score"] = ""

    return [missing_company, invalid_category, invalid_email, closed_no_score]


def verify(rows: list[dict]) -> None:
    """Recalcula las mismas reglas que analyze.py para confirmar las cifras antes de escribir."""
    valid_rows = [
        r for r in rows
        if r["client_company"]
        and r["category"] in CATEGORY_COUNTS
        and len(r["description"].strip()) >= 5
        and r["agent_id"] in AGENT_IDS
        and r["customer_email"].count("@") >= 1
        and not (r["status"] == "CLOSED" and not r["satisfaction_score"])
        and (r["satisfaction_score"] == "" or 1 <= int(r["satisfaction_score"]) <= 5)
    ]
    assert len(valid_rows) == 96, f"Se esperaban 96 validos, hay {len(valid_rows)}"
    assert len(rows) - len(valid_rows) == 4, "Se esperaban 4 invalidos"

    for category, expected in CATEGORY_COUNTS.items():
        actual = sum(1 for r in valid_rows if r["category"] == category)
        assert actual == expected, f"{category}: esperado {expected}, obtenido {actual}"

    for status, expected in STATUS_COUNTS.items():
        actual = sum(1 for r in valid_rows if r["status"] == status)
        assert actual == expected, f"{status}: esperado {expected}, obtenido {actual}"

    closed_scores = [
        int(r["satisfaction_score"]) for r in valid_rows
        if r["status"] == "CLOSED" and r["satisfaction_score"]
    ]
    assert len(closed_scores) == 56, f"Se esperaban 56 puntajes, hay {len(closed_scores)}"
    for score, expected in SCORE_COUNTS.items():
        actual = closed_scores.count(score)
        assert actual == expected, f"score {score}: esperado {expected}, obtenido {actual}"
    average = sum(closed_scores) / len(closed_scores)
    assert round(average, 2) == 3.84, f"Promedio esperado 3.84, obtenido {average:.2f}"


def main() -> None:
    rng = random.Random(SEED)
    rows = build_valid_rows(rng) + build_invalid_rows(rng)
    verify(rows)

    rng.shuffle(rows)
    for i, row in enumerate(rows, start=1):
        row["ticket_id"] = f"NXV-{i:06d}"

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generadas {len(rows)} filas en {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
