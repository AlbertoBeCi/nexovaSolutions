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
- **`services/api/`** — backend FastAPI único (proyecto `uv`): router de
  incidencias (`/api/incidents`, análisis de CSV) y router de proveedores
  (`/suppliers`, CRUD sobre TinyDB con `ProviderCreate`/`ProviderResponse`).
  `uv run seed` idempotente; `uv run pytest` → 27 tests en verde (incluye rechazo de `updated_at`/`id` con 422).
- **`uis/application/`** — app interna de operaciones (Next.js 16, puerto 3001):
  `/suppliers` con listado, filtros en URL, alta, edición rápida de tarifa,
  activar/suspender y eliminar. `lint`/`build` en verde, probado en navegador.
- **AUTH-01** — Autenticación en `services/api/`: registro (`POST /users`),
  login JWT (`POST /auth/login`), `GET /auth/me`, `/profiles/me`
  (`GET`/`PUT`, upsert), CRUD `/users/{id}` con permisos propio-o-admin.
  Hash bcrypt con `libpass`, JWT con `python-jose`, TinyDB propio para
  users/profiles. 5 rutas existentes de `/suppliers`/`/api/incidents`
  protegidas con login. Bootstrap del admin con `uv run seed-users`
  (idempotente). Mergeado a `main` (PR #16).
- **Recuperación/cambio de contraseña** — `POST /auth/forgot-password`,
  `POST /auth/reset-password`, `POST /auth/change-password` en
  `services/api/`. Tokens de reset y access tokens comparten el mecanismo
  `pwd_fp` (huella del hash de password): cualquier cambio de contraseña
  invalida de inmediato todas las sesiones anteriores, sin tabla de
  revocados. Política de contraseña (8+, mayúscula, minúscula, número) solo
  en reset/change, no en el registro. Rate limiting en memoria (5/15min por
  IP) en `forgot-password`/`reset-password`. Envío real de email con
  [Resend](https://resend.com) (`mailer.py`, opcional vía `RESEND_API_KEY`;
  sin ella cae al log por consola de siempre). `uv run pytest` → 79 tests en
  verde (55 anteriores + 24 nuevos; los tests nunca disparan un envío real,
  aunque el `.env` local tenga la key).
- **Login en `uis/application` y `uis/backoffice`** — auth de frontend en
  las dos apps que consumen `services/api`: `/login`, `/register`,
  `/account/profile`, `/account/change-password` en ambas;
  `/forgot-password`/`/reset-password` solo en `uis/application` (el email
  de reset apunta a un único `FRONTEND_URL`; backoffice enlaza ahí de forma
  cruzada). Token en `localStorage` con `useSyncExternalStore`. Interceptor
  centralizado (`lib/api-client.ts::apiRequest`) adjunta el token en toda
  llamada y redirige a `/login` en un 401 autenticado — así quedó resuelto,
  de paso, el pendiente de `lib/suppliers-api.ts` sin token. Arregla
  además una regresión real: `uis/backoffice/incidencias` llamaba a
  `POST /api/incidents/analyze` (protegida desde AUTH-01) sin ningún login,
  así que daba 401 silencioso desde entonces. `lint`/`build` en verde en
  ambas apps, probado en navegador real con Playwright (headless, sin
  quedar como dependencia del proyecto) cubriendo las dos apps a la vez.

- **Gestor de Incidencias Centralizado** — servicio nuevo
  `services/incident-manager-api/` (FastAPI + SQLAlchemy/SQLite, puerto
  8001, sin auth propia): modelo `Incident` con CHECK constraints (mismos
  valores que `nexova_shared.incident_constants`), índices en
  status/origin/branch/category, timestamps UTC reales vía un
  `TypeDecorator` propio. `packages/shared/nexova_shared` (paquete Python
  nuevo): constantes/validación/mapeo CSV del gestor, más
  `shared/incidents_analysis.py` (lógica del analizador) movida aquí con
  un shim de compatibilidad. `scripts/seed_incidents.py` carga
  `scripts/incidents-COMPANY.csv` reutilizando las 7 reglas del analizador;
  idempotente, 96 insertadas / 4 descartadas sobre el CSV real, conteos de
  `GET /api/incidents/summary` verificados contra lo esperado. API bajo
  `/api/incidents` (POST, GET con filtros, `/summary`, `/{id}`, PATCH
  `/status` con validación de transiciones) con un formato de error
  uniforme nuevo (`{"error": {...}}`). `uis/application`: 3 páginas
  (`/incidents/new`, `/incidents`, `/incidents/summary`) con su propio
  cliente HTTP (`lib/incidents-api.ts`, formato de error incompatible con
  `lib/api-client.ts`), listado con filtros/paginación/cambio de estado
  optimista, `types/incident.ts` como espejo TS del dominio. `uv run
  pytest` → 63 tests en `packages/shared`, 43 en
  `services/incident-manager-api`; `npm run lint`/`build` y el verificador
  de textos de UI en verde; probado en navegador real con Playwright.

- **Auditoría de manejo de errores en `uis/backoffice`** — la UI ya no
  muestra errores crudos: `services/api.ts` envuelve `fetch` en un `safeFetch`
  que traduce los fallos de red ("Failed to fetch") a un mensaje en español;
  `services/incidents-api.ts` traduce los errores de validación de Pydantic
  (con `FIELD_NAMES` + `issue.type`) y corrige las tildes de los mensajes en
  texto plano de la API (`KNOWN_MESSAGE_FIXES` + `polishErrorMessage`, mismo
  patrón que `lib/auth-api.ts`); las tres páginas del pipeline de candidatos
  (`/`, `candidates/[id]`, `candidates/[id]/edit`) cambian el bloque de error
  de carga por un `<div role="alert">` con botón **"Reintentar"**
  (`reloadToken`/`loadedToken`). `npm run lint`/`build` en verde.

## Falta

- Persistencia real (TinyDB es de un solo proceso) si `services/api` se despliega con varios workers.
- `services/incident-manager-api` no tiene autenticación (el ejercicio no la
  pedía); si pasa a producción, evaluar si necesita el mismo sistema de auth
  que `services/api`. Tampoco tiene Alembic/migraciones formales (una sola
  tabla de negocio; `create_all` alcanza por ahora).
- `uis/website` (Hito 1, público) no tiene login ni debe tenerlo.
- No hay workspace tooling real en el monorepo (confirmado explorando): el
  cliente de auth de frontend está duplicado entre `uis/application` y
  `uis/backoffice` en vez de vivir en `packages/`. Montarlo es una tarea de
  infraestructura aparte.
- JWT sin revocación explícita de un token individual (solo hay
  invalidación global por cambio de contraseña vía `pwd_fp`); no hay
  "cerrar todas las demás sesiones" selectivo.
- Hitos posteriores (Telemetría, RAG, Agentes, Workflows, Real-time).

## Problemas conocidos

- El `AGENTS.md` de cada app de `uis/` lo regenera `next dev`/`next build`; hay que
  commitearlo tal cual cuando reaparezca en el diff.
- `docs/prompts.txt` y `docs/tareashito2.md` están en `.gitignore` (personales).
