"""
Crea (o asegura) el primer usuario admin desde ADMIN_EMAIL/ADMIN_PASSWORD.

Idempotente: si ya existe un usuario con ese email, no hace nada (no le
cambia el rol ni la contrasena, para no escalar privilegios de una cuenta
existente al re-ejecutar el script sin intencion explicita). Promover a
admin a otra cuenta se hace despues via PUT /users/{id} por un administrador.

Ejecutar (desde services/api):
    uv run seed-users
"""
from __future__ import annotations

import logging
import sys

from config import ADMIN_EMAIL, ADMIN_PASSWORD
from security import get_user_by_email, hash_password
from database import utc_now_iso
from users_db import get_users_table, users_db_lock

logger = logging.getLogger("seed_users")


def seed_admin(table, email: str | None, password: str | None) -> bool:
    """Devuelve True si se creo un admin nuevo, False si ya existia."""
    if not email or not password:
        raise ValueError("ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios (definelos en .env).")

    with users_db_lock:
        existing = get_user_by_email(table, email)
        if existing is not None:
            if existing.get("role") != "admin":
                logger.warning(
                    "Ya existe un usuario con email=%s pero role=%s: no se modifica.",
                    email,
                    existing.get("role"),
                )
            return False

        table.insert(
            {
                "email": email,
                "hashed_password": hash_password(password),
                "is_active": True,
                "role": "admin",
                "created_at": utc_now_iso(),
            }
        )
        return True


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    try:
        created = seed_admin(get_users_table(), ADMIN_EMAIL, ADMIN_PASSWORD)
    except ValueError as exc:
        logger.error(str(exc))
        sys.exit(1)

    if created:
        logger.info("Admin bootstrap: creado (email=%s).", ADMIN_EMAIL)
    else:
        logger.info("Admin bootstrap: ya existia (email=%s).", ADMIN_EMAIL)


if __name__ == "__main__":
    main()
