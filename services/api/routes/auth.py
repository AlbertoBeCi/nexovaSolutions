"""
Login y sesion actual (/auth), sobre las tablas de usuarios de TinyDB.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from models import Token, UserResponse
from routes.users import build_user_response
from security import CurrentUser, create_access_token, get_user_by_email, verify_password
from users_db import ProfilesTable, UsersTable

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS = HTTPException(
    status_code=401,
    detail="Email o contrasena incorrectos.",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post(
    "/login",
    response_model=Token,
    summary="Inicia sesion y emite un JWT",
    description="`username` debe ser el email del usuario (formulario OAuth2 estandar).",
)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], users: UsersTable
) -> Token:
    doc = get_user_by_email(users, form_data.username)
    if doc is None or not doc.get("is_active", False):
        raise INVALID_CREDENTIALS
    if not verify_password(form_data.password, doc["hashed_password"]):
        raise INVALID_CREDENTIALS

    return Token(access_token=create_access_token(subject=doc["email"]))


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Usuario autenticado actual",
)
def read_current_user(
    current_user: CurrentUser, users: UsersTable, profiles: ProfilesTable
) -> UserResponse:
    return build_user_response(users.get(doc_id=current_user.id), profiles)
