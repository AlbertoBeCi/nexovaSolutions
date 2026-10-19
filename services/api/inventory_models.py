"""SQLModel tables for Nexova's inventory domain."""
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, String
from sqlmodel import Field, Relationship, SQLModel

CATEGORIES = ("hardware", "peripherals", "office_supplies", "training_materials")
OFFICES = ("Valencia", "Miami")
EXIT_TYPES = ("allocation", "consumption")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Asset(SQLModel, table=True):
    __tablename__ = "assets"
    __table_args__ = (
        CheckConstraint(
            "category IN ('hardware', 'peripherals', 'office_supplies', 'training_materials')",
            name="ck_assets_category",
        ),
        CheckConstraint("office IN ('Valencia', 'Miami')", name="ck_assets_office"),
        CheckConstraint("length(trim(name)) > 0", name="ck_assets_name_not_blank"),
        CheckConstraint("length(trim(sku)) > 0", name="ck_assets_sku_not_blank"),
    )

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(sa_type=String(160), nullable=False)
    sku: str = Field(sa_type=String(64), nullable=False, unique=True, index=True)
    category: str = Field(sa_type=String(32), nullable=False)
    office: str = Field(sa_type=String(32), nullable=False)

    entries: list["AssetEntry"] = Relationship(back_populates="asset")
    exits: list["AssetExit"] = Relationship(back_populates="asset")


class AssetEntry(SQLModel, table=True):
    __tablename__ = "asset_entries"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_asset_entries_quantity_positive"),
        CheckConstraint("office IN ('Valencia', 'Miami')", name="ck_asset_entries_office"),
        CheckConstraint("length(trim(supplier)) > 0", name="ck_asset_entries_supplier_not_blank"),
        CheckConstraint("length(trim(user_uuid)) > 0", name="ck_asset_entries_user_not_blank"),
    )

    id: int | None = Field(default=None, primary_key=True)
    asset_id: int = Field(foreign_key="assets.id", nullable=False, index=True)
    quantity: int = Field(nullable=False)
    supplier: str = Field(sa_type=String(160), nullable=False)
    office: str = Field(sa_type=String(32), nullable=False)
    created_at: datetime = Field(
        default_factory=utc_now, sa_type=DateTime(timezone=True), nullable=False
    )
    # Stable UUID from TinyDB; its integer document ID remains unchanged.
    user_uuid: str = Field(sa_type=String(64), nullable=False)

    asset: Asset = Relationship(back_populates="entries")


class AssetExit(SQLModel, table=True):
    __tablename__ = "asset_exits"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_asset_exits_quantity_positive"),
        CheckConstraint("office IN ('Valencia', 'Miami')", name="ck_asset_exits_office"),
        CheckConstraint(
            "exit_type IN ('allocation', 'consumption')", name="ck_asset_exits_type"
        ),
        CheckConstraint(
            "((exit_type = 'allocation' AND assigned_to IS NOT NULL "
            "AND length(trim(assigned_to)) > 0) OR "
            "(exit_type = 'consumption' AND assigned_to IS NULL))",
            name="ck_asset_exits_assignment_matches_type",
        ),
        CheckConstraint("length(trim(user_uuid)) > 0", name="ck_asset_exits_user_not_blank"),
    )

    id: int | None = Field(default=None, primary_key=True)
    asset_id: int = Field(foreign_key="assets.id", nullable=False, index=True)
    quantity: int = Field(nullable=False)
    exit_type: str = Field(sa_type=String(16), nullable=False)
    assigned_to: str | None = Field(default=None, sa_type=String(160))
    office: str = Field(sa_type=String(32), nullable=False)
    created_at: datetime = Field(
        default_factory=utc_now, sa_type=DateTime(timezone=True), nullable=False
    )
    user_uuid: str = Field(sa_type=String(64), nullable=False)

    asset: Asset = Relationship(back_populates="exits")
