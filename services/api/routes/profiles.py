"""
Perfil del usuario autenticado (/profiles/me), sobre la tabla profiles de TinyDB.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from tinydb import where

from models import ProfileResponse, ProfileUpdate
from security import CurrentUser
from users_db import ProfilesTable, users_db_lock

router = APIRouter(prefix="/profiles", tags=["profiles"])

NOT_FOUND_MESSAGE = "Todavia no tienes un perfil creado."


@router.get(
    "/me",
    response_model=ProfileResponse,
    summary="Perfil del usuario autenticado",
    responses={404: {"description": NOT_FOUND_MESSAGE}},
)
def get_my_profile(current_user: CurrentUser, profiles: ProfilesTable) -> ProfileResponse:
    doc = profiles.get(where("user_id") == current_user.id)
    if doc is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND_MESSAGE)
    return ProfileResponse(id=doc.doc_id, **doc)


@router.put(
    "/me",
    response_model=ProfileResponse,
    summary="Crea o actualiza el perfil del usuario autenticado",
    description="Upsert: si el usuario todavia no tiene perfil, lo crea.",
)
def update_my_profile(
    payload: ProfileUpdate, current_user: CurrentUser, profiles: ProfilesTable
) -> ProfileResponse:
    with users_db_lock:
        existing = profiles.get(where("user_id") == current_user.id)
        record = {"user_id": current_user.id, **payload.model_dump(mode="json")}
        if existing is None:
            doc_id = profiles.insert(record)
        else:
            doc_id = existing.doc_id
            profiles.update(record, doc_ids=[doc_id])
        return ProfileResponse(id=doc_id, **profiles.get(doc_id=doc_id))
