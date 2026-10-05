# Active context

_Actualizar al cambiar de foco._

## Ahora — baterías de pruebas de backend (pytest) y clientes TS (Jest)

Rama `feature/pruebas-api` (desde `main`). Pruebas de **lógica**, no de
serialización HTTP (sin tests de CORS, cabeceras, JSON mal formado).

- `services/api`: 374 tests (`uv run pytest`); `services/incident-manager-api`:
  217. `pytest-cov` añadido como dependencia de dev (informativo, sin umbral).
  Fixtures nuevas en `services/api/tests/conftest.py`: reinicio de
  `store._last_result`, `anon_client`/`user_client`/`admin_client`.
- Jest nuevo en `uis/application` (143) y `uis/backoffice` (114), sobre los
  clientes HTTP con `fetch` mockeado (`jest.environment.cjs` expone
  `Response`/`Headers` de Node a jsdom). Sin tests de componentes.
- Los tests fijan el comportamiento actual (comentario `# Comportamiento
  actual:`); no se tocó código de producción. Hallazgo anotado: `GET
  /api/incidents/results/export` es público.
- `TESTING.md` en cada carpeta con tablas de qué prueba cada archivo y qué
  significa pasar/fallar.
- El verificador `revision-textos-ui` ahora ignora carpetas `__tests__`.

## Anterior — auditoría de manejo de errores en `uis/backoffice`

Rama actual (partiendo de `main`, con el Gestor de Incidencias Centralizado ya
trabajado en `feature/gestor-incidencias`).

- Objetivo: que la UI nunca muestre errores crudos (textos en inglés, sin
  tildes, o el `TypeError` nativo del navegador). Toda la app queda en español
  y con mensajes legibles.
- **`src/services/api.ts`** (cliente de la API pública de 4Geek Tracker):
  nuevo helper `safeFetch(url, init?)` que envuelve `fetch` y, si la petición
  falla por red (sin conexión, CORS, timeout), lanza un `Error` con mensaje en
  español (`"No se pudo conectar con el servidor. Comprueba tu conexión a
  internet."`) en vez de dejar escapar el `TypeError "Failed to fetch"` nativo.
  Las 8 llamadas del archivo migradas de `fetch(...)` a `safeFetch(...)`. Es
  especialmente relevante aquí porque este cliente llama a una API externa.
- **`src/services/incidents-api.ts`** (cliente de `services/api`):
  `translateIssue` ya no muestra el `msg` crudo de Pydantic (en inglés): ahora
  lo traduce con `FIELD_NAMES` (campo → nombre legible, `file` → "Archivo CSV")
  y `issue.type` (`missing` → "es obligatorio", resto → "Revisa el campo").
  Nuevo `KNOWN_MESSAGE_FIXES` + `polishErrorMessage` que corrigen las tildes de
  los mensajes en texto plano que devuelve la API (`extension` → `extensión`,
  `vacio` → `vacío`, `valido` → `válido`, `esta` → `está`), replicando el patrón
  ya existente en `lib/auth-api.ts`. `withPolishedErrors` envuelve
  `analyzeIncidentsCsv` y `downloadIncidentsResultsCsv` para pulir el mensaje
  sin dejar de propagarlo.
- **Páginas del pipeline de candidatos** (`src/app/page.tsx`,
  `src/app/candidates/[id]/page.tsx`, `src/app/candidates/[id]/edit/page.tsx`):
  el bloque de error de carga pasa de un `<p>` a un `<div role="alert">` con
  botón **"Reintentar"**. Para forzar la recarga se añadió `reloadToken`
  (estado) y, donde el efecto ya comparaba por `id`/clave, un `loadedToken`
  para no mostrar datos obsoletos mientras llega la respuesta nueva.
- `npm run lint` y `npm run build` en verde (10 rutas, typecheck OK).

## Anterior — Gestor de Incidencias Centralizado

Rama: `feature/gestor-incidencias` (partiendo de `main`, con AUTH-01 y el
login/reset de `uis/application`/`uis/backoffice` ya mergeados vía PR #17).

- **Servicio nuevo** `services/incident-manager-api/` (puerto 8001):
  excepción documentada a "una sola app FastAPI" (el ejercicio pedía
  explícitamente un servicio nuevo). FastAPI + SQLAlchemy 2.0 + SQLite
  (`models.py`), sin autenticación propia. Modelo `Incident`: title/
  description NOT NULL con CHECK de no-vacío; category/status/origin/branch
  con CHECK constraint generado desde `nexova_shared.incident_constants`
  (misma fuente de verdad que la validación de aplicación); índices en las
  4 columnas filtrables (incluye `category=sla_breach`). `created_at`/
  `updated_at` UTC de verdad vía un `TypeDecorator` (`UTCDateTime`): SQLite
  devuelve datetimes *naive* al leer un `DateTime(timezone=True)`, aunque
  se haya escrito un valor consciente de zona horaria (comprobado a mano).
  Tabla auxiliar `seed_ticket_ids` para la idempotencia del seed (el
  `ticket_id` nunca se guarda en `Incident`). Sin Alembic: `create_all` al
  arrancar y en el seed.
- **`packages/shared/nexova_shared`** (paquete Python nuevo, junto al TS
  `@repo/shared-types` que ya vivía en `packages/shared/`): constantes/
  etiquetas/transiciones del gestor (`incident_constants.py`), validación
  (`incident_validation.py`: `validate_incident_fields` sin la regla de
  "solo open al crear", que sí aplica `validate_incident` para el POST) y
  mapeo CSV→Incident (`csv_mapping.py`). De paso, se movió aquí
  `shared/incidents_analysis.py` (la lógica del analizador de tickets, que
  ya vivía en la raíz del repo): `shared/incidents_analysis.py` quedó como
  *shim* de compatibilidad que resuelve `packages/shared/` por su cuenta
  (mismo patrón de `sys.path`, ningún consumidor existente cambió). Se
  sumó `csv_row_violations()` (versión fila a fila de
  `apply_validation_rules`, para el seed), con un test de regresión que
  verifica que ambas nunca divergen sobre el CSV real.
- **`scripts/seed_incidents.py`**: carga `scripts/incidents-COMPANY.csv`
  (el prompt original nombraba `incidents-nexova.csv`, que no existe en el
  repo) aplicando las 7 reglas del analizador + el mapeo compartido.
  Idempotente vía `seed_ticket_ids`. Se ejecuta con el venv de
  `incident-manager-api` (`uv run --project services/incident-manager-api
  python scripts/seed_incidents.py`), el único con SQLAlchemy *y* pandas
  (pandas se añadió como dependencia de ese servicio solo por esto).
  Resultado sobre el CSV real: 96 insertadas / 4 descartadas (1ª
  ejecución), 0 insertadas / 96 duplicadas (2ª). Tras el seed,
  `GET /api/incidents/summary` da exactamente lo esperado: status
  open=27/resolved=56/discarded=13, category
  technical_failure=49/process_error=35/client_complaint=12.
- **API** (`routes/incidents.py`, bajo `/api/incidents`): POST, GET con
  filtros, GET `/summary` (declarado antes que `/{id}`), GET `/{id}`, PATCH
  `/status` (valida con `is_valid_transition`). Formato de error uniforme
  nuevo, `{"error": {"code","message","fields"?}}` (`errors.py`), distinto
  del `{"detail": [...]}` de Pydantic que usa `services/api`; un 500 nunca
  filtra el texto de la excepción original. Ver la convención documentada
  en `.agents/rules/services.md`.
- **`uis/application`**: 3 páginas nuevas (`/incidents/new`, `/incidents`,
  `/incidents/summary`) y `types/incident.ts` (espejo TS de
  `incident_constants.py`, añadido a la lista de diccionarios exentos del
  verificador de textos de UI). `lib/incidents-api.ts` es un cliente propio
  (no reutiliza `lib/api-client.ts`: el formato de error no es compatible)
  que nunca muestra el texto del backend, solo `code` y las claves de
  `fields`. Listado con filtros en URL, paginación de 25, y cambio de
  estado optimista (revierte si el PATCH falla). Tuvo que ajustarse al
  patrón de "derivar el loading comparando una clave de petición" en vez de
  `setState` dentro de un efecto (mismo lint que ya limitaba
  `uis/application`/`uis/backoffice`). Probado en navegador real con
  Playwright (headless, temporal). `npm run lint`/`build` y el verificador
  de textos de UI en verde.

## Anterior — auth de frontend: register/profile + interceptor + `uis/backoffice`

Rama: `feature/auth-frontend` (partiendo de `feature/password-reset`, con
forgot/reset/change-password + Resend ya hechos ahí).

- **Interceptor centralizado** (`lib/api-client.ts::apiRequest`, en las dos
  apps): adjunta el token guardado automáticamente en toda llamada — ya no
  hace falta pasarlo a mano por función (resuelve de paso el pendiente de
  `lib/suppliers-api.ts` sin token, documentado en la tarea anterior). Si
  una llamada *que llevaba* token responde 401, limpia el storage y hace
  `window.location.href = "/login"` (navegación dura a propósito: corre
  fuera de un componente/evento de React). Un 401 en una llamada *sin*
  token (login con credenciales malas) no dispara nada de esto.
- **`uis/application`**: `/register` (un solo formulario, `POST /users` con
  `profile` embebido si se llena `name` → `POST /auth/login` automático) y
  `/account/profile` (`GET /auth/me` + `PUT /profiles/me`, upsert). `Mi
  cuenta` en el nav ahora apunta a `/account/profile` (antes iba directo a
  change-password). `<RequireAuth>` ahora acepta `children` como funcion
  `(currentUser) => nodo`, para que `/account/profile` reuse el usuario que
  el guard ya resolvió en vez de repetir `GET /auth/me`.
- **`uis/backoffice`** (nuevo, antes sin auth): duplicado completo del
  cliente de auth (`lib/{api-client,auth-api,auth-storage}.ts`,
  `types/auth.ts`, `_components/{require-auth,form-styles}`) más
  `/login`, `/register`, `/account/profile`, `/account/change-password`.
  **Sin duplicar `/forgot-password`/`/reset-password`**: el email de reset
  de `services/api` apunta a un único `FRONTEND_URL` (hoy `uis/application`),
  así que `/login` de backoffice enlaza ahí de forma cruzada
  (`NEXT_PUBLIC_APPLICATION_URL`, nueva env var) en vez de duplicar el
  flujo. No hay workspace tooling real en el repo (ni `pnpm-workspace.yaml`
  ni `workspaces` en ningún `package.json`, confirmado explorando) — por
  eso se duplica el cliente por app en vez de extraerlo a `packages/`.
- **Regresión real encontrada y arreglada**: `uis/backoffice/incidencias`
  llama a `POST /api/incidents/analyze`, protegida desde AUTH-01 — como
  backoffice nunca tuvo login, esa página daba 401 silencioso desde
  entonces. `services/incidents-api.ts` se migró a `lib/api-client.ts` (ya
  no arma su propio `fetch`) y la página quedó envuelta en `<RequireAuth>`.
- Verificado end-to-end con Playwright (headless, instalado temporalmente,
  no quedó como dependencia) en ambas apps a la vez: registro con perfil,
  perfil precargado sin llamada duplicada, editar perfil, crear un
  proveedor logueado (confirma el interceptor), cambiar contraseña, logout,
  login con la contraseña nueva, `/account/profile` sin sesión redirige;
  en backoffice: `/incidencias` sin sesión redirige, registro, y analizar
  un CSV logueado funciona (confirma el fix de la regresión). Cero errores
  de consola en ambas.

## Anterior — recuperación/cambio de contraseña + login en `uis/application`

Rama: `feature/password-reset` (partiendo de `main`, con AUTH-01 ya
mergeado).

- `services/api/routes/auth.py`: 3 endpoints nuevos —
  `POST /auth/forgot-password`, `POST /auth/reset-password`,
  `POST /auth/change-password` (autenticado). Reset con JWT stateless
  (`type="password_reset"`) que lleva `pwd_fp` (huella del hash vigente al
  emitirlo): tanto los tokens de reset como los **access token** normales
  ahora incluyen `pwd_fp` y `get_current_user` lo valida, así que cualquier
  cambio de contraseña invalida de inmediato todas las sesiones anteriores
  sin necesitar una tabla de tokens revocados. `create_access_token` cambió
  de firma (`subject, hashed_password, expires_delta=None`).
- Política de contraseña nueva (`validate_password_strength` en
  `models.py`, vía `Annotated[str, AfterValidator(...)]`): 8+ caracteres,
  mayúscula, minúscula, número. Solo aplica a reset/change-password, **no**
  a `POST /users` (se queda en `min_length=8` para no romper AUTH-01).
  `rate_limit.py` (nuevo): limitador en memoria simple, 5 intentos/15min
  por IP en `forgot-password` y `reset-password`.
  `main.py` ahora llama `logging.basicConfig` (si no, el logger `auth` no
  imprime nada al correr `uvicorn`, aunque sí lo capturan los tests).
  `uv run pytest` → 79 tests en verde (55 de antes + 24 nuevos en
  `tests/test_password_reset.py`).
- `uis/application`: primera integración de auth en un frontend.
  `lib/auth-api.ts` + `lib/auth-storage.ts` (token en `localStorage`,
  `useSyncExternalStore` para que `nav-links.tsx` refleje la sesión sin
  leer `localStorage` en un efecto) + páginas `/login`, `/forgot-password`,
  `/reset-password`, `/account/change-password` (esta última envuelta en
  `<RequireAuth>`). Se extrajo `lib/api-client.ts` desde
  `lib/suppliers-api.ts` (fetch genérico + traducción de errores) para no
  duplicarlo entre proveedores y auth.
  **Sigue pendiente:** `lib/suppliers-api.ts` todavía no adjunta el token,
  así que las mutaciones de `/suppliers` seguirán devolviendo 401 aunque el
  usuario esté logueado.
- Verificado en navegador real con Playwright (headless, instalado
  temporalmente con `npm install --no-save playwright`, no quedó como
  dependencia): login con credenciales inválidas, forgot→reset→login con la
  contraseña nueva, nav reflejando la sesión, change-password invalidando
  el token viejo, y `/account/change-password` redirigiendo a `/login` sin
  sesión. Sin errores de consola salvo los 401 esperados de los intentos
  fallidos/no autenticados.
- **Envío real por email (Resend)**: `mailer.py` nuevo —
  `send_password_reset_email(to_email, reset_link)`, usando el SDK oficial
  `resend`. Solo envía si `RESEND_API_KEY` está en `.env` (el desarrollador
  ya tiene una cuenta y la configuró); sin la key, o si Resend falla,
  `forgot-password` cae al log por consola de siempre — así el flujo sigue
  siendo probable en un checkout nuevo sin cuenta de ningún proveedor.
  Nuevas env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default
  `onboarding@resend.dev`, el remitente de pruebas de Resend — solo entrega
  al email dueño de la cuenta hasta verificar un dominio propio ahí) y
  `FRONTEND_URL` (default `http://localhost:3001`, para construir el link
  `/reset-password?token=...` del email). Los tests nunca disparan un envío
  real: `tests/conftest.py` tiene una fixture `autouse` que monkeypatchea
  `routes.auth.send_password_reset_email` a `False`, sin importar lo que
  tenga el `.env` local. **Importante:** el módulo se llama `mailer.py`, no
  `email.py` — ese nombre taparía el paquete `email` de la stdlib en este
  layout plano.

## Anterior — autenticación y protección de rutas (AUTH-01)

Mergeado a `main` (PR #16). Rama original: `feature/auth-api` (partiendo de
`feature/suppliers-api`).

- `services/api/`: nuevos módulos `config.py` (carga `.env`), `users_db.py`
  (TinyDB propio de `users`/`profiles`, `USERS_DB_PATH`), `security.py`
  (hash bcrypt vía `libpass`, JWT vía `python-jose`, `get_current_user`,
  `get_current_admin`, `ensure_self_or_admin`), `seed_users.py` (bootstrap
  idempotente del admin, `uv run seed-users`).
- Nuevos routers: `/users` (CRUD, `POST /users` público y siempre
  `role="user"`), `/auth` (`POST /auth/login`, `GET /auth/me`), `/profiles`
  (`GET`/`PUT /profiles/me`, upsert).
- Protegidas con `get_current_user` 5 rutas ya existentes:
  `POST/PATCH.../DELETE /suppliers*` y `POST /api/incidents/analyze`; las
  lecturas siguen públicas. CORS ahora incluye `PUT`.
- `.env`/`.env.example`/`.gitignore` nuevos en `services/api/` (no se tocó el
  `.gitignore` raíz).
- Tests nuevos (`tests/conftest.py`, `test_auth.py`, `test_users.py`,
  `test_profiles.py`, `test_protected_routes.py`); `test_suppliers.py`
  ajustado para autenticar su `client`. `uv run pytest` → 55 tests en verde.
- **Pendiente explícito:** `uis/application` no se tocó en esta tarea — sus
  llamadas a `/suppliers` (alta, tarifa, activar/suspender, eliminar)
  devolverán 401 sin login hasta una tarea de frontend que añada
  autenticación (login + envío de `Authorization: Bearer`).

## Anterior — directorio de proveedores (`/suppliers`)

Rama: `feature/suppliers-api` (parte de `feature/incidents-analysis-script`).

- `services/api/` reorganizado a layout plano: `main.py`, `models.py`,
  `database.py`, `routes/{incidents,suppliers}.py`, `seed.py`; proyecto `uv`
  (`uv run seed`, `uv run pytest`). Se disolvió `services/api/app/`; las rutas de
  incidencias no cambian.
- `/suppliers`: POST (201), GET con filtros `country`/`category`, GET por id,
  PATCH `rate` y `status` (refrescan `updated_at`), DELETE (204). TinyDB en
  `services/api/data/` (ignorado por git).
- Nueva app `uis/application/` (puerto 3001) con `/suppliers`: listado, filtros
  en URL, alta, edición de tarifa, activar/suspender, eliminar.

## Anterior — Hito: infraestructura de agentes + estructura de aplicación

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
- Backend: `services/api/` (FastAPI) con incidencias y proveedores.

### Reorganización previa (conforme a los README de carpeta)

- `src/` (raíz) → `packages/domain/` (`@repo/domain`, Hito 2). `typecheck`/`demo` verde.
- `CONTEXT-nexova-briefing.md` → `docs/context/`. `company-choice.md`,
  `prompts.md`, `prompts.txt` → `docs/`. Borrado `index.html.bak`.
- Raíz: `CONTEXT.md`, `README*`, `AGENTS.md`, `.gitignore`.

## Pendiente

- Decidir si `uis/application` absorbe más módulos o se fusiona con el backoffice.
- Persistencia multi-proceso para proveedores si se despliega la API.
- `services/incident-manager-api` no tiene autenticación (el ejercicio no la
  pedía): `/incidents/*` en `uis/application` queda accesible sin login, a
  diferencia de `/suppliers` (protegido en escritura). Si el gestor de
  incidencias pasa a producción, revisar si necesita el mismo sistema de
  auth que `services/api`.

## Hecho recientemente

- `README.md` / `README.es.md` raíz reescritos: estado real del proyecto (hitos
  1-3), cómo arrancar cada app, árbol actualizado (`AGENTS.md`, `.agents/`,
  `memory-bank/`, `uis/website`, `uis/backoffice`, `packages/domain`), y `.agents/`
  vs `agents/` aclarado. La sección de landing estática (`index.html` / `npx serve`)
  eliminada.
