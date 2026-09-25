"""
Carga los proveedores iniciales de fixtures/suppliers.json en TinyDB.

Idempotente: un proveedor se considera ya existente si hay otro con el
mismo `name` (sin distinguir mayusculas ni espacios extra), y en ese caso
no se vuelve a insertar. Cada registro se valida con ProviderCreate antes
de guardarse, igual que en POST /suppliers.

Ejecutar (desde services/api):
    uv run seed
    # o bien: uv run python seed.py
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Tuple

from pydantic import TypeAdapter
from tinydb.table import Table

from database import db_lock, get_suppliers_table, utc_now_iso
from models import ProviderCreate

FIXTURES_PATH = Path(__file__).resolve().parent / "fixtures" / "suppliers.json"

logger = logging.getLogger("seed")


def _normalize_name(name: str) -> str:
    return " ".join(name.split()).casefold()


def load_fixtures(path: Path = FIXTURES_PATH) -> List[ProviderCreate]:
    return TypeAdapter(List[ProviderCreate]).validate_json(path.read_bytes())


def seed_suppliers(table: Table, providers: List[ProviderCreate]) -> Tuple[int, int]:
    """Inserta los proveedores que no existan. Devuelve (insertados, ya existentes)."""
    with db_lock:
        existing_names = {_normalize_name(doc.get("name", "")) for doc in table.all()}
        new_records = []
        already_existed = 0

        for provider in providers:
            key = _normalize_name(provider.name)
            if key in existing_names:
                already_existed += 1
                continue
            existing_names.add(key)
            new_records.append({**provider.model_dump(mode="json"), "updated_at": utc_now_iso()})

        if new_records:
            table.insert_multiple(new_records)

    return len(new_records), already_existed


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    added, already_existed = seed_suppliers(get_suppliers_table(), load_fixtures())
    logger.info(
        "Seed completed: %d new suppliers added, %d already existed.",
        added,
        already_existed,
    )


if __name__ == "__main__":
    main()
