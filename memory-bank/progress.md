# Progress

## Funciona

- **Hito 1** — Landing pública + formulario de talento (`index.html`,
  `application.html`), estáticos, con validaciones en JS, Schema.org y modal de
  formulario compartido.
- **Modelo de dominio** (`packages/domain/`) — interfaces de Candidato / Vacante / Proceso de
  selección y utilidades de búsqueda, filtrado, orden, scoring y agregaciones;
  `npm run typecheck` en verde; demo web con esbuild.
- **Hito 3 (parcial)** — `uis/backoffice/` (antes `talent-pipeline-tracker/`):
  tipos, cliente de API (CRUD de candidatos + notas), listado con filtros en URL,
  ficha de candidato con cambio rápido de estado/etapa y notas, formularios de
  alta y edición. Shell interno `AppShell`.
- **`uis/website/`** — Next.js 16 con shell (`SiteHeader`/`SiteFooter`), landing
  (hero, servicios, por qué Nexova, CTA), `/talento` stub, JSON-LD Organization.
  `dev`/`build`/`lint` en verde, `/` y `/talento` → 200.
- **Infraestructura de agentes** — `memory-bank/` (negocio + técnico), `AGENTS.md`
  (lectura de sesión + flujo de 8 pasos + lista de "no modificar"), `.agents/rules/`
  (3 reglas con alcance declarado), skill `revision-textos-ui` con verificador
  ejecutable (`check-ui-texts.mjs`, PASS).
- **Estructura** — `packages/domain/` (ex `src/`), `docs/` poblado, raíz limpia.

## Falta

- `git commit` en `feature/agent-memory-bank` + PR a `main` con capturas.
- `README.md` raíz desactualizado (no tocar READMEs de momento).
- Formulario real del banco de talento (`uis/website/talento`).
- Backend propio en `services/`.
- Hitos posteriores (Telemetría, RAG, Agentes, Workflows, Real-time).

## Problemas conocidos

- El `AGENTS.md` de cada app de `uis/` lo regenera `next dev`/`next build`; hay que
  commitearlo tal cual cuando reaparezca en el diff.
- `docs/prompts.txt` y `docs/tareashito2.md` están en `.gitignore` (personales).
