"""config.py (variables de entorno) y db.py (directorio SQLite, init_db)."""
from __future__ import annotations

import importlib

import pytest
from sqlalchemy import create_engine, inspect

import config
import db


@pytest.fixture
def reload_config(monkeypatch):
    """Recarga `config` sin leer el .env real y restaura el modulo al final."""
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: False)

    def _reload(**env: str):
        for name in ("INCIDENTS_DATABASE_URL", "API_HOST", "API_PORT", "CORS_ORIGINS"):
            monkeypatch.delenv(name, raising=False)
        for name, value in env.items():
            monkeypatch.setenv(name, value)
        return importlib.reload(config)

    yield _reload
    monkeypatch.undo()
    importlib.reload(config)


def test_defaults_when_no_env_vars(reload_config):
    cfg = reload_config()

    assert cfg.DATABASE_URL.startswith("sqlite:///")
    assert cfg.DATABASE_URL.endswith("data/incidents.db")
    assert cfg.API_HOST == "0.0.0.0"
    assert cfg.API_PORT == 8001
    assert "http://localhost:3000" in cfg.CORS_ORIGINS
    assert "http://localhost:3001" in cfg.CORS_ORIGINS


def test_database_url_comes_from_env(reload_config):
    cfg = reload_config(INCIDENTS_DATABASE_URL="sqlite:///otra.db")

    assert cfg.DATABASE_URL == "sqlite:///otra.db"


def test_port_is_parsed_as_integer(reload_config):
    assert reload_config(API_PORT="9100").API_PORT == 9100


def test_invalid_port_fails_loudly(reload_config):
    with pytest.raises(ValueError):
        reload_config(API_PORT="no-es-un-numero")


def test_cors_origins_are_split_and_trimmed(reload_config):
    cfg = reload_config(CORS_ORIGINS=" http://a.test , http://b.test ,, ")

    assert cfg.CORS_ORIGINS == ["http://a.test", "http://b.test"]


def test_ensure_sqlite_directory_creates_missing_folder(tmp_path):
    target = tmp_path / "nested" / "dir" / "x.db"

    db._ensure_sqlite_directory(f"sqlite:///{target.as_posix()}")

    assert target.parent.is_dir()
    assert not target.exists()


@pytest.mark.parametrize("url", ["sqlite://", "sqlite:///:memory:", "postgresql://u@h/db"])
def test_ensure_sqlite_directory_ignores_non_file_urls(url: str, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    db._ensure_sqlite_directory(url)

    assert list(tmp_path.iterdir()) == []


def test_init_db_creates_tables_and_is_idempotent(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'init.db').as_posix()}")
    monkeypatch.setattr(db, "engine", engine)

    db.init_db()
    db.init_db()

    assert {"incidents", "seed_ticket_ids"} <= set(inspect(engine).get_table_names())
    engine.dispose()


def test_get_session_yields_and_closes_session():
    generator = db.get_session()

    session = next(generator)
    assert session.is_active
    with pytest.raises(StopIteration):
        next(generator)
