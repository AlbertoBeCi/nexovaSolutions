# Progress

## Funciona

- **Hito 1** — Web pública migrada a Next/React en `uis/website/`: landing (`/`) +
  registro de talento en 3 pasos (`/talento`) con validaciones (mensajes literales
  de `CONTEXT.md`), tema claro/oscuro, Schema.org. La versión HTML/CSS/JS estática
  ya no existe.
- **Modelo de dominio** (`packages/domain/`) — interfaces de Candidato / Vacante / Proceso de
  selección y utilidades de búsqueda, filtrado, orden, scoring y agregaciones;
  `npm run typecheck` en verde; demo web con esbuild.
- **Hito 3 (parcial)** — `uis/backoffice/` (antes `talent-pipeline-tracker/`):
  tipos, cliente de API (CRUD de candidatos + notas), listado con filtros en URL,
  ficha de candidato con cambio rápido de estado/etapa y notas, formularios de
  alta y edición. Shell interno `AppShell`.
- **`uis/website/`** — Next.js 16: shell `SiteHeader`/`SiteFooter`, tema
  claro/oscuro, landing editorial (hero + ficha de candidato, servicios, por qué
  Nexova) y `/talento` con `TalentForm` (asistente de 3 pasos + validación).
  `dev`/`build`/`lint` en verde, `/` y `/talento` → 200, sin issues del overlay.
- **Infraestructura de agentes** — `memory-bank/` (negocio + técnico), `AGENTS.md`
  (lectura de sesión + flujo de 8 pasos + lista de "no modificar"), `.agents/rules/`
  (3 reglas con alcance declarado), skill `revision-textos-ui` con verificador
  ejecutable (`check-ui-texts.mjs`, PASS).
- **Estructura** — `packages/domain/` (ex `src/`), `docs/` poblado, raíz limpia.

## Falta

- Commit de la migración de la landing + PR actualizada (#11).
- `README.md` raíz desactualizado: sigue documentando `index.html` / `npx serve .`
  del Hito 1, que ya no existen (no tocar READMEs de momento).
- Backend propio en `services/`.
- Hitos posteriores (Telemetría, RAG, Agentes, Workflows, Real-time).

## Problemas conocidos

- El `AGENTS.md` de cada app de `uis/` lo regenera `next dev`/`next build`; hay que
  commitearlo tal cual cuando reaparezca en el diff.
- `docs/prompts.txt` y `docs/tareashito2.md` están en `.gitignore` (personales).
