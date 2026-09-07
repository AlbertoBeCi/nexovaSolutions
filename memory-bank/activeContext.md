# Active context

_Actualizar al cambiar de foco._

## Ahora — Hito: infraestructura de agentes + estructura de aplicación

Rama de entrega: `feature/agent-memory-bank` (PR → `main` del fork).

### Infraestructura de agentes

- `memory-bank/` en la raíz con contexto de negocio **y** técnico:
  `projectbrief.md`, `productContext.md` (negocio); `techContext.md`,
  `systemPatterns.md` (técnico); `activeContext.md`, `progress.md` (estado).
- `AGENTS.md` (raíz): qué leer al inicio de sesión (§1), flujo de 8 pasos antes de
  commit (§4), y qué NO modificar sin confirmación (§7).
- `.agents/rules/`: `idioma-y-dominio.md` (`always`), `uis.md` (`uis/**`),
  `services.md` (`services/**`). Cada regla declara alcance en frontmatter.
- `.agents/skills/revision-textos-ui/`: skill con objetivo único, inputs y 6
  criterios de aceptación; verificador `scripts/check-ui-texts.mjs` (exit 0/1).

### Estructura de aplicación (`uis/`)

- `uis/website/` (Next.js 16): `/` = landing corporativa alineada con `CONTEXT.md`
  (hero, servicios, por qué Nexova, CTA), componentes `SiteHeader`/`SiteFooter`,
  JSON-LD Organization, `/talento` stub. `npm run dev` y `build` en verde, `/` 200.
- `uis/backoffice/` (Next.js 16, antes `talent-pipeline-tracker/`): layout propio
  `AppShell` (sidebar/topbar), `/` = pipeline de candidatos con datos de la API en
  español (estados/etapas traducidos). `npm run dev` y `build` en verde, `/` 200.
- Backend: nada en `services/` todavía; regla documentada.

### Reorganización previa (conforme a los README de carpeta)

- `src/` (raíz) → `packages/domain/` (`@repo/domain`, Hito 2). `typecheck`/`demo` verde.
- `CONTEXT-nexova-briefing.md` → `docs/context/`. `company-choice.md`,
  `prompts.md`, `prompts.txt` → `docs/`. Borrado `index.html.bak`.
- Raíz limpia: `CONTEXT.md`, `README*`, `AGENTS.md`, `.gitignore`, landing Hito 1.

## Pendiente

- **No commiteado.** Falta: `git commit` en `feature/agent-memory-bank`, PR a
  `main` con capturas de `website` y `backoffice` + enlace a `AGENTS.md`.
- `README.md` raíz quedó desactualizado (árbol, "Current status", `apps/` vs
  `uis/`). No tocar READMEs de momento — actualizar cuando se autorice.
- Formulario real del banco de talento en `uis/website/talento`.
- Decidir si el backend propio en `services/` entra ya.

## Decisiones abiertas

- ¿Migrar la landing estática de la raíz (`index.html`) dentro de `uis/website/`?
