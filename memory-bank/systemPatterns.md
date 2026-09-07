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
- Capa de servicios (`uis/backoffice/src/services/api.ts`) que traduce entre el DTO de la API
  (snake_case) y el modelo de la UI (camelCase) en ambas direcciones.
- Diccionarios de etiquetas ES para todo enum de la API; la UI nunca muestra el
  valor crudo. Filtros que se guardan en la URL.
- Estados de carga y error explícitos en cada consumo de API.

## Backend (previsto)

Una sola app FastAPI en `services/` con routers por dominio. Interfaces
compartidas con el frontend → `packages/`.

## Convenciones transversales

- Commits: Conventional Commits en español, imperativo, sin tildes. Sin firmas de
  IA. Ramas `feature/*` → PR a `main`.
- Comprobaciones antes de commit según el área tocada (ver `AGENTS.md` §4).
- Registro de prompts del proyecto en `docs/prompts.md`.
