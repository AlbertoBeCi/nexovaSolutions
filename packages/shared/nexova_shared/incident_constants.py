"""
Enums, etiquetas en espanol y transiciones de estado del GESTOR DE
INCIDENCIAS (modelo persistente: services/incident-manager-api/models.py).

No confundir con incidents_analysis.py: ese modulo valida el CSV del
ANALIZADOR de tickets de soporte (categorias en mayusculas tipo TECHNICAL,
estados OPEN/CLOSED/DISCARDED) para calcular metricas agregadas sin
guardar nada. Este modulo define el dominio del gestor (incidencias
persistidas, con su propio ciclo de vida) que consumen tanto
services/incident-manager-api/ (API) como scripts/seed_incidents.py (seed)
y las paginas de uis/application/ (via su espejo TypeScript en
types/incident.ts).

Es la UNICA fuente de verdad de estos valores: ningun consumidor debe
inventar ni renombrar un codigo o etiqueta por su cuenta.
"""
from __future__ import annotations

# ── Categoria ────────────────────────────────────────────────────────────
CATEGORIES: tuple[str, ...] = (
    "technical_failure",
    "process_error",
    "client_complaint",
    "candidate_issue",
    "staff_issue",
    "sla_breach",
    "data_quality",
    "other",
)

CATEGORY_LABELS: dict[str, str] = {
    "technical_failure": "Fallo tecnico",
    "process_error": "Error de proceso",
    "client_complaint": "Queja de cliente",
    "candidate_issue": "Incidencia con candidato",
    "staff_issue": "Incidencia de personal",
    "sla_breach": "Incumplimiento de SLA",
    "data_quality": "Calidad de datos",
    "other": "Otra",
}

# ── Estado ───────────────────────────────────────────────────────────────
STATUSES: tuple[str, ...] = ("open", "in_progress", "resolved", "discarded")

STATUS_LABELS: dict[str, str] = {
    "open": "Abierta",
    "in_progress": "En curso",
    "resolved": "Resuelta",
    "discarded": "Descartada",
}

DEFAULT_STATUS = "open"

# Estados finales: ninguna transicion saliente (ver TRANSITIONS).
FINAL_STATUSES: frozenset[str] = frozenset({"resolved", "discarded"})

# Transiciones de estado validas: origen -> destinos permitidos.
# open -> in_progress, open -> discarded
# in_progress -> resolved, in_progress -> discarded
# resolved y discarded son finales (tupla vacia).
TRANSITIONS: dict[str, tuple[str, ...]] = {
    "open": ("in_progress", "discarded"),
    "in_progress": ("resolved", "discarded"),
    "resolved": (),
    "discarded": (),
}

# ── Origen ───────────────────────────────────────────────────────────────
ORIGINS: tuple[str, ...] = ("customer", "branch", "internal")

ORIGIN_LABELS: dict[str, str] = {
    "customer": "Cliente",
    "branch": "Sede",
    "internal": "Interna",
}

# ── Sede (branch) ────────────────────────────────────────────────────────
# `central` es la sede central de Valencia (no crear un valor aparte de
# "headquarters"); `remote` es un empleado sin sede fija, distinto de
# `central` y de `valencia_operations`.
BRANCHES: tuple[str, ...] = (
    "central",
    "valencia_operations",
    "miami_office",
    "remote",
)

BRANCH_LABELS: dict[str, str] = {
    "central": "Central — Sede Valencia",
    "valencia_operations": "Valencia — Operaciones",
    "miami_office": "Miami Office",
    "remote": "Remoto (empleado sin sede fija)",
}
