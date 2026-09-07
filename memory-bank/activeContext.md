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

- `uis/website/` (Next.js 16): **Hito 1 migrado de HTML/CSS/JS a Next/React.**
  `/` = landing editorial (hero + ficha de candidato, servicios, por qué Nexova),
  `/talento` = registro en 3 pasos (`TalentForm`) con validación
  (`src/lib/talent-validation.ts`, mensajes literales de `CONTEXT.md`), mensaje de
  éxito y aviso B2B. Tema claro/oscuro (`data-theme` + localStorage), fuentes
  Fraunces + Public Sans, JSON-LD Organization. `dev`/`build`/`lint` verde, `/` y
  `/talento` 200, sin issues del overlay.
- `uis/backoffice/` (Next.js 16, antes `talent-pipeline-tracker/`): layout propio
  `AppShell` (sidebar/topbar), `/` = pipeline de candidatos con datos de la API en
  español (estados/etapas traducidos). `npm run dev` y `build` en verde, `/` 200.
- Ya **no existen** `index.html`, `application.html`, `validation.js`,
  `form-modal.js` en la raíz (eliminados tras la migración).
- Backend: nada en `services/` todavía; regla documentada.

### Reorganización previa (conforme a los README de carpeta)

- `src/` (raíz) → `packages/domain/` (`@repo/domain`, Hito 2). `typecheck`/`demo` verde.
- `CONTEXT-nexova-briefing.md` → `docs/context/`. `company-choice.md`,
  `prompts.md`, `prompts.txt` → `docs/`. Borrado `index.html.bak`.
- Raíz: `CONTEXT.md`, `README*`, `AGENTS.md`, `.gitignore`.

## Pendiente

- Decidir si el backend propio en `services/` entra ya.

## Hecho recientemente

- `README.md` / `README.es.md` raíz reescritos: estado real del proyecto (hitos
  1-3), cómo arrancar cada app, árbol actualizado (`AGENTS.md`, `.agents/`,
  `memory-bank/`, `uis/website`, `uis/backoffice`, `packages/domain`), y `.agents/`
  vs `agents/` aclarado. La sección de landing estática (`index.html` / `npx serve`)
  eliminada.
