from fastapi.testclient import TestClient

from main import app


def test_request_timing_logs_route_status_and_duration_without_query_values(caplog):
    caplog.set_level("INFO", logger="main")

    client = TestClient(app)
    response = client.get("/openapi.json?token=do-not-log-this")
    client.close()

    assert response.status_code == 200
    timing_messages = [record.getMessage() for record in caplog.records if record.name == "main"]
    assert any("http_request method=GET path=/openapi.json status=200 duration_ms=" in message for message in timing_messages)
    assert all("do-not-log-this" not in message for message in timing_messages)


def test_request_timing_can_be_disabled(monkeypatch, caplog):
    monkeypatch.setenv("API_REQUEST_TIMING_ENABLED", "false")
    caplog.set_level("INFO", logger="main")

    client = TestClient(app)
    response = client.get("/openapi.json")
    client.close()

    assert response.status_code == 200
    assert "http_request" not in caplog.text
