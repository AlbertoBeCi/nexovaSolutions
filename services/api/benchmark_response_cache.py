"""Reproducible, in-memory benchmark for inventory list response caching.

Run from ``services/api`` with ``uv run python benchmark_response_cache.py``.
The script creates only an in-memory SQLite database and TinyDB tables; it
does not read application environment variables or connect to Supabase.
"""
from __future__ import annotations

import json
import statistics
from datetime import datetime, timedelta, timezone
from time import perf_counter

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

from inventory_database import get_inventory_session
from inventory_models import Asset, AssetEntry, AssetExit
from main import app
from response_cache import response_cache
from security import get_current_user
from users_db import get_profiles_table, get_users_table

PRODUCT_COUNT = 200
MOVEMENT_COUNT_PER_TYPE = 1_000
REPETITIONS = 8
BENCHMARK_USER_UUID = "benchmark-user-0001"


def seed_synthetic_data(engine) -> tuple[TinyDB, object, object]:
    SQLModel.metadata.create_all(engine)
    created_at = datetime(2026, 10, 23, tzinfo=timezone.utc)
    with Session(engine) as session:
        assets = [
            Asset(
                name=f"Equipo de prueba {index:04d}",
                sku=f"BENCH-{index:04d}",
                category="hardware" if index % 2 == 0 else "peripherals",
                office="Valencia" if index % 2 == 0 else "Miami",
            )
            for index in range(PRODUCT_COUNT)
        ]
        session.add_all(assets)
        session.flush()
        entries = [
            AssetEntry(
                asset_id=assets[index % PRODUCT_COUNT].id,
                quantity=(index % 7) + 1,
                supplier=f"Proveedor {index % 20:02d}",
                office="Valencia" if index % 2 == 0 else "Miami",
                created_at=created_at - timedelta(minutes=index),
                user_uuid=BENCHMARK_USER_UUID,
            )
            for index in range(MOVEMENT_COUNT_PER_TYPE)
        ]
        exits = [
            AssetExit(
                asset_id=assets[index % PRODUCT_COUNT].id,
                quantity=(index % 3) + 1,
                exit_type="consumption",
                assigned_to=None,
                office="Valencia" if index % 2 == 0 else "Miami",
                created_at=created_at - timedelta(minutes=index) - timedelta(seconds=30),
                user_uuid=BENCHMARK_USER_UUID,
            )
            for index in range(MOVEMENT_COUNT_PER_TYPE)
        ]
        session.add_all(entries + exits)
        session.commit()

    tinydb = TinyDB(storage=MemoryStorage)
    users = tinydb.table("users")
    profiles = tinydb.table("profiles")
    users.insert({"uuid": BENCHMARK_USER_UUID, "email": "benchmark@nexova.test"})
    return tinydb, users, profiles


def percentile_95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))]


def measure(client: TestClient, path: str, tag: str) -> dict[str, object]:
    cold_ms: list[float] = []
    hit_ms: list[float] = []
    response_size = 0
    for _ in range(REPETITIONS):
        response_cache.invalidate(tag)
        started = perf_counter()
        cold = client.get(path)
        cold_ms.append((perf_counter() - started) * 1000)
        if cold.status_code != 200:
            raise RuntimeError(f"{path} devolvió {cold.status_code}: {cold.text[:200]}")
        response_size = len(cold.content)

        started = perf_counter()
        warm = client.get(path)
        hit_ms.append((perf_counter() - started) * 1000)
        if warm.status_code != 200 or warm.content != cold.content:
            raise RuntimeError(f"La respuesta de caché para {path} no coincide con la lectura fría.")

    cold_median = statistics.median(cold_ms)
    hit_median = statistics.median(hit_ms)
    return {
        "path": path,
        "repetitions": REPETITIONS,
        "cold_median_ms": round(cold_median, 2),
        "cold_p95_ms": round(percentile_95(cold_ms), 2),
        "hit_median_ms": round(hit_median, 2),
        "hit_p95_ms": round(percentile_95(hit_ms), 2),
        "median_reduction_percent": round((1 - hit_median / cold_median) * 100, 1) if cold_median else 0,
        "response_bytes": response_size,
    }


def main() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    tinydb, users, profiles = seed_synthetic_data(engine)

    def get_test_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_inventory_session] = get_test_session
    app.dependency_overrides[get_users_table] = lambda: users
    app.dependency_overrides[get_profiles_table] = lambda: profiles
    app.dependency_overrides[get_current_user] = lambda: type(
        "BenchmarkUser", (), {"id": 1, "uuid": BENCHMARK_USER_UUID, "role": "admin"}
    )()
    response_cache.clear()
    client = TestClient(app)
    try:
        results = [
            measure(client, "/inventory/products", "inventory_products"),
            measure(client, "/inventory/orders", "inventory_orders"),
        ]
        print(json.dumps({
            "environment": "FastAPI TestClient + SQLite in-memory; no external database",
            "products": PRODUCT_COUNT,
            "inbound_orders": MOVEMENT_COUNT_PER_TYPE,
            "outbound_orders": MOVEMENT_COUNT_PER_TYPE,
            "repetitions_per_path": REPETITIONS,
            "results": results,
        }, ensure_ascii=False, indent=2))
    finally:
        client.close()
        app.dependency_overrides.clear()
        response_cache.clear()
        tinydb.close()
        engine.dispose()


if __name__ == "__main__":
    main()
