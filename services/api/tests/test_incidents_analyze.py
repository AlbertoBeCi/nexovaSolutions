"""Logica del analizador de incidencias expuesto en /api/incidents:
cada una de las 7 reglas de invalidez, los limites de cada regla, la
agregacion del resumen y el ciclo analizar -> exportar."""
from __future__ import annotations

import csv
import io

import pytest

import store
from analysis import summary_to_csv_bytes

COLUMNS = [
    "ticket_id", "date", "client_company", "category", "description",
    "agent_id", "status", "customer_email", "satisfaction_score",
]
VALID_ROW = {
    "ticket_id": "1", "date": "2026-01-01", "client_company": "Acme Corp",
    "category": "TECHNICAL", "description": "Problema con el login",
    "agent_id": "AGT-01", "status": "OPEN", "customer_email": "user@acme.com",
    "satisfaction_score": "",
}


def make_csv(rows: list[dict], columns: list[str] = COLUMNS) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def row(**overrides) -> dict:
    return {**VALID_ROW, **overrides}


def analyze(client, rows: list[dict], filename: str = "tickets.csv", **kwargs):
    content = kwargs.pop("content", None)
    payload = content if content is not None else make_csv(rows)
    return client.post("/api/incidents/analyze", files={"file": (filename, payload, "text/csv")})


# ─── Camino feliz ───────────────────────────────────────────────────────


def test_valid_csv_counts_all_records_as_valid(user_client):
    response = analyze(user_client, [row(ticket_id="1"), row(ticket_id="2", category="BILLING")])

    assert response.status_code == 200
    body = response.json()
    assert (body["total_records"], body["valid_records"], body["invalid_records"]) == (2, 2, 0)
    assert body["source_file"] == "tickets.csv"
    assert all(count == 0 for count in body["invalid_breakdown"].values())


def test_summary_never_exposes_row_data(user_client):
    body = analyze(user_client, [row()]).json()

    text = str(body)
    assert "user@acme.com" not in text
    assert "Acme Corp" not in text


def test_categories_and_statuses_are_counted_with_percentages(user_client):
    rows = [
        row(category="TECHNICAL", status="OPEN"),
        row(category="TECHNICAL", status="OPEN"),
        row(category="BILLING", status="DISCARDED"),
        row(category="ACCESS", status="CLOSED", satisfaction_score="4"),
    ]

    body = analyze(user_client, rows).json()

    assert body["categories"]["TECHNICAL"] == {"count": 2, "percentage": 50.0}
    assert body["categories"]["BILLING"] == {"count": 1, "percentage": 25.0}
    assert body["categories"]["HR_QUERY"] == {"count": 0, "percentage": 0.0}
    assert body["statuses"]["OPEN"]["count"] == 2
    assert body["statuses"]["CLOSED"]["count"] == 1
    assert set(body["categories"]) == {"TECHNICAL", "BILLING", "ACCESS", "HR_QUERY", "COMPLAINT"}


def test_satisfaction_index_averages_closed_tickets_with_score(user_client):
    rows = [
        row(status="CLOSED", satisfaction_score="5"),
        row(status="CLOSED", satisfaction_score="3"),
        row(status="CLOSED", satisfaction_score="3"),
        row(status="OPEN"),
    ]

    satisfaction = analyze(user_client, rows).json()["satisfaction"]

    assert satisfaction["closed_tickets"] == 3
    assert satisfaction["scored_tickets"] == 3
    assert satisfaction["average_score"] == 3.67
    assert satisfaction["distribution"] == {"1": 0, "2": 0, "3": 2, "4": 0, "5": 1}


def test_invalid_rows_are_excluded_from_breakdowns(user_client):
    rows = [row(), row(category="NOPE")]

    body = analyze(user_client, rows).json()

    assert body["valid_records"] == 1
    assert body["categories"]["TECHNICAL"]["count"] == 1
    assert body["categories"]["TECHNICAL"]["percentage"] == 100.0


def test_second_analysis_replaces_the_first(user_client):
    analyze(user_client, [row()], filename="primero.csv")
    analyze(user_client, [row(), row()], filename="segundo.csv")

    assert store.get_last_result()["source_file"] == "segundo.csv"
    assert store.get_last_result()["total_records"] == 2


def test_analysis_sets_analyzed_at(user_client):
    assert analyze(user_client, [row()]).json()["analyzed_at"]


# ─── Las 7 reglas de invalidez y sus limites ────────────────────────────


@pytest.mark.parametrize("rule,bad_row", [
    ("missing_company", row(client_company="")),
    ("missing_company", row(client_company="   ")),
    ("invalid_category", row(category="")),
    ("invalid_category", row(category="technical")),
    ("invalid_category", row(category="OTHER")),
    ("short_description", row(description="")),
    ("short_description", row(description="abcd")),
    ("short_description", row(description="  abcd  ")),
    ("invalid_agent_id", row(agent_id="")),
    ("invalid_agent_id", row(agent_id="AGT-1")),
    ("invalid_agent_id", row(agent_id="AGT-001")),
    ("invalid_agent_id", row(agent_id="agt-01")),
    ("invalid_agent_id", row(agent_id="XGT-01")),
    ("invalid_email", row(customer_email="")),
    ("invalid_email", row(customer_email="sin-arroba.com")),
    ("closed_no_score", row(status="CLOSED", satisfaction_score="")),
    ("closed_no_score", row(status="CLOSED", satisfaction_score="abc")),
    ("score_out_of_range", row(status="CLOSED", satisfaction_score="0")),
    ("score_out_of_range", row(status="CLOSED", satisfaction_score="6")),
    ("score_out_of_range", row(status="CLOSED", satisfaction_score="-1")),
    ("score_out_of_range", row(status="OPEN", satisfaction_score="9")),
])
def test_each_rule_flags_its_bad_row(user_client, rule: str, bad_row: dict):
    body = analyze(user_client, [bad_row]).json()

    assert body["invalid_records"] == 1
    assert body["valid_records"] == 0
    assert body["invalid_breakdown"][rule] == 1


@pytest.mark.parametrize("good_row", [
    row(description="abcde"),                               # 5 caracteres exactos
    row(agent_id="AGT-99"),
    row(customer_email="a@b"),                              # solo exige '@'
    row(status="CLOSED", satisfaction_score="1"),           # limite inferior
    row(status="CLOSED", satisfaction_score="5"),           # limite superior
    row(status="CLOSED", satisfaction_score="4.5"),
    row(status="OPEN", satisfaction_score=""),              # OPEN no exige score
    row(status="DISCARDED", satisfaction_score=""),
    row(category=" BILLING "),                              # category con espacios
    row(client_company=" X "),
])
def test_boundary_rows_are_valid(user_client, good_row: dict):
    body = analyze(user_client, [good_row]).json()

    assert body["invalid_records"] == 0, body["invalid_breakdown"]


def test_a_row_can_break_several_rules_and_counts_once_as_invalid(user_client):
    bad = row(client_company="", category="NOPE", agent_id="x", customer_email="x")

    body = analyze(user_client, [bad]).json()

    assert body["invalid_records"] == 1
    breakdown = body["invalid_breakdown"]
    assert breakdown["missing_company"] == breakdown["invalid_category"] == 1
    assert breakdown["invalid_agent_id"] == breakdown["invalid_email"] == 1


def test_header_only_csv_gives_zero_records(user_client):
    body = analyze(user_client, []).json()

    assert body["total_records"] == 0
    assert body["valid_records"] == 0
    assert body["satisfaction"]["average_score"] == 0.0
    assert all(group["percentage"] == 0.0 for group in body["categories"].values())


def test_csv_with_bom_and_crlf_line_endings_is_parsed(user_client):
    content = b"\xef\xbb\xbf" + make_csv([row()]).replace(b"\n", b"\r\n")

    body = analyze(user_client, [], content=content).json()

    assert body["total_records"] == 1
    assert body["valid_records"] == 1


def test_extra_columns_are_ignored(user_client):
    content = make_csv([{**row(), "extra": "x"}], columns=[*COLUMNS, "extra"])

    assert analyze(user_client, [], content=content).json()["valid_records"] == 1


# ─── Errores de entrada ─────────────────────────────────────────────────


@pytest.mark.parametrize("filename", ["tickets.txt", "tickets", "tickets.csv.bak", "csv"])
def test_rejects_files_without_csv_extension(user_client, filename: str):
    response = analyze(user_client, [row()], filename=filename)

    assert response.status_code == 400
    assert response.json()["detail"] == "El archivo debe tener extension .csv."


@pytest.mark.parametrize("filename", ["tickets.CSV", "Tickets.Csv"])
def test_extension_check_is_case_insensitive(user_client, filename: str):
    assert analyze(user_client, [row()], filename=filename).status_code == 200


def test_rejects_empty_file(user_client):
    response = analyze(user_client, [], content=b"")

    assert response.status_code == 400
    assert response.json()["detail"] == "El archivo esta vacio."


def test_rejects_non_utf8_file(user_client):
    response = analyze(user_client, [], content=b"\xff\xfe\x00bad")

    assert response.status_code == 400


def test_rejects_csv_missing_required_columns(user_client):
    content = make_csv([row()], columns=["ticket_id", "date"])

    response = analyze(user_client, [], content=content)

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail.startswith("Faltan columnas requeridas en el CSV:")
    assert "client_company" in detail
    assert "ticket_id" not in detail


def test_failed_analysis_does_not_overwrite_the_last_result(user_client):
    analyze(user_client, [row()], filename="bueno.csv")

    analyze(user_client, [], content=b"")

    assert store.get_last_result()["source_file"] == "bueno.csv"


def test_analyze_requires_login(anon_client):
    assert analyze(anon_client, [row()]).status_code == 401


def test_analyze_rejects_invalid_token(anon_client):
    anon_client.headers["Authorization"] = "Bearer no-es-un-token"

    assert analyze(anon_client, [row()]).status_code == 401


# ─── Exportacion ────────────────────────────────────────────────────────


def test_export_without_previous_analysis_returns_404(user_client):
    response = user_client.get("/api/incidents/results/export")

    assert response.status_code == 404
    assert "No hay ningun analisis previo" in response.json()["detail"]


def test_export_contains_one_row_per_metric_of_the_last_analysis(user_client):
    analyze(user_client, [row(), row(category="NOPE")], filename="a.csv")

    exported = user_client.get("/api/incidents/results/export").content

    assert exported == summary_to_csv_bytes(store.get_last_result())
    metrics = dict(list(csv.reader(io.StringIO(exported.decode())))[1:])
    assert metrics["source_file"] == "a.csv"
    assert metrics["total_records"] == "2"
    assert metrics["valid_records"] == "1"
    assert metrics["rule_invalid_category"] == "1"


def test_export_reflects_only_the_latest_analysis(user_client):
    analyze(user_client, [row()], filename="viejo.csv")
    analyze(user_client, [row(), row()], filename="nuevo.csv")

    text = user_client.get("/api/incidents/results/export").text

    assert "nuevo.csv" in text
    assert "viejo.csv" not in text




def test_export_requires_login(user_client):
    # Bug detectado por la bateria: antes la exportacion era publica aunque
    # `analyze` exigiera login, y cualquiera podia descargar el ultimo analisis.
    analyze(user_client, [row()], filename="secreto.csv")
    user_client.headers.pop("Authorization")

    response = user_client.get("/api/incidents/results/export")

    assert response.status_code == 401
    assert "secreto.csv" not in response.text
