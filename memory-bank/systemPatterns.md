# System patterns

## Organización

- Monorepo por responsabilidad (`uis/`, `services/`, `data/`, `agents/`,
  `packages/`, …). Nada de código suelto en la raíz. Cada app/servicio/agente con
  su `README.md`. Guía completa en `README.md` y `AGENTS.md`.
- Configuración de agentes en `.agents/` (`rules/`, `skills/`) y contexto en
  `memory-bank/`.

## Frontend

- App Router de Next.js. Cada app de `uis/` tiene su propio layout y una vista de
  entrada visible desde el primer commit.
- Capa de servicios (`uis/backoffice/src/services/api.ts`, `uis/application/lib/suppliers-api.ts`) que traduce entre el DTO de la API
  (snake_case) y el modelo de la UI (camelCase) en ambas direcciones.
- Diccionarios de etiquetas ES para todo enum de la API; la UI nunca muestra el
  valor crudo. Filtros que se guardan en la URL.
- Estados de carga y error explícitos en cada consumo de API.

## Backend

Una sola app FastAPI en `services/api/` con un router por dominio
(`routes/incidents.py`, `routes/suppliers.py`), modelos Pydantic en `models.py`
y arranque `uv run uvicorn main:app`. Layout plano (sin paquete `app/`).

- Modelos de entrada y salida separados: `ProviderCreate` (lo que envía el
  cliente) vs `ProviderResponse` (+ `id`, `updated_at` asignados por el sistema).
- Persistencia de proveedores en TinyDB (`database.py`): ruta por env
  `SUPPLIERS_DB_PATH`, tabla como dependencia FastAPI (se sustituye en tests) y
  un lock global porque TinyDB no es thread-safe.
- Seeders idempotentes ejecutables con `uv run <script>` (`[project.scripts]`).
- Mensajes de error de negocio en español; la UI traduce los 422 genéricos de
  Pydantic por `type`/`loc`.
- Interfaces compartidas con el frontend → `packages/` cuando haya dos consumidores.

## Convenciones transversales

- Commits: Conventional Commits en español, imperativo, sin tildes. Sin firmas de
  IA. Ramas `feature/*` → PR a `main`.
- Comprobaciones antes de commit según el área tocada (ver `AGENTS.md` §4).
- Registro de prompts del proyecto en `docs/prompts.md`.
