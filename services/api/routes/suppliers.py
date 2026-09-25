"""
Directorio de proveedores de Nexova (/suppliers), persistido en TinyDB.

El cliente nunca envia `id` ni `updated_at`: el id es el doc_id de TinyDB
y updated_at se fija en UTC en cada alta o modificacion (tarifa, estado).
"""
from __future__ import annotations

from functools import reduce
from operator import and_
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from tinydb import where
from tinydb.table import Document, Table

from database import db_lock, get_suppliers_table, utc_now_iso
from models import (
    ErrorResponse,
    ProviderCategory,
    ProviderCreate,
    ProviderResponse,
    UpdateRateRequest,
    UpdateStatusRequest,
)

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

SuppliersTable = Annotated[Table, Depends(get_suppliers_table)]

NOT_FOUND_MESSAGE = "Proveedor no encontrado."
NOT_FOUND_RESPONSE = {
    404: {"model": ErrorResponse, "description": "No existe ningun proveedor con ese id."}
}


def _to_response(doc: Document) -> ProviderResponse:
    return ProviderResponse(id=doc.doc_id, **doc)


def _get_or_404(table: Table, supplier_id: int) -> Document:
    doc = table.get(doc_id=supplier_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND_MESSAGE)
    return doc


def _update_or_404(table: Table, supplier_id: int, fields: dict) -> ProviderResponse:
    with db_lock:
        _get_or_404(table, supplier_id)
        table.update({**fields, "updated_at": utc_now_iso()}, doc_ids=[supplier_id])
        return _to_response(table.get(doc_id=supplier_id))


@router.post(
    "",
    response_model=ProviderResponse,
    status_code=201,
    summary="Registra un proveedor",
    description=(
        "Valida el payload (tarifa > 0, al menos una categoria, moneda coherente "
        "con el pais) y lo guarda en TinyDB. Devuelve el registro con su id y "
        "updated_at asignados por el sistema."
    ),
)
def create_supplier(provider: ProviderCreate, table: SuppliersTable) -> ProviderResponse:
    record = {**provider.model_dump(mode="json"), "updated_at": utc_now_iso()}
    with db_lock:
        doc_id = table.insert(record)
        return _to_response(table.get(doc_id=doc_id))


@router.get(
    "",
    response_model=List[ProviderResponse],
    summary="Lista proveedores",
    description="Sin parametros devuelve todos; country y category se pueden combinar.",
)
def list_suppliers(
    table: SuppliersTable,
    country: Annotated[
        Optional[Literal["Spain", "USA"]], Query(description="Filtra por pais del contrato")
    ] = None,
    category: Annotated[
        Optional[ProviderCategory], Query(description="Filtra por categoria de servicio")
    ] = None,
) -> List[ProviderResponse]:
    conditions = []
    if country is not None:
        conditions.append(where("country") == country)
    if category is not None:
        conditions.append(where("categories").any([category.value]))

    with db_lock:
        docs = table.search(reduce(and_, conditions)) if conditions else table.all()
    return [_to_response(doc) for doc in sorted(docs, key=lambda doc: doc.doc_id)]


@router.get(
    "/{supplier_id}",
    response_model=ProviderResponse,
    summary="Detalle de un proveedor",
    responses=NOT_FOUND_RESPONSE,
)
def get_supplier(supplier_id: int, table: SuppliersTable) -> ProviderResponse:
    with db_lock:
        return _to_response(_get_or_404(table, supplier_id))


@router.patch(
    "/{supplier_id}/rate",
    response_model=ProviderResponse,
    summary="Actualiza la tarifa mensual",
    description="La nueva tarifa debe ser mayor que 0. Actualiza updated_at.",
    responses=NOT_FOUND_RESPONSE,
)
def update_supplier_rate(
    supplier_id: int, body: UpdateRateRequest, table: SuppliersTable
) -> ProviderResponse:
    return _update_or_404(table, supplier_id, {"monthly_rate": body.monthly_rate})


@router.patch(
    "/{supplier_id}/status",
    response_model=ProviderResponse,
    summary="Activa o suspende un proveedor",
    responses=NOT_FOUND_RESPONSE,
)
def update_supplier_status(
    supplier_id: int, body: UpdateStatusRequest, table: SuppliersTable
) -> ProviderResponse:
    return _update_or_404(table, supplier_id, {"status": body.status.value})


@router.delete(
    "/{supplier_id}",
    status_code=204,
    response_class=Response,
    summary="Elimina un proveedor",
    responses=NOT_FOUND_RESPONSE,
)
def delete_supplier(supplier_id: int, table: SuppliersTable) -> Response:
    with db_lock:
        _get_or_404(table, supplier_id)
        table.remove(doc_ids=[supplier_id])
    return Response(status_code=204)
