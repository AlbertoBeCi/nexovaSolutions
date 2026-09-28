"""
Infraestructura de seguridad transversal: hashing de contrasenas, JWT y
dependencias de autorizacion (get_current_user, get_current_admin,
ensure_self_or_admin).

Separado de routes/auth.py porque tambien lo usan routes/users.py,
routes/profiles.py, routes/suppliers.py y routes/incidents.py para proteger
sus rutas.

Nota: el paquete de PyPI `libpass[bcrypt]` (fork drop-in de `passlib`) se
importa como `passlib`, no como `libpass` — mantiene el nombre del paquete
original para ser un reemplazo directo.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from tinydb import where

from config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from models import RoleEnum, UserInDB
from users_db import UsersTable

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

CREDENTIALS_ERROR = HTTPException(
    status_code=401,
    detail="Credenciales invalidas o token expirado.",
    headers={"WWW-Authenticate": "Bearer"},
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode({"sub": subject, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    # `algorithms` fijo y explicito: nunca se confia en el algoritmo del token.
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_user_by_email(table, email: str):
    return table.get(where("email") == email)


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    table: UsersTable,
) -> UserInDB:
    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
    except JWTError:
        raise CREDENTIALS_ERROR
    if email is None:
        raise CREDENTIALS_ERROR

    doc = get_user_by_email(table, email)
    if doc is None or not doc.get("is_active", False):
        raise CREDENTIALS_ERROR

    return UserInDB(id=doc.doc_id, **doc)


CurrentUser = Annotated[UserInDB, Depends(get_current_user)]


def get_current_admin(current_user: CurrentUser) -> UserInDB:
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(status_code=403, detail="Requiere permisos de administrador.")
    return current_user


def ensure_self_or_admin(current_user: UserInDB, target_user_id: int) -> None:
    if current_user.id != target_user_id and current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=403, detail="No tienes permiso para acceder a este recurso."
        )
