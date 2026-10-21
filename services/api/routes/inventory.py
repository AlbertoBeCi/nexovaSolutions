"""Inventory endpoints backed by PostgreSQL while auth stays in TinyDB."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from tinydb.table import Table

from inventory_database import get_inventory_session
from inventory_models import Asset, AssetEntry, AssetExit
from inventory_schemas import (
    AssetCreate,
    AssetEntryCreate,
    AssetEntryResponse,
    AssetExitCreate,
    AssetExitResponse,
    AssetListItem,
    AssetResponse,
    AssetSummary,
    Office,
    OrderListItem,
)
from models import UserInDB
from security import get_current_user
from users_db import ProfilesTable, UsersTable, users_db_lock

router = APIRouter(
    prefix="/inventory",
    tags=["inventory"],
    dependencies=[Depends(get_current_user)],
)
InventorySession = Annotated[Session, Depends(get_inventory_session)]
CurrentUser = Annotated[UserInDB, Depends(get_current_user)]


def _entry_totals():
    return (
        select(AssetEntry.asset_id, func.sum(AssetEntry.quantity).label("total_in"))
        .group_by(AssetEntry.asset_id)
        .subquery()
    )


def _exit_totals():
    return (
        select(AssetExit.asset_id, func.sum(AssetExit.quantity).label("total_out"))
        .group_by(AssetExit.asset_id)
        .subquery()
    )


def _list_assets_with_stock(session: Session, office: Office | None = None):
    entries = _entry_totals()
    exits = _exit_totals()
    statement = (
        select(
            Asset,
            (
                func.coalesce(entries.c.total_in, 0)
                - func.coalesce(exits.c.total_out, 0)
            ).label("current_stock"),
        )
        .outerjoin(entries, entries.c.asset_id == Asset.id)
        .outerjoin(exits, exits.c.asset_id == Asset.id)
        .order_by(Asset.id)
    )
    if office is not None:
        statement = statement.where(Asset.office == office)
    return session.exec(statement).all()


def _stock_for_asset(session: Session, asset_id: int) -> int:
    entries = session.exec(
        select(func.coalesce(func.sum(AssetEntry.quantity), 0)).where(
            AssetEntry.asset_id == asset_id
        )
    ).one()
    exits = session.exec(
        select(func.coalesce(func.sum(AssetExit.quantity), 0)).where(
            AssetExit.asset_id == asset_id
        )
    ).one()
    return int(entries - exits)


def _asset_summary(asset: Asset) -> AssetSummary:
    return AssetSummary(
        id=asset.id,
        name=asset.name,
        sku=asset.sku,
        category=asset.category,
        office=asset.office,
    )


def _asset_response(asset: Asset, stock: int) -> AssetResponse:
    return AssetResponse(**_asset_summary(asset).model_dump(), current_stock=stock)


def _entry_response(entry: AssetEntry) -> AssetEntryResponse:
    return AssetEntryResponse(
        id=entry.id,
        asset_id=entry.asset_id,
        quantity=entry.quantity,
        supplier=entry.supplier,
        office=entry.office,
        created_at=entry.created_at,
    )


def _exit_response(exit_order: AssetExit) -> AssetExitResponse:
    return AssetExitResponse(
        id=exit_order.id,
        asset_id=exit_order.asset_id,
        quantity=exit_order.quantity,
        exit_type=exit_order.exit_type,
        assigned_to=exit_order.assigned_to,
        office=exit_order.office,
        created_at=exit_order.created_at,
    )


def _creator_names(users: Table, profiles: Table) -> dict[str, str]:
    """Resolve order UUIDs from TinyDB in one locked read, without N+1 lookups."""
    with users_db_lock:
        profiles_by_user_id = {
            profile.get("user_id"): profile
            for profile in profiles.all()
        }
        names: dict[str, str] = {}
        for user in users.all():
            user_uuid = user.get("uuid")
            if not user_uuid:
                continue
            profile = profiles_by_user_id.get(user.doc_id)
            profile_name = str(profile.get("name") or "").strip() if profile else ""
            email = str(user.get("email") or "").strip()
            display_name = profile_name or email
            if display_name:
                names[str(user_uuid)] = display_name
        return names


@router.get(
    "/products",
    response_model=list[AssetListItem],
)
def list_products(
    session: InventorySession,
    office: Annotated[Office | None, Query()] = None,
) -> list[AssetListItem]:
    return [
        AssetListItem(**_asset_response(asset, stock).model_dump())
        for asset, stock in _list_assets_with_stock(session, office)
    ]


@router.post("/products", response_model=AssetResponse, status_code=201)
def create_product(
    body: AssetCreate,
    session: InventorySession,
) -> AssetResponse:
    asset = Asset(**body.model_dump())
    if session.exec(select(Asset).where(Asset.sku == asset.sku)).first() is not None:
        raise HTTPException(status_code=409, detail="Ya existe un activo con este SKU.")
    session.add(asset)
    try:
        session.commit()
        session.refresh(asset)
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un activo con este SKU.")
    return _asset_response(asset, 0)


@router.get(
    "/products/{asset_id}",
    response_model=AssetResponse,
)
def get_product(asset_id: int, session: InventorySession) -> AssetResponse:
    asset = session.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Activo no encontrado.")
    return _asset_response(asset, _stock_for_asset(session, asset_id))


@router.post("/orders/inbound", response_model=AssetEntryResponse, status_code=201)
def create_inbound_order(
    body: AssetEntryCreate,
    session: InventorySession,
    current_user: CurrentUser,
) -> AssetEntryResponse:
    with session.begin():
        asset = session.exec(
            select(Asset)
            .where(Asset.id == body.asset_id)
            .with_for_update()
        ).first()
        if asset is None:
            raise HTTPException(status_code=404, detail="Activo no encontrado.")
        entry = AssetEntry(
            **body.model_dump(),
            user_uuid=current_user.uuid,
        )
        session.add(entry)
        session.flush()
    session.refresh(entry)
    return _entry_response(entry)


@router.post("/orders/outbound", response_model=AssetExitResponse, status_code=201)
def create_outbound_order(
    body: AssetExitCreate,
    session: InventorySession,
    current_user: CurrentUser,
) -> AssetExitResponse:
    with session.begin():
        asset = session.exec(
            select(Asset)
            .where(Asset.id == body.asset_id)
            .with_for_update()
        ).first()
        if asset is None:
            raise HTTPException(status_code=404, detail="Activo no encontrado.")

        available = _stock_for_asset(session, body.asset_id)
        if body.quantity > available:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient stock for asset '{asset.name}'. "
                    f"Available: {available}, requested: {body.quantity}."
                ),
            )

        exit_order = AssetExit(
            **body.model_dump(),
            user_uuid=current_user.uuid,
        )
        session.add(exit_order)
        session.flush()
    session.refresh(exit_order)
    return _exit_response(exit_order)


@router.get(
    "/orders",
    response_model=list[OrderListItem],
)
def list_orders(
    session: InventorySession,
    users: UsersTable,
    profiles: ProfilesTable,
    office: Annotated[Office | None, Query()] = None,
) -> list[OrderListItem]:
    creator_names = _creator_names(users, profiles)
    inbound_query = select(AssetEntry, Asset).join(Asset, Asset.id == AssetEntry.asset_id)
    outbound_query = select(AssetExit, Asset).join(Asset, Asset.id == AssetExit.asset_id)
    if office is not None:
        inbound_query = inbound_query.where(AssetEntry.office == office)
        outbound_query = outbound_query.where(AssetExit.office == office)

    orders: list[OrderListItem] = []
    for entry, asset in session.exec(inbound_query).all():
        orders.append(
            OrderListItem(
                id=entry.id,
                order_type="inbound",
                asset=_asset_summary(asset),
                quantity=entry.quantity,
                office=entry.office,
                created_at=entry.created_at,
                creator_name=creator_names.get(entry.user_uuid),
                supplier=entry.supplier,
            )
        )
    for exit_order, asset in session.exec(outbound_query).all():
        orders.append(
            OrderListItem(
                id=exit_order.id,
                order_type="outbound",
                asset=_asset_summary(asset),
                quantity=exit_order.quantity,
                office=exit_order.office,
                created_at=exit_order.created_at,
                creator_name=creator_names.get(exit_order.user_uuid),
                exit_type=exit_order.exit_type,
                assigned_to=exit_order.assigned_to,
            )
        )
    return sorted(orders, key=lambda order: order.created_at, reverse=True)
