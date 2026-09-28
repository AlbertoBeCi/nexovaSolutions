"""
Gestion de usuarios de Nexova (/users), persistidos en TinyDB.

POST /users es el unico endpoint publico (registro): fuerza role="user" (el
body no acepta `role`, ver UserCreate en models.py) y hashea la contrasena.
El resto de rutas exige login, y GET/PUT/DELETE /users/{id} exige ademas ser
el propio usuario o un administrador.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from tinydb import where
from tinydb.table import Document, Table

from database import utc_now_iso
from models import ProfileResponse, UserCreate, UserResponse, UserUpdate
from security import (
    CurrentUser,
    ensure_self_or_admin,
    get_current_admin,
    get_user_by_email,
    hash_password,
)
from users_db import ProfilesTable, UsersTable, users_db_lock

router = APIRouter(prefix="/users", tags=["users"])

NOT_FOUND_MESSAGE = "Usuario no encontrado."


def build_user_response(user_doc: Document, profiles_table: Table) -> UserResponse:
    profile_doc = profiles_table.get(where("user_id") == user_doc.doc_id)
    profile = (
        ProfileResponse(id=profile_doc.doc_id, **profile_doc) if profile_doc is not None else None
    )
    return UserResponse(id=user_doc.doc_id, profile=profile, **user_doc)


def _get_user_or_404(table: Table, user_id: int) -> Document:
    doc = table.get(doc_id=user_id)
    if doc is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND_MESSAGE)
    return doc


@router.post(
    "",
    response_model=UserResponse,
    status_code=201,
    summary="Registra un usuario",
    description=(
        "Publico. Hashea la contrasena, crea el usuario con role='user' y, si "
        "se envia `profile`, tambien crea el Profile vinculado."
    ),
)
def create_user(
    payload: UserCreate, users: UsersTable, profiles: ProfilesTable
) -> UserResponse:
    with users_db_lock:
        if get_user_by_email(users, payload.email) is not None:
            raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email.")

        user_record = {
            "email": payload.email,
            "hashed_password": hash_password(payload.password),
            "is_active": True,
            "role": "user",
            "created_at": utc_now_iso(),
        }
        user_id = users.insert(user_record)

        if payload.profile is not None:
            profiles.insert({"user_id": user_id, **payload.profile.model_dump(mode="json")})

        return build_user_response(users.get(doc_id=user_id), profiles)


@router.get(
    "",
    response_model=List[UserResponse],
    summary="Lista usuarios",
    dependencies=[Depends(get_current_admin)],
)
def list_users(users: UsersTable, profiles: ProfilesTable) -> List[UserResponse]:
    return [
        build_user_response(doc, profiles)
        for doc in sorted(users.all(), key=lambda doc: doc.doc_id)
    ]


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Detalle de un usuario",
)
def get_user(
    user_id: int, current_user: CurrentUser, users: UsersTable, profiles: ProfilesTable
) -> UserResponse:
    ensure_self_or_admin(current_user, user_id)
    return build_user_response(_get_user_or_404(users, user_id), profiles)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Actualiza email y/o rol de un usuario",
    description="Cambiar `role` requiere permisos de administrador.",
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: CurrentUser,
    users: UsersTable,
    profiles: ProfilesTable,
) -> UserResponse:
    ensure_self_or_admin(current_user, user_id)
    if payload.role is not None and current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Solo un administrador puede cambiar el rol de un usuario."
        )

    with users_db_lock:
        _get_user_or_404(users, user_id)

        fields: dict = {}
        if payload.email is not None:
            existing = get_user_by_email(users, payload.email)
            if existing is not None and existing.doc_id != user_id:
                raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email.")
            fields["email"] = payload.email
        if payload.role is not None:
            fields["role"] = payload.role.value

        if fields:
            users.update(fields, doc_ids=[user_id])

        return build_user_response(users.get(doc_id=user_id), profiles)


@router.delete(
    "/{user_id}",
    status_code=204,
    response_class=Response,
    summary="Elimina un usuario (y su perfil)",
)
def delete_user(
    user_id: int, current_user: CurrentUser, users: UsersTable, profiles: ProfilesTable
) -> Response:
    ensure_self_or_admin(current_user, user_id)
    with users_db_lock:
        _get_user_or_404(users, user_id)
        users.remove(doc_ids=[user_id])
        profiles.remove(where("user_id") == user_id)
    return Response(status_code=204)
