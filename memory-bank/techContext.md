# Tech context

Monorepo con áreas independientes, cada una con su propio `package.json` y
`node_modules`. Ejecuta los comandos desde la carpeta de cada área.

## Áreas

| Área | Ruta | Stack | Comandos |
| --- | --- | --- | --- |
| Modelo de dominio + utils (Hito 2) | `packages/domain/` | TypeScript, `tsx`, `esbuild` | `npm run typecheck`, `npm run demo`, `npm run build:demo-web` |
| Web pública (Hito 1) | `uis/website/` | Next.js 16.3.2, React 19.2.8, Tailwind v4 | `npm run dev`, `npm run build`, `npm run lint` |
| Backoffice (pipeline de talento, Hito 3) | `uis/backoffice/` | Next.js 16.3.2, React 19.2.8, Tailwind v4 | `npm run dev`, `npm run build`, `npm run lint` |

## Estructura de `uis/`

- `uis/website/` — web pública (Hito 1, migrada de HTML/CSS/JS a Next/React).
  Shell `SiteHeader`/`SiteFooter`, tema claro/oscuro (`data-theme` + localStorage),
  fuentes Fraunces + Public Sans, landing (`/`) y registro de talento en 3 pasos
  (`/talento`, `TalentForm` + `src/lib/talent-validation.ts`).
- `uis/backoffice/` — apps internas. Shell `AppShell` (sidebar/topbar). Antes
  `uis/talent-pipeline-tracker/` (renombrado).
- Las dos comparten versiones de Next/React/Tailwind y config (tsconfig, eslint,
  postcss) copiada.
- Ya **no existe** la landing HTML estática de la raíz: `index.html`,
  `application.html`, `validation.js`, `form-modal.js` eliminados tras la migración.

## Backend

Todo servicio va en `services/` (FastAPI, una app con routers por dominio). Aún no
existe: el Hito 3 consume la API pública de 4Geek Tracker
(`https://playground.4geeks.com/tracker/api/v1`, configurable vía
`NEXT_PUBLIC_API_URL`).

## Despliegue

Netlify, sitio `nexovasol`, conectado al repo (deploy en cada PR y en `main`).
`netlify.toml` en la raíz publica **solo `uis/website`**: `base = "uis/website"`,
`command = "npm run build"`, `publish = "out"`, Node 20. La web es un **export
estático** de Next (`output: "export"` + `images.unoptimized`), así que se sirve
sin runtime y sin el plugin de Next (que además no soporta Next 16). El backoffice
no se despliega (app interna). Antes de `netlify.toml` el sitio servía el
`index.html` estático de la raíz; al eliminarlo quedó en 404 hasta añadir esta
config. Si la web necesitara SSR en el futuro, habría que cambiar a un adaptador
de Netlify para Next.

## Restricciones

- Next.js del repo trae breaking changes: consultar `node_modules/next/dist/docs/`
  antes de escribir código de Next. El `AGENTS.md` de esa carpeta lo regenera
  `next dev`.
- `.env*.local` y `.claude/` están en `.gitignore`.
- Dos modelos de "Candidate" distintos y deliberados: dominio de negocio
  (`packages/domain/src/types/models.ts`) vs DTO de la API
  (`uis/backoffice/src/types/candidate.ts`).
- Warning de Next al construir: detecta varios `package-lock.json` y toma la raíz
  del repo como workspace root. No rompe el build; se puede fijar con
  `turbopack.root` en cada `next.config.ts` si molesta.
