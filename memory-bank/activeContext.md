# Active context

_Actualizar al cambiar de foco._

## Ahora — recuperación/cambio de contraseña + login en `uis/application`

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

## Hecho recientemente

- `README.md` / `README.es.md` raíz reescritos: estado real del proyecto (hitos
  1-3), cómo arrancar cada app, árbol actualizado (`AGENTS.md`, `.agents/`,
  `memory-bank/`, `uis/website`, `uis/backoffice`, `packages/domain`), y `.agents/`
  vs `agents/` aclarado. La sección de landing estática (`index.html` / `npx serve`)
  eliminada.
