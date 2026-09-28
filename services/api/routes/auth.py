"""
Login, sesion actual, y recuperacion/cambio de password (/auth), sobre las
tablas de usuarios de TinyDB.

POST /auth/forgot-password envia el link de reset por email via Resend
(mailer.py) si RESEND_API_KEY esta configurada; si no, cae a loguear el
token por consola, para poder probar el flujo completo en desarrollo sin
cuenta de Resend. Ver services/api/README.md.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError

from config import ENVIRONMENT, FRONTEND_URL
from mailer import send_password_reset_email
from models import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    MessageResponse,
    ResetPasswordRequest,
    Token,
    UserResponse,
)
from rate_limit import enforce_rate_limit
from routes.users import build_user_response
from security import (
    CurrentUser,
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    get_user_by_email,
    hash_password,
    password_fingerprint,
    verify_password,
)
from users_db import ProfilesTable, UsersTable, users_db_lock

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("auth")

# forgot-password/reset-password son sensibles a fuerza bruta y a spam de
# emails de reset: limitados por IP, constantes simples (no hace falta
# configurarlas por entorno para algo tan chico).
RATE_LIMIT_MAX_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 15 * 60

INVALID_CREDENTIALS = HTTPException(
    status_code=401,
    detail="Email o contrasena incorrectos.",
    headers={"WWW-Authenticate": "Bearer"},
)

INVALID_RESET_TOKEN = HTTPException(
    status_code=400, detail="El token de reset es invalido, expiro o ya se utilizo."
)

SAME_PASSWORD_ERROR = HTTPException(
    status_code=400, detail="La nueva contrasena debe ser diferente a la actual."
)

INVALID_CURRENT_PASSWORD = HTTPException(
    status_code=401, detail="La contrasena actual no es correcta."
)

# Mensaje identico exista o no el email, para no revelar que emails estan
# registrados (evita enumeracion de usuarios).
RESET_REQUESTED_MESSAGE = (
    "Si el email esta registrado, enviamos instrucciones para restablecer la contrasena."
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

    return Token(access_token=create_access_token(doc["email"], doc["hashed_password"]))


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Usuario autenticado actual",
)
def read_current_user(
    current_user: CurrentUser, users: UsersTable, profiles: ProfilesTable
) -> UserResponse:
    return build_user_response(users.get(doc_id=current_user.id), profiles)


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    summary="Solicita el reset de password",
    description=(
        "Publico. Siempre responde 200 con el mismo mensaje, exista o no el "
        "email, para no revelar que cuentas estan registradas. Envia el link "
        "de reset por email via Resend si RESEND_API_KEY esta configurada; "
        "si no, lo loguea por consola. Limitado por IP (5 solicitudes / 15 min)."
    ),
)
def forgot_password(
    payload: ForgotPasswordRequest, request: Request, users: UsersTable
) -> MessageResponse:
    enforce_rate_limit(
        f"forgot-password:{request.client.host if request.client else 'unknown'}",
        RATE_LIMIT_MAX_ATTEMPTS,
        RATE_LIMIT_WINDOW_SECONDS,
    )

    doc = get_user_by_email(users, payload.email)
    if doc is not None and doc.get("is_active", False):
        token = create_password_reset_token(doc["email"], doc["hashed_password"])
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        sent = send_password_reset_email(doc["email"], reset_link)
        if not sent:
            if ENVIRONMENT != "production":
                # Sin RESEND_API_KEY (o si Resend fallo): modo desarrollo, se
                # loguea el token para poder probar el flujo sin email real.
                logger.info("Password reset solicitado para %s. Token: %s", doc["email"], token)
            else:
                # En produccion NUNCA se loguea el token en claro (ver
                # auditoria de manejo de errores): un log con acceso de
                # lectura no debe poder resetear la contrasena de nadie. El
                # usuario simplemente no recibe el link hasta que se
                # arregle la configuracion de Resend.
                logger.warning(
                    "No se pudo entregar el email de reset a %s (RESEND_API_KEY "
                    "ausente o Resend fallo) y ENVIRONMENT=production: el token "
                    "no se loguea. Revisa la configuracion de Resend.",
                    doc["email"],
                )

    return MessageResponse(detail=RESET_REQUESTED_MESSAGE)


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    summary="Confirma el reset y establece la nueva password",
    description=(
        "Publico. El token es de un solo uso: queda invalido en cuanto se "
        "usa (o en cuanto la password cambia por otra via), sin necesitar "
        "una tabla de tokens usados. Limitado por IP (5 solicitudes / 15 min)."
    ),
)
def reset_password(
    payload: ResetPasswordRequest, request: Request, users: UsersTable
) -> MessageResponse:
    enforce_rate_limit(
        f"reset-password:{request.client.host if request.client else 'unknown'}",
        RATE_LIMIT_MAX_ATTEMPTS,
        RATE_LIMIT_WINDOW_SECONDS,
    )

    try:
        token_payload = decode_password_reset_token(payload.token)
    except JWTError:
        raise INVALID_RESET_TOKEN

    with users_db_lock:
        doc = get_user_by_email(users, token_payload["sub"])
        if (
            doc is None
            or not doc.get("is_active", False)
            or token_payload.get("pwd_fp") != password_fingerprint(doc["hashed_password"])
        ):
            raise INVALID_RESET_TOKEN
        if verify_password(payload.new_password, doc["hashed_password"]):
            raise SAME_PASSWORD_ERROR

        users.update({"hashed_password": hash_password(payload.new_password)}, doc_ids=[doc.doc_id])

    return MessageResponse(detail="Contrasena actualizada correctamente.")


@router.post(
    "/change-password",
    response_model=Token,
    summary="Cambia la password del usuario autenticado",
    description=(
        "Requiere login y la contrasena actual. Devuelve un access token "
        "nuevo (el cambio invalida los tokens emitidos antes, incluido el "
        "que se uso para llamar a este endpoint)."
    ),
)
def change_password(
    payload: ChangePasswordRequest, current_user: CurrentUser, users: UsersTable
) -> Token:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise INVALID_CURRENT_PASSWORD
    if verify_password(payload.new_password, current_user.hashed_password):
        raise SAME_PASSWORD_ERROR

    new_hash = hash_password(payload.new_password)
    with users_db_lock:
        users.update({"hashed_password": new_hash}, doc_ids=[current_user.id])

    return Token(access_token=create_access_token(current_user.email, new_hash))
