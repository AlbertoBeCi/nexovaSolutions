# Tech context

Monorepo con áreas independientes, cada una con su propio `package.json` y
`node_modules`. Ejecuta los comandos desde la carpeta de cada área.

## Áreas

| Área | Ruta | Stack | Comandos |
| --- | --- | --- | --- |
| Modelo de dominio + utils (Hito 2) | `packages/domain/` | TypeScript, `tsx`, `esbuild` | `npm run typecheck`, `npm run demo`, `npm run build:demo-web` |
| Web pública (Hito 1) | `uis/website/` | Next.js 16.3.2, React 19.2.8, Tailwind v4 | `npm run dev`, `npm run build`, `npm run lint` |
| Backoffice (pipeline de talento, Hito 3) | `uis/backoffice/` | Next.js 16.3.2, React 19.2.8, Tailwind v4 | `npm run dev`, `npm run build`, `npm run lint` |
| Operaciones (proveedores + gestor de incidencias) | `uis/application/` | Next.js 16.3.2, React 19.2.8, Tailwind v4 (puerto 3001) | `npm run dev`, `npm run build`, `npm run lint` |
| API (incidencias — análisis CSV — + proveedores) | `services/api/` | Python ≥3.10 (dev 3.14), FastAPI, Pydantic v2, TinyDB, `uv` | `uv sync`, `uv run seed`, `uv run pytest`, `uv run uvicorn main:app --reload --port 8000` |
| API gestor de incidencias (persistente) | `services/incident-manager-api/` | Python ≥3.10, FastAPI, SQLAlchemy 2.0, SQLite, `uv` | `uv sync`, `uv run --project services/incident-manager-api python scripts/seed_incidents.py`, `uv run pytest`, `uv run serve` (puerto 8001) |
| Lógica Python compartida | `packages/shared/` (`nexova_shared`) | Python ≥3.10, pandas, `uv` | `uv sync`, `uv run pytest` |

## Estructura de `uis/`

- `uis/website/` — web pública (Hito 1, migrada de HTML/CSS/JS a Next/React).
  Shell `SiteHeader`/`SiteFooter`, tema claro/oscuro (`data-theme` + localStorage),
  fuentes Fraunces + Public Sans, landing (`/`) y registro de talento en 3 pasos
  (`/talento`, `TalentForm` + `src/lib/talent-validation.ts`).
- `uis/backoffice/` — apps internas. Shell `AppShell` (sidebar/topbar). Antes
  `uis/talent-pipeline-tracker/` (renombrado). Ahora tambien tiene login
  propio (`/login`, `/register`, `/account/profile`,
  `/account/change-password`, sin forgot/reset-password — ver mas abajo),
  `<RequireAuth>` envuelve `/incidencias` porque `POST /api/incidents/analyze`
  exige login desde AUTH-01.
- `uis/application/` — app interna de operaciones, sin `src/` (`app/`, `lib/`,
  `types/` en la raíz de la app). Shell `AppShell` propio, `/suppliers`.
  Login propio: `/login`, `/register`, `/forgot-password`, `/reset-password`,
  `/account/profile`, `/account/change-password`. Gestor de incidencias
  (sin login, ver "Backend" mas abajo): `/incidents/new`, `/incidents`,
  `/incidents/summary`, con su propio cliente HTTP
  (`lib/incidents-api.ts`) contra `services/incident-manager-api` (puerto
  8001) — no reutiliza `lib/api-client.ts` porque ese backend usa un
  formato de error distinto (`{"error": {"code","message","fields"}}`, no
  el `{"detail": [...]}` de Pydantic).
- **Auth de frontend (patron compartido por `uis/application` y
  `uis/backoffice`, duplicado en cada una — no hay workspace tooling real en
  el repo, ver "Restricciones")**: token en `localStorage`
  (`lib/auth-storage.ts`), leído con `useSyncExternalStore` (no `useEffect` +
  `setState`, que dispara el lint de React sobre efectos).
  `lib/api-client.ts::apiRequest` adjunta el token guardado automaticamente
  en toda llamada (ningun cliente de dominio lo arma a mano) y, si una
  llamada *con* token responde 401, limpia el storage y hace
  `window.location.href = "/login"` (interceptor global; un 401 *sin* token,
  como login con credenciales malas, no dispara nada de esto).
  `<RequireAuth>` (`app/_components/require-auth.tsx`) acepta `children`
  como nodo normal o como funcion `(currentUser) => nodo`, para que una
  pagina como `/account/profile` reuse el usuario que el guard ya resolvio
  en vez de repetir `GET /auth/me`.
  Solo `uis/application` tiene `/forgot-password`/`/reset-password`: el
  email de reset de `services/api` apunta a un unico `FRONTEND_URL`, asi
  que `uis/backoffice` enlaza ahi de forma cruzada
  (`NEXT_PUBLIC_APPLICATION_URL`) en vez de duplicar el flujo.
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
- **`uis/application` y `uis/backoffice` ya tienen login** (ver arriba,
  sección `uis/`), con un interceptor que adjunta el token automaticamente
  en toda llamada — ya no hay un pendiente de "conectar el token" en
  ninguna de las dos.

### Gestor de incidencias (`services/incident-manager-api/`)

Segundo servicio FastAPI, independiente de `services/api` (excepcion
documentada a "una sola app FastAPI": ver `.agents/rules/services.md` y el
`README.md` del servicio). Sin autenticacion propia.

- Persistencia con **SQLAlchemy 2.0 + SQLite** (no TinyDB): modelo
  `Incident` con CHECK constraints por columna enum (category/status/
  origin/branch), generados desde `nexova_shared.incident_constants` para
  que la BD y la app nunca diverjan; indices en las 4 columnas filtrables.
  Sin Alembic: `db.init_db()` (`create_all`) al arrancar y antes del seed.
- `created_at`/`updated_at` usan un `TypeDecorator` propio (`UTCDateTime`
  en `models.py`): SQLite devuelve un `datetime` *naive* al leer un
  `DateTime(timezone=True)`, aunque se haya escrito un valor UTC-aware
  (comprobado a mano) — este tipo exige tz-aware al escribir y reasigna
  `tzinfo=UTC` al leer.
- Alcanza `packages/shared/nexova_shared` con el mismo patron de
  `sys.path` que el resto del repo (`shared_bootstrap.py`), no como
  dependencia `uv` instalada entre proyectos.
- Formato de error propio, uniforme en toda la API:
  `{"error": {"code","message","fields"?}}` (`errors.py`), con un 500
  generico que nunca filtra el texto de la excepcion original.
- `scripts/seed_incidents.py` (raiz del repo, no dentro del servicio) carga
  `scripts/incidents-COMPANY.csv` reutilizando `nexova_shared.
  incidents_analysis.csv_row_violations` (las 7 reglas del analizador) y
  `nexova_shared.csv_mapping` (CSV -> Incident). Necesita el venv de este
  servicio (`uv run --project services/incident-manager-api python
  scripts/seed_incidents.py`): es el unico con SQLAlchemy *y* pandas (pandas
  se agrego a este servicio solo por esta dependencia transitiva).

### Logica Python compartida (`packages/shared/nexova_shared`)

Paquete `uv` propio (junto al TS `@repo/shared-types` que ya vivia en
`packages/shared/`), alcanzado por sus consumidores via `sys.path` (no
instalado como dependencia `uv`/`pip`): `incidents_analysis.py` (logica del
analizador, movida aqui desde `shared/`, que ahora es un shim de
compatibilidad), `incident_constants.py`, `incident_validation.py` y
`csv_mapping.py` (dominio del gestor de incidencias). Es la unica fuente de
verdad de esa validacion para `scripts/` y `services/*`.

## Restricciones

- **No hay workspace tooling real** (confirmado explorando: sin
  `package.json` en la raíz, sin `pnpm-workspace.yaml`, sin `workspaces` en
  ningún `package.json`). El lado **TypeScript** de `packages/domain` y
  `packages/shared` (`@repo/shared-types`) sigue sin que ningún app lo
  importe — cualquier código "compartido" entre apps de `uis/` se duplica
  por app (mismo patrón que ya usaban los clientes HTTP). El lado
  **Python** de `packages/shared` (`nexova_shared`) sí lo usan `scripts/` y
  `services/*`, pero via `sys.path` (mismo patrón que ya usaba `shared/`),
  no via un mecanismo de dependencias `uv`/`pip` entre proyectos — cada
  proyecto Python sigue siendo independiente (su propio `pyproject.toml`,
  `.venv`, `uv.lock`). Montar workspaces de verdad (TS o Python) es una
  tarea de infraestructura aparte, no algo que colar de paso en una tarea
  de producto.
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
