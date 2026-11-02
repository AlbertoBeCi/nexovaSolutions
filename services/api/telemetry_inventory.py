"""Inventory capture from confirmed transactions and explicit metadata, never guesses.

The sidecar is business configuration, not an event store. Demo quotes apply only
to explicitly registered demo products/suppliers. Durable metadata/outbox belongs
to the storage project; an incomplete baseline produces a diagnostic.
"""
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlmodel import select

from config import TELEMETRY_INVENTORY_METADATA_PATH
from inventory_models import AssetEntry
from telemetry_capture import diagnostics, track

SafeInt = Annotated[int, Field(strict=True, ge=0, le=9007199254740991)]
PositiveInt = Annotated[int, Field(strict=True, ge=1, le=9007199254740991)]
Slug = Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9_.:-]*$", max_length=80)]


class ClosedModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProductMetadata(ClosedModel):
    product_id: PositiveInt
    product_category: Literal["training_kit", "certification", "onboarding_equipment"]
    programme_id: Slug
    threshold: PositiveInt = 6
    threshold_version: PositiveInt = 1


class EntryMetadata(ClosedModel):
    order_id: PositiveInt
    product_id: PositiveInt
    office: Literal["Valencia", "Miami"]
    supplier_id: Slug
    unit_cost_minor: SafeInt


class DemoQuote(ClosedModel):
    product_id: PositiveInt
    office: Literal["Valencia", "Miami"]
    supplier_label: Annotated[str, Field(pattern=r"^DEMO TELEMETRIA - [A-Z0-9 -]+$", max_length=160)]
    supplier_id: Slug
    unit_cost_minor: SafeInt


class MetadataRegistry(ClosedModel):
    version: Literal[1] = 1
    provenance: Literal["synthetic_demo"] = "synthetic_demo"
    programmes: list[Slug] = Field(default_factory=list)
    products: list[ProductMetadata] = Field(default_factory=list)
    entries: list[EntryMetadata] = Field(default_factory=list)
    demo_quotes: list[DemoQuote] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_registry(self):
        if len(set(self.programmes)) != len(self.programmes):
            raise ValueError("Duplicate programme")
        for items, key in [(self.products, "product_id"), (self.entries, "order_id")]:
            if len({getattr(item, key) for item in items}) != len(items):
                raise ValueError("Duplicate metadata identifier")
        if any(p.programme_id not in self.programmes for p in self.products):
            raise ValueError("Unregistered programme")
        if len({(q.product_id, q.office, q.supplier_label) for q in self.demo_quotes}) != len(self.demo_quotes):
            raise ValueError("Ambiguous quote")
        return self


_recent: OrderedDict[int, EntryMetadata] = OrderedDict()
_lock = Lock()


def load_registry() -> MetadataRegistry:
    if not TELEMETRY_INVENTORY_METADATA_PATH:
        return MetadataRegistry()
    path = Path(TELEMETRY_INVENTORY_METADATA_PATH)
    if path.stat().st_size > 1024 * 1024:
        raise ValueError("Metadata limit exceeded")
    return MetadataRegistry.model_validate_json(path.read_bytes())


def _office(value):
    return "valencia" if value == "Valencia" else "miami"


def _dimensions(asset, office, metadata):
    return {"office": _office(office), "product_id": asset.id,
            "product_category": metadata.product_category if metadata else None,
            "programme_id": metadata.programme_id if metadata else None,
            "currency": "EUR" if office == "Valencia" else "USD"}


def _missing(asset, order, kind, metadata, affected, fields, reason="metadata_missing"):
    return ("inventory_metadata_missing", {**_dimensions(asset, order.office, metadata),
            "quantity": 0, "order_id": order.id, "order_type": kind,
            "missing_fields": fields, "reason_code": reason, "affected_event": affected})


def prepare_inbound(session, asset, entry):
    """Called under the asset lock. Returns events only; never sends before commit."""
    try:
        registry = load_registry()
        product = next((p for p in registry.products if p.product_id == asset.id), None)
        quote = next((q for q in registry.demo_quotes if q.product_id == asset.id and q.office == entry.office and q.supplier_label == entry.supplier), None)
        missing = ([] if product else ["product_category", "programme_id"]) + ([] if quote else ["supplier_id", "unit_cost_minor"])
        if missing:
            return [_missing(asset, entry, "inbound", product, name, missing) for name in ["inbound_order_created", "kit_cost_variance_detected"]], None
        cost = EntryMetadata(order_id=entry.id, product_id=asset.id, office=entry.office, supplier_id=quote.supplier_id, unit_cost_minor=quote.unit_cost_minor)
        total = entry.quantity * cost.unit_cost_minor
        if total > 9007199254740991:
            raise ValueError("Unsafe cost total")
        common = {**_dimensions(asset, entry.office, product), "quantity": entry.quantity,
                  "order_id": entry.id, "order_type": "inbound", "asset_office": _office(asset.office),
                  "supplier_id": cost.supplier_id, "unit_cost_minor": cost.unit_cost_minor}
        events = [("inbound_order_created", {**common, "total_cost_minor": total})]
        cutoff = datetime.now(timezone.utc)
        # The lock serializes writers of this asset. The current uncommitted row
        # is excluded explicitly, including timestamp ties.
        prior = session.exec(select(AssetEntry).where(AssetEntry.asset_id == asset.id, AssetEntry.office == entry.office,
                             AssetEntry.id != entry.id, AssetEntry.created_at >= cutoff - timedelta(days=90),
                             AssetEntry.created_at < cutoff)).all()
        known = {e.order_id: e for e in registry.entries}
        with _lock:
            known.update(_recent)
        count = units = amount = 0
        incomplete = False
        for row in prior:
            meta = known.get(row.id)
            if meta is None or meta.product_id != row.asset_id or meta.office != row.office:
                incomplete = True
                continue
            if meta.supplier_id == cost.supplier_id:
                count += 1
                units += row.quantity
                amount += row.quantity * meta.unit_cost_minor
        if incomplete or count < 3 or amount == 0:
            reason = "metadata_missing" if incomplete else "insufficient_history" if count < 3 else "zero_baseline"
            events.append(_missing(asset, entry, "inbound", product, "kit_cost_variance_detected", ["baseline"], reason))
        elif abs(cost.unit_cost_minor * units - amount) * 100 > amount * 10:
            if max(amount, units, count) > 9007199254740991:
                raise ValueError("Unsafe baseline")
            variance = (cost.unit_cost_minor * units - amount) * 100 / amount
            if variance > 1000000000000:
                raise ValueError("Unsafe variance")
            events.append(("kit_cost_variance_detected", {**common,
                "baseline_total_cost_minor": amount, "baseline_total_quantity": units,
                "baseline_order_count": count, "window_days": 90, "threshold_percent": 10,
                "variance_percent": variance, "baseline_cutoff_at": cutoff.isoformat().replace("+00:00", "Z")}))
        return events, cost
    except Exception:
        diagnostics["capture_failures"] += 1
        return [], None


def prepare_outbound(asset, order, stock_before):
    try:
        registry = load_registry()
        product = next((p for p in registry.products if p.product_id == asset.id), None)
        if product is None:
            return [_missing(asset, order, "outbound", None, name, ["product_category", "programme_id"]) for name in ["outbound_order_created", "stock_threshold_triggered"]]
        events = [("outbound_order_created", {**_dimensions(asset, order.office, product),
                  "quantity": order.quantity, "order_id": order.id, "order_type": "outbound",
                  "asset_office": _office(asset.office), "exit_type": order.exit_type})]
        stock_after = stock_before - order.quantity
        if stock_before >= product.threshold and stock_after < product.threshold:
            events.append(("stock_threshold_triggered", {**_dimensions(asset, asset.office, product),
                "quantity": stock_after, "stock_before": stock_before, "stock_after": stock_after,
                "threshold": product.threshold, "threshold_version": product.threshold_version,
                "order_id": order.id, "order_type": "outbound"}))
        return events
    except Exception:
        diagnostics["capture_failures"] += 1
        return []


def publish(events, entry_metadata=None):
    """Best-effort publication after commit. No durable outbox in capture phase."""
    try:
        if entry_metadata is not None:
            with _lock:
                _recent[entry_metadata.order_id] = entry_metadata
                if len(_recent) > 10000:
                    _recent.popitem(last=False)
        for name, properties in events:
            track(name, properties)
    except Exception:
        diagnostics["capture_failures"] += 1
