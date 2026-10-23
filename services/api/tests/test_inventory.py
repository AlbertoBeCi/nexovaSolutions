"""Inventory API tests against an isolated SQLite database per test."""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine, select

import seed_inventory as seed_script
import routes.inventory as inventory_routes
from inventory_database import get_engine, get_inventory_session
from inventory_models import Asset, AssetEntry, AssetExit
from main import app
from response_cache import response_cache
from seed_inventory import seed_inventory
from users_db import get_profiles_table, get_users_table

VALID_ASSET = {
    "name": "Portátil de prueba",
    "sku": "TEST-IT-001",
    "category": "hardware",
    "office": "Valencia",
}


@pytest.fixture
def inventory_engine(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'inventory.db'}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def client(inventory_engine, users_table, profiles_table, auth_headers, monkeypatch):
    monkeypatch.delenv("SUPABASE_DATABASE_URL", raising=False)

    def get_test_session():
        with Session(inventory_engine) as session:
            yield session

    app.dependency_overrides[get_inventory_session] = get_test_session
    app.dependency_overrides[get_users_table] = lambda: users_table
    app.dependency_overrides[get_profiles_table] = lambda: profiles_table
    response_cache.clear()
    test_client = TestClient(app)
    test_client.headers.update(auth_headers)
    yield test_client
    test_client.close()
    app.dependency_overrides.clear()
    response_cache.clear()


def create_asset(client: TestClient, payload: dict | None = None) -> dict:
    response = client.post("/inventory/products", json=payload or VALID_ASSET)
    assert response.status_code == 201, response.text
    return response.json()


def test_inventory_routes_require_authentication(client):
    client.headers.pop("Authorization")
    assert client.get("/inventory/products").status_code == 401
    assert client.post("/inventory/products", json=VALID_ASSET).status_code == 401
    assert client.get("/inventory/products/1").status_code == 401
    assert client.post("/inventory/orders/inbound", json={}).status_code == 401
    assert client.post("/inventory/orders/outbound", json={}).status_code == 401
    assert client.get("/inventory/orders").status_code == 401


def test_inventory_routes_return_503_when_supabase_is_not_configured(
    client, monkeypatch
):
    app.dependency_overrides.pop(get_inventory_session)
    monkeypatch.delenv("SUPABASE_DATABASE_URL", raising=False)
    response = client.get("/inventory/products")
    assert response.status_code == 503


def test_supabase_url_uses_the_installed_psycopg2_driver(monkeypatch):
    monkeypatch.setenv(
        "SUPABASE_DATABASE_URL",
        "postgresql://example@example.test:5432/nexova_test",
    )
    get_engine.cache_clear()
    try:
        engine = get_engine()
        assert engine.dialect.name == "postgresql"
        assert engine.dialect.driver == "psycopg2"
        engine.dispose()
    finally:
        get_engine.cache_clear()


@pytest.mark.parametrize(
    "change",
    [
        {"category": "furniture"},
        {"office": "Madrid"},
        {"name": ""},
        {"sku": "   "},
        {"current_stock": 8},
    ],
)
def test_create_asset_rejects_invalid_or_client_owned_fields(client, change):
    response = client.post("/inventory/products", json={**VALID_ASSET, **change})
    assert response.status_code == 422


def test_create_duplicate_sku_returns_409_and_stock_is_response_only(client):
    created = create_asset(client)
    assert created["current_stock"] == 0
    duplicate = client.post(
        "/inventory/products",
        json={**VALID_ASSET, "name": "Otro nombre"},
    )
    assert duplicate.status_code == 409
    assert "current_stock" not in set(Asset.__table__.columns.keys())


def test_get_asset_and_missing_asset(client):
    created = create_asset(client)
    assert client.get(f"/inventory/products/{created['id']}").json() == created
    assert client.get("/inventory/products/999").status_code == 404


def test_product_list_cache_uses_filters_and_invalidates_after_stock_write(client, monkeypatch):
    asset = create_asset(client)
    original = inventory_routes._list_assets_with_stock
    calls = 0

    def counted_list(session, office=None):
        nonlocal calls
        calls += 1
        return original(session, office)

    monkeypatch.setattr(inventory_routes, "_list_assets_with_stock", counted_list)

    valencia_url = "/inventory/products?office=Valencia"
    first = client.get(valencia_url)
    second = client.get(valencia_url)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert calls == 1

    assert client.get("/inventory/products?office=Miami").json() == []
    assert calls == 2

    inbound = client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset["id"],
            "quantity": 6,
            "supplier": "Proveedor de prueba",
            "office": "Valencia",
        },
    )
    assert inbound.status_code == 201
    assert client.get(valencia_url).json()[0]["current_stock"] == 6
    assert calls == 3


def test_inventory_cache_hit_still_checks_authentication(client):
    create_asset(client)
    assert client.get("/inventory/products").status_code == 200

    client.headers.pop("Authorization")
    assert client.get("/inventory/products").status_code == 401


def test_order_list_cache_reuses_queries_and_profile_write_invalidates(client, monkeypatch):
    asset = create_asset(client)
    inbound = client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset["id"],
            "quantity": 2,
            "supplier": "Proveedor de prueba",
            "office": "Valencia",
        },
    )
    assert inbound.status_code == 201

    original = inventory_routes._creator_names
    calls = 0

    def counted_creator_names(users, profiles):
        nonlocal calls
        calls += 1
        return original(users, profiles)

    monkeypatch.setattr(inventory_routes, "_creator_names", counted_creator_names)
    first = client.get("/inventory/orders?office=Valencia")
    second = client.get("/inventory/orders?office=Valencia")
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert calls == 1
    assert client.get("/inventory/orders?office=Miami").json() == []
    assert calls == 2

    failed_exit = client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": asset["id"],
            "quantity": 3,
            "exit_type": "consumption",
            "assigned_to": None,
            "office": "Valencia",
        },
    )
    assert failed_exit.status_code == 400
    client.get("/inventory/orders?office=Valencia")
    assert calls == 2

    profile = client.put(
        "/profiles/me",
        json={"name": "Ana García", "phone": None, "address": None},
    )
    assert profile.status_code == 200
    updated_orders = client.get("/inventory/orders?office=Valencia")
    assert updated_orders.json()[0]["creator_name"] == "Ana García"
    assert calls == 3


@pytest.mark.parametrize("quantity", [0, -1])
def test_inbound_rejects_non_positive_quantity(client, quantity):
    asset = create_asset(client)
    response = client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset["id"],
            "quantity": quantity,
            "supplier": "Proveedor de prueba",
            "office": "Valencia",
        },
    )
    assert response.status_code == 422


def test_inbound_records_authenticated_user_and_increases_stock(client, users_table):
    asset = create_asset(client)
    response = client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset["id"],
            "quantity": 10,
            "supplier": "TechDistrib Valencia S.L.",
            "office": "Valencia",
        },
    )
    assert response.status_code == 201, response.text
    user_uuid = users_table.get(doc_id=1)["uuid"]
    assert str(UUID(user_uuid)) == user_uuid
    assert "user_uuid" not in response.json()
    assert set(response.json()) == {"id", "asset_id", "quantity", "supplier", "office", "created_at"}
    assert client.get(f"/inventory/products/{asset['id']}").json()["current_stock"] == 10


def test_order_history_includes_creator_profile_name(client, profiles_table):
    asset = create_asset(client)
    created = client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset["id"],
            "quantity": 2,
            "supplier": "Proveedor de prueba",
            "office": "Valencia",
        },
    )
    assert created.status_code == 201
    profiles_table.insert({"user_id": 1, "name": "Ana García", "phone": None, "address": None})

    history = client.get("/inventory/orders")

    assert history.status_code == 200
    assert history.json()[0]["creator_name"] == "Ana García"
    assert "user_uuid" not in history.json()[0]
    assert "asset_id" not in history.json()[0]
    assert history.json()[0]["asset"]["id"] == asset["id"]


def test_order_history_uses_creator_email_when_profile_is_missing(client):
    asset = create_asset(client)
    created = client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset["id"],
            "quantity": 2,
            "supplier": "Proveedor de prueba",
            "office": "Valencia",
        },
    )
    assert created.status_code == 201

    history = client.get("/inventory/orders")

    assert history.json()[0]["creator_name"] == "user@nexova.com"


def test_order_history_returns_null_creator_name_when_creator_uuid_is_unavailable(client, users_table):
    asset = create_asset(client)
    created = client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset["id"],
            "quantity": 2,
            "supplier": "Proveedor de prueba",
            "office": "Valencia",
        },
    )
    assert created.status_code == 201
    users_table.update({"uuid": str(uuid4())}, doc_ids=[1])

    history = client.get("/inventory/orders")

    assert history.json()[0]["creator_name"] is None
    assert "user_uuid" not in history.json()[0]


def test_orders_reject_missing_assets(client):
    response = client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": 9876,
            "quantity": 1,
            "supplier": "Proveedor de prueba",
            "office": "Valencia",
        },
    )
    assert response.status_code == 404


@pytest.mark.parametrize(
    "exit_type,assigned_to",
    [("allocation", None), ("allocation", "  "), ("consumption", "Ana")],
)
def test_outbound_validates_assignment_rules(client, exit_type, assigned_to):
    asset = create_asset(client)
    response = client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": asset["id"],
            "quantity": 1,
            "exit_type": exit_type,
            "assigned_to": assigned_to,
            "office": "Valencia",
        },
    )
    assert response.status_code == 422


def test_insufficient_stock_returns_exact_message_without_partial_order(client, inventory_engine):
    asset = create_asset(client)
    response = client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": asset["id"],
            "quantity": 1,
            "exit_type": "consumption",
            "assigned_to": None,
            "office": "Valencia",
        },
    )
    assert response.status_code == 400
    assert response.json() == {
        "detail": "Insufficient stock for asset 'Portátil de prueba'. Available: 0, requested: 1."
    }
    with Session(inventory_engine) as session:
        assert session.exec(select(AssetExit)).all() == []


def test_valid_allocation_and_consumption_reduce_stock(client):
    asset = create_asset(client)
    assert client.post(
        "/inventory/orders/inbound",
        json={
            "asset_id": asset["id"],
            "quantity": 12,
            "supplier": "Proveedor de prueba",
            "office": "Valencia",
        },
    ).status_code == 201
    allocation = client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": asset["id"],
            "quantity": 4,
            "exit_type": "allocation",
            "assigned_to": "Ana García",
            "office": "Valencia",
        },
    )
    consumption = client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": asset["id"],
            "quantity": 3,
            "exit_type": "consumption",
            "assigned_to": None,
            "office": "Valencia",
        },
    )
    assert allocation.status_code == consumption.status_code == 201
    assert client.get(f"/inventory/products/{asset['id']}").json()["current_stock"] == 5


def test_products_and_orders_avoid_n_plus_one_and_preserve_stock_totals(
    client, inventory_engine
):
    asset = create_asset(client)
    for quantity in (10, 5):
        assert client.post(
            "/inventory/orders/inbound",
            json={
                "asset_id": asset["id"],
                "quantity": quantity,
                "supplier": "Proveedor de prueba",
                "office": "Valencia",
            },
        ).status_code == 201
    assert client.post(
        "/inventory/orders/outbound",
        json={
            "asset_id": asset["id"],
            "quantity": 2,
            "exit_type": "allocation",
            "assigned_to": "Ana",
            "office": "Valencia",
        },
    ).status_code == 201

    statements: list[str] = []
    lock = Lock()

    def capture(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().lower().startswith("select"):
            with lock:
                statements.append(statement)

    event.listen(inventory_engine, "before_cursor_execute", capture)
    try:
        products = client.get("/inventory/products")
        assert products.status_code == 200
        assert products.json()[0]["current_stock"] == 13
        assert len(statements) == 1
        statements.clear()

        orders = client.get("/inventory/orders")
        assert orders.status_code == 200
        assert len(orders.json()) == 3
        assert all(order["asset"]["sku"] == VALID_ASSET["sku"] for order in orders.json())
        assert len(statements) == 2
    finally:
        event.remove(inventory_engine, "before_cursor_execute", capture)


def test_database_constraints_include_foreign_keys_and_no_users_table(inventory_engine):
    assert set(SQLModel.metadata.tables) == {"assets", "asset_entries", "asset_exits"}
    assert list(AssetEntry.__table__.c.asset_id.foreign_keys)
    assert list(AssetExit.__table__.c.asset_id.foreign_keys)
    assert "current_stock" not in Asset.__table__.columns
    with Session(inventory_engine) as session:
        session.add(
            AssetEntry(
                asset_id=123456,
                quantity=1,
                supplier="Proveedor",
                office="Valencia",
                user_uuid="1",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


def test_inventory_seed_is_idempotent(inventory_engine):
    user_uuid = str(uuid4())
    with Session(inventory_engine) as session:
        assert seed_inventory(session, user_uuid) == (6, 7, 0)
    with Session(inventory_engine) as session:
        assert seed_inventory(session, user_uuid) == (0, 0, 6)
        assert len(session.exec(select(AssetEntry)).all()) == 4
        assert len(session.exec(select(AssetExit)).all()) == 3


def test_inventory_seed_requires_explicit_production_and_remote_opt_ins(monkeypatch):
    monkeypatch.setenv("SUPABASE_DATABASE_URL", "sqlite:///inventory.db")
    monkeypatch.setattr(seed_script, "ENVIRONMENT", "production")
    with pytest.raises(RuntimeError, match="production"):
        seed_script._validate_target(allow_remote=False)

    monkeypatch.setenv("INVENTORY_SEED_PRODUCTION_ALLOWED", "true")
    with pytest.raises(RuntimeError, match="production"):
        seed_script._validate_target(allow_remote=False, allow_production=False)
    seed_script._validate_target(allow_remote=False, allow_production=True)

    monkeypatch.setattr(seed_script, "ENVIRONMENT", "development")
    monkeypatch.delenv("INVENTORY_SEED_PRODUCTION_ALLOWED", raising=False)
    monkeypatch.setenv("SUPABASE_DATABASE_URL", "postgresql://example.test/nexova_test")
    monkeypatch.delenv("INVENTORY_SEED_REMOTE_ALLOWED", raising=False)
    with pytest.raises(RuntimeError, match="Seed remoto bloqueado"):
        seed_script._validate_target(allow_remote=False)

    monkeypatch.setenv("INVENTORY_SEED_REMOTE_ALLOWED", "true")
    seed_script._validate_target(allow_remote=True)


def test_concurrent_outbounds_do_not_overdraw_dedicated_postgres(
    users_table, auth_headers, monkeypatch
):
    database_url = os.environ.get("INVENTORY_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Define INVENTORY_TEST_DATABASE_URL para probar concurrencia en PostgreSQL.")
    if os.environ.get("INVENTORY_TEST_DATABASE_ALLOW_RESET", "").casefold() != "true":
        pytest.skip("La prueba requiere INVENTORY_TEST_DATABASE_ALLOW_RESET=true.")
    if database_url == os.environ.get("SUPABASE_DATABASE_URL"):
        pytest.fail("La base de pruebas no puede ser la URL de la aplicación.")
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql" or "test" not in (url.database or "").casefold():
        pytest.fail("Usa una base PostgreSQL dedicada cuyo nombre incluya 'test'.")

    monkeypatch.delenv("SUPABASE_DATABASE_URL", raising=False)
    engine = create_engine(database_url, pool_pre_ping=True)
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        asset = Asset(**VALID_ASSET)
        session.add(asset)
        session.flush()
        session.add(
            AssetEntry(
                asset_id=asset.id,
                quantity=5,
                supplier="Proveedor de prueba",
                office="Valencia",
                user_uuid="1",
            )
        )
        session.commit()
        asset_id = asset.id

    def get_pg_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_inventory_session] = get_pg_session
    app.dependency_overrides[get_users_table] = lambda: users_table
    try:
        def request_exit():
            with TestClient(app) as test_client:
                return test_client.post(
                    "/inventory/orders/outbound",
                    headers=auth_headers,
                    json={
                        "asset_id": asset_id,
                        "quantity": 4,
                        "exit_type": "consumption",
                        "assigned_to": None,
                        "office": "Valencia",
                    },
                ).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = sorted(pool.map(lambda _: request_exit(), range(2)))
        assert statuses == [201, 400]
        with Session(engine) as session:
            inbound = sum(session.exec(select(AssetEntry.quantity)).all())
            outbound = sum(session.exec(select(AssetExit.quantity)).all())
            assert inbound - outbound == 1
    finally:
        app.dependency_overrides.clear()
        SQLModel.metadata.drop_all(engine)
        engine.dispose()
