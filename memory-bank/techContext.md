# Tech context

Monorepo con áreas independientes, cada una con su propio `package.json` y
`node_modules`. Ejecuta los comandos desde la carpeta de cada área.

## Áreas

| Área | Ruta | Stack | Comandos |
| --- | --- | --- | --- |
| Modelo de dominio + utils (Hito 2) | `packages/domain/` | TypeScript, `tsx`, `esbuild` | `npm run typecheck`, `npm run demo`, `npm run build:demo-web` |
| Web pública (Hito 1) | `uis/website/` | Next.js 16.3.2, React 19.2.8, Tailwind v4 | `npm run dev`, `npm run build`, `npm run lint` |
| Backoffice (pipeline de talento, Hito 3) | `uis/backoffice/` | Next.js 16.3.2, React 19.2.8, Tailwind v4 | `npm run dev`, `npm run build`, `npm run lint` |
| Operaciones (directorio de proveedores) | `uis/application/` | Next.js 16.3.2, React 19.2.8, Tailwind v4 (puerto 3001) | `npm run dev`, `npm run build`, `npm run lint` |
| API (incidencias + proveedores) | `services/api/` | Python ≥3.10 (dev 3.14), FastAPI, Pydantic v2, TinyDB, `uv` | `uv sync`, `uv run seed`, `uv run pytest`, `uv run uvicorn main:app --reload --port 8000` |

## Estructura de `uis/`

- `uis/website/` — web pública (Hito 1, migrada de HTML/CSS/JS a Next/React).
  Shell `SiteHeader`/`SiteFooter`, tema claro/oscuro (`data-theme` + localStorage),
  fuentes Fraunces + Public Sans, landing (`/`) y registro de talento en 3 pasos
  (`/talento`, `TalentForm` + `src/lib/talent-validation.ts`).
- `uis/backoffice/` — apps internas. Shell `AppShell` (sidebar/topbar). Antes
  `uis/talent-pipeline-tracker/` (renombrado).
- `uis/application/` — app interna de operaciones, sin `src/` (`app/`, `lib/`,
  `types/` en la raíz de la app). Shell `AppShell` propio, `/suppliers`.
  Login propio (`/login`, `/forgot-password`, `/reset-password`,
  `/account/change-password`): token en `localStorage`
  (`lib/auth-storage.ts`), leído en componentes con `useSyncExternalStore`
  (no `useEffect` + `setState`, que dispara el lint de React sobre efectos).
  `lib/api-client.ts` tiene el fetch genérico (antes vivía duplicado dentro
  de `lib/suppliers-api.ts`), reutilizado por `lib/suppliers-api.ts` y
  `lib/auth-api.ts`.
- Las tres comparten versiones de Next/React/Tailwind y config (tsconfig, eslint,
  postcss).
- Ya **no existe** la landing HTML estática de la raíz: `index.html`,
  `application.html`, `validation.js`, `form-modal.js` eliminados tras la migración.

## Backend

Todo servicio va en `services/` (FastAPI, una app con routers por dominio).
`services/api/` es un proyecto `uv` (`pyproject.toml` + `uv.lock`;
`requirements.txt` sincronizado para pip) con los routers de incidencias,
proveedores y (desde AUTH-01) usuarios/auth/perfiles. Env: `SUPPLIERS_DB_PATH`,
`USERS_DB_PATH`, `CORS_ORIGINS` (por defecto puertos 3000 y 3001),
`SECRET_KEY`/`ALGORITHM`/`ACCESS_TOKEN_EXPIRE_MINUTES` (JWT),
`ADMIN_EMAIL`/`ADMIN_PASSWORD` (bootstrap del admin), todas en
`services/api/.env` (git-ignored via `services/api/.gitignore`; ver
`.env.example`). El pipeline de candidatos del backoffice sigue consumiendo la
API pública de 4Geek Tracker
(`https://playground.4geeks.com/tracker/api/v1`, configurable vía
`NEXT_PUBLIC_API_URL`).

### Autenticación (`services/api`, AUTH-01)

- `User`/`Profile` viven solo en TinyDB (`users_db.py`), en un fichero
  separado del de proveedores (`USERS_DB_PATH`), con su propio lock.
- Hash de contraseñas con `libpass[bcrypt]` (fork drop-in de `passlib`: se
  instala como el paquete `passlib`, así que se importa
  `passlib.context.CryptContext`). JWT con `python-jose`. `.env` cargado con
  `python-dotenv` (`config.py`).
- `security.py`: `get_current_user` (login), `get_current_admin` (admin),
  `ensure_self_or_admin(current_user, target_id)` (propio recurso o admin) —
  ver convención en `.agents/rules/services.md`.
- Protegidas: todo `/users` salvo `POST /users` (registro público, siempre
  `role="user"`), `GET /auth/me`, `/profiles/me`, y 5 rutas ya existentes:
  `POST/PATCH.../DELETE /suppliers*` y `POST /api/incidents/analyze` (las
  lecturas de `suppliers`/`incidents` siguen públicas).
- Bootstrap del primer admin: `uv run seed-users` (idempotente, mismo patrón
  que `uv run seed` de proveedores).
- **Recuperación/cambio de contraseña**: `POST /auth/forgot-password`,
  `POST /auth/reset-password`, `POST /auth/change-password`. Los tokens de
  reset y los access tokens normales comparten el mismo mecanismo `pwd_fp`
  (huella `sha256` del `hashed_password` vigente, ver `security.py`): un
  token —de cualquiera de los dos tipos— deja de validar en cuanto la
  contraseña cambia, sin tabla de revocados. `validate_password_strength`
  (`models.py`) exige 8+/mayúscula/minúscula/número solo en
  reset/change-password (no en `POST /users`). `rate_limit.py`: limitador en
  memoria (dict + lock, sin dependencia nueva) para `forgot-password`/
  `reset-password`. `main.py` llama `logging.basicConfig` — sin eso, el
  `logger("auth")` no imprime nada al correr `uvicorn` (si lo capturan los
  tests).
- **Envío real de email con Resend**: `mailer.py`
  (`send_password_reset_email`), SDK oficial `resend`. Solo envía si
  `RESEND_API_KEY` está en `.env`; si no, o si Resend falla, cae al log por
  consola de siempre (`forgot-password` nunca depende de tener una cuenta
  de email para funcionar en dev). Env vars: `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL` (default `onboarding@resend.dev`), `FRONTEND_URL`
  (default `http://localhost:3001`, para el link del email). Tests: fixture
  `autouse` en `conftest.py` monkeypatchea `routes.auth.send_password_reset_email`
  a `False`, así nunca se dispara un envío real aunque el `.env` local
  tenga la key puesta. El módulo se llama `mailer.py`, no `email.py` (taparía
  el paquete `email` de la stdlib en este layout plano).
- **`uis/application` ya tiene login** (ver arriba, sección `uis/`) pero su
  `lib/suppliers-api.ts` todavía no adjunta el token: `POST/PATCH/DELETE
  /suppliers` siguen devolviendo 401 desde esa UI hasta que se conecte.

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
