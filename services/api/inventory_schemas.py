"""Strict request and explicit response schemas for the inventory API."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Category = Literal["hardware", "peripherals", "office_supplies", "training_materials"]
Office = Literal["Valencia", "Miami"]
ExitType = Literal["allocation", "consumption"]


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class AssetCreate(StrictSchema):
    name: str = Field(min_length=1, max_length=160)
    sku: str = Field(min_length=1, max_length=64)
    category: Category
    office: Office

    @field_validator("name", "sku")
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El campo no puede estar vacio.")
        return value


class AssetSummary(StrictSchema):
    id: int
    name: str
    sku: str
    category: Category
    office: Office


class AssetResponse(AssetSummary):
    current_stock: int


class AssetEntryCreate(StrictSchema):
    asset_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    supplier: str = Field(min_length=1, max_length=160)
    office: Office

    @field_validator("supplier")
    @classmethod
    def reject_blank_supplier(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("supplier no puede estar vacio.")
        return value


class AssetEntryResponse(StrictSchema):
    id: int
    asset_id: int
    quantity: int
    supplier: str
    office: Office
    created_at: datetime
    user_uuid: str


class AssetExitCreate(StrictSchema):
    asset_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    exit_type: ExitType
    assigned_to: str | None = Field(default=None, max_length=160)
    office: Office

    @model_validator(mode="after")
    def validate_assignment(self) -> AssetExitCreate:
        if self.exit_type == "allocation":
            if self.assigned_to is None or not self.assigned_to.strip():
                raise ValueError("assigned_to es obligatorio para una asignacion.")
        elif self.assigned_to is not None:
            raise ValueError("assigned_to debe ser null para un consumo.")
        return self


class AssetExitResponse(StrictSchema):
    id: int
    asset_id: int
    quantity: int
    exit_type: ExitType
    assigned_to: str | None
    office: Office
    created_at: datetime
    user_uuid: str


class OrderListItem(StrictSchema):
    id: int
    order_type: Literal["inbound", "outbound"]
    asset_id: int
    asset: AssetSummary
    quantity: int
    office: Office
    created_at: datetime
    user_uuid: str
    creator_name: str | None = None
    supplier: str | None = None
    exit_type: ExitType | None = None
    assigned_to: str | None = None
