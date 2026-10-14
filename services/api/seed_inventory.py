"""Idempotent inventory seed with explicit remote and production safeguards."""
from __future__ import annotations

import argparse
import os

from sqlmodel import Session, select

from config import ENVIRONMENT
from inventory_database import get_database_url, get_engine, is_remote_database
from inventory_models import Asset, AssetEntry, AssetExit
from users_db import ensure_user_uuid, get_users_table, users_db_lock

ASSETS = (
    ("Portátil 14\" Business", "NXV-IT-001", "hardware", "Valencia"),
    ("Portátil 14\" Business", "NXV-IT-002", "hardware", "Miami"),
    ("Ratón ergonómico", "NXV-PER-001", "peripherals", "Valencia"),
    ("Hub USB-C", "NXV-PER-002", "peripherals", "Miami"),
    ("Resma de papel A4", "NXV-OFF-001", "office_supplies", "Valencia"),
    ("Cuaderno de formación en liderazgo", "NXV-TRN-001", "training_materials", "Valencia"),
)

ENTRIES = (
    ("NXV-IT-001", 10, "TechDistrib Valencia S.L.", "Valencia"),
    ("NXV-IT-001", 5, "TechDistrib Valencia S.L.", "Valencia"),
    ("NXV-PER-001", 30, "Office Depot Miami", "Valencia"),
    ("NXV-PER-002", 12, "Office Depot Miami", "Miami"),
)

EXITS = (
    ("NXV-IT-001", 2, "allocation", "Ana García", "Valencia"),
    ("NXV-PER-001", 3, "consumption", None, "Valencia"),
    ("NXV-PER-002", 1, "allocation", "Luis Pérez", "Miami"),
)


def _find_seed_user_uuid() -> str:
    email = os.environ.get("INVENTORY_SEED_USER_EMAIL") or os.environ.get("ADMIN_EMAIL")
    if not email:
        raise RuntimeError(
            "Define INVENTORY_SEED_USER_EMAIL o ADMIN_EMAIL para seleccionar una cuenta TinyDB."
        )
    table = get_users_table()
    with users_db_lock:
        user = table.get(lambda doc: doc.get("email", "").casefold() == email.casefold())
    if user is None:
        raise RuntimeError(
            "No existe en TinyDB la cuenta indicada para atribuir las órdenes semilla."
        )
    user_uuid = ensure_user_uuid(table, user.doc_id)
    if user_uuid is None:
        raise RuntimeError("No se pudo obtener el UUID de la cuenta TinyDB indicada.")
    return user_uuid


def seed_inventory(session: Session, user_uuid: str) -> tuple[int, int, int]:
    """Insert missing fixture rows and preserve any existing inventory history."""
    assets_by_sku: dict[str, Asset] = {}
    inserted_assets = 0
    inserted_orders = 0

    with session.begin():
        for name, sku, category, office in ASSETS:
            asset = session.exec(select(Asset).where(Asset.sku == sku)).first()
            if asset is None:
                asset = Asset(name=name, sku=sku, category=category, office=office)
                session.add(asset)
                session.flush()
                inserted_assets += 1
            assets_by_sku[sku] = asset

        for sku, quantity, supplier, office in ENTRIES:
            asset = assets_by_sku[sku]
            existing = session.exec(
                select(AssetEntry).where(
                    AssetEntry.asset_id == asset.id,
                    AssetEntry.quantity == quantity,
                    AssetEntry.supplier == supplier,
                    AssetEntry.office == office,
                    AssetEntry.user_uuid == user_uuid,
                )
            ).first()
            if existing is None:
                session.add(
                    AssetEntry(
                        asset_id=asset.id,
                        quantity=quantity,
                        supplier=supplier,
                        office=office,
                        user_uuid=user_uuid,
                    )
                )
                inserted_orders += 1

        for sku, quantity, exit_type, assigned_to, office in EXITS:
            asset = assets_by_sku[sku]
            existing = session.exec(
                select(AssetExit).where(
                    AssetExit.asset_id == asset.id,
                    AssetExit.quantity == quantity,
                    AssetExit.exit_type == exit_type,
                    AssetExit.assigned_to == assigned_to,
                    AssetExit.office == office,
                    AssetExit.user_uuid == user_uuid,
                )
            ).first()
            if existing is None:
                session.add(
                    AssetExit(
                        asset_id=asset.id,
                        quantity=quantity,
                        exit_type=exit_type,
                        assigned_to=assigned_to,
                        office=office,
                        user_uuid=user_uuid,
                    )
                )
                inserted_orders += 1

    return inserted_assets, inserted_orders, len(ASSETS) - inserted_assets


def _validate_target(allow_remote: bool, allow_production: bool = False) -> None:
    database_url = get_database_url()
    if not database_url:
        raise RuntimeError("Define SUPABASE_DATABASE_URL antes de ejecutar el seed.")
    if ENVIRONMENT.casefold() == "production" and (
        not allow_production
        or os.environ.get("INVENTORY_SEED_PRODUCTION_ALLOWED", "").casefold() != "true"
    ):
        raise RuntimeError(
            "Seed en produccion bloqueado. Para una ejecucion autorizada se requieren "
            "--allow-production e INVENTORY_SEED_PRODUCTION_ALLOWED=true."
        )
    if is_remote_database(database_url) and (
        not allow_remote
        or os.environ.get("INVENTORY_SEED_REMOTE_ALLOWED", "").casefold() != "true"
    ):
        raise RuntimeError(
            "Seed remoto bloqueado. Para una base remota, confirma con "
            "--allow-remote e INVENTORY_SEED_REMOTE_ALLOWED=true."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Carga idempotente de los datos del hito de inventario.")
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Confirma una carga remota (requiere INVENTORY_SEED_REMOTE_ALLOWED=true).",
    )
    parser.add_argument(
        "--allow-production",
        action="store_true",
        help=(
            "Confirma una carga autorizada en produccion "
            "(requiere INVENTORY_SEED_PRODUCTION_ALLOWED=true)."
        ),
    )
    args = parser.parse_args()

    _validate_target(args.allow_remote, args.allow_production)
    user_uuid = _find_seed_user_uuid()
    with Session(get_engine()) as session:
        inserted_assets, inserted_orders, existed = seed_inventory(session, user_uuid)
    print(
        "Seed de inventario: "
        f"{inserted_assets} activos nuevos, {inserted_orders} ordenes nuevas, "
        f"{existed} activos ya existentes."
    )


if __name__ == "__main__":
    main()
