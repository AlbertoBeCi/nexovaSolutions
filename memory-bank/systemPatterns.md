# System patterns

## Organización

- Monorepo por responsabilidad (`uis/`, `services/`, `data/`, `agents/`,
  `packages/`, …). Nada de código suelto en la raíz. Cada app/servicio/agente con
  su `README.md`. Guía completa en `README.md` y `AGENTS.md`.
- Configuración de agentes en `.agents/` (`rules/`, `skills/`) y contexto en
  `memory-bank/`.

## Frontend

- App Router de Next.js. Cada app de `uis/` tiene su propio layout y una vista de
  entrada visible desde el primer commit.
- Capa de servicios (`uis/backoffice/src/services/api.ts`,
  `uis/{application,backoffice}/lib/{suppliers-api,auth-api}.ts`) que
  traduce entre el DTO de la API (snake_case) y el modelo de la UI
  (camelCase) en ambas direcciones. El fetch genérico
  (`apiRequest`/`extractErrorMessage`/`jsonInit`) vive en `lib/api-client.ts`
  en cada app; cada dominio contra **`services/api`** (`suppliers-api.ts`,
  `auth-api.ts`, `uis/backoffice/.../incidents-api.ts` — el del analizador
  de CSV) solo aporta su propio `translateIssue`, porque todos comparten el
  formato de error `{"detail": [...]}` de Pydantic.
  **Excepción**: `uis/application/lib/incidents-api.ts` (el del **gestor**
  de incidencias, contra `services/incident-manager-api`) NO reutiliza
  `apiRequest`/`extractErrorMessage`: ese backend usa un formato de error
  propio, `{"error": {"code","message","fields"?}}` (ver "Backend" más
  abajo), incompatible con el `translateIssue` pensado para Pydantic. Tiene
  su propio fetch de bajo nivel con la misma idea (nunca deja escapar una
  excepción nativa, siempre da un mensaje en español) pero un parseo de
  error distinto. Antes de asumir que un backend nuevo puede reutilizar
  `api-client.ts` tal cual, comprobar qué forma tiene su error.
- **`lib/api-client.ts::apiRequest` es tambien el interceptor de auth**: si
  hay un token guardado lo adjunta como `Authorization` en toda llamada
  (ningún cliente de dominio lo arma a mano), y si una llamada *con* token
  responde 401 (sesión inválida/expirada), limpia el storage y hace
  `window.location.href = "/login"` — navegación dura a propósito, porque
  `apiRequest` corre fuera de un componente/evento de React. Un 401 en una
  llamada *sin* token (ej. login con credenciales malas) no dispara nada
  de esto: se propaga como error normal para el formulario.
- **Auth de frontend duplicado por app, no en `packages/`**: el patrón
  completo (`lib/{api-client,auth-api,auth-storage}.ts`, `types/auth.ts`,
  `app/_components/{require-auth,form-styles}`) vive copiado en
  `uis/application` y `uis/backoffice` — aunque ya hay dos consumidores
  (la condición que normalmente manda extraer a `packages/`, ver más
  abajo), este repo no tiene workspace tooling real (sin
  `pnpm-workspace.yaml` ni `workspaces` en ningún `package.json`), así que
  ningún app puede hoy `import` código de otro. Montar workspaces es una
  tarea de infraestructura aparte.
  `<RequireAuth>` acepta `children` como nodo normal o como función
  `(currentUser) => nodo`, para que una página reuse el usuario que el
  guard ya resolvió (`GET /auth/me`) en vez de repetirlo.
- Diccionarios de etiquetas ES para todo enum de la API; la UI nunca muestra el
  valor crudo. Filtros que se guardan en la URL.
- Estados de carga y error explícitos en cada consumo de API.
- Estado de sesión (token en `localStorage`) se lee con `useSyncExternalStore`
  (`lib/auth-storage.ts::subscribeToken`), no con `useEffect` + `setState`: el
  lint de `eslint-plugin-react-hooks` de este repo bloquea ese patrón
  ("Avoid calling setState() directly within an effect").
- La misma regla de lint aplica a cualquier `useEffect` que quiera resetear
  o marcar estado como "cargando" a mano: en vez de un `setState` directo
  dentro del efecto, **derivar** ese estado comparando una clave de
  petición (`result?.key !== requestKey`, ver `suppliers-directory.tsx` e
  `incidents-panel.tsx`) o, para "resetear X cuando cambia Y", ajustarlo
  durante el render (`if (requestKey !== lastKey) { setLastKey(requestKey);
  setX(inicial); }`, el patrón que React recomienda para "adjusting state
  when a prop changes" — ver `incidents-panel.tsx`, reinicio de página al
  cambiar de filtro).
- Los mensajes de error que arma el backend en Python (`services/api/`) no
  llevan tildes (ver más abajo); si un cliente de `uis/` los muestra tal
  cual, hay que reescribirlos con la ortografía correcta antes de
  mostrarlos al usuario (ver `KNOWN_MESSAGE_FIXES` en cada `auth-api.ts`).

## Backend

Una sola app FastAPI en `services/api/` con un router por dominio
(`routes/incidents.py`, `routes/suppliers.py`), modelos Pydantic en `models.py`
y arranque `uv run uvicorn main:app`. Layout plano (sin paquete `app/`).

- Modelos de entrada y salida separados: `ProviderCreate` (lo que envía el
  cliente) vs `ProviderResponse` (+ `id`, `updated_at` asignados por el sistema).
- Persistencia de proveedores en TinyDB (`database.py`): ruta por env
  `SUPPLIERS_DB_PATH`, tabla como dependencia FastAPI (se sustituye en tests) y
  un lock global porque TinyDB no es thread-safe.
- Usuarios/perfiles (auth) en su propio TinyDB (`users_db.py`,
  `USERS_DB_PATH`), mismo patrón (tabla como dependencia, lock propio) pero
  en un fichero separado de proveedores para no acoplar sus ciclos de vida.
- Autorización centralizada en `security.py` (transversal a varios routers):
  `get_current_user` (login), `get_current_admin` (admin), helper plano
  `ensure_self_or_admin(current_user, target_id)` para "propio recurso o
  admin". Una ruta que solo necesita "estar logueado" usa
  `dependencies=[Depends(get_current_user)]` en el decorador, no un parámetro
  sin usar. Convención documentada en `.agents/rules/services.md`.
- Seeders idempotentes ejecutables con `uv run <script>` (`[project.scripts]`),
  incluye `uv run seed-users` para el admin inicial.
- Mensajes de error de negocio en español (sin tildes, por convención de
  este módulo — igual que los commits); la UI traduce los 422 genéricos de
  Pydantic por `type`/`loc`.
- Patrón para invalidar sesiones sin tabla de tokens revocados: un JWT
  (access o de un solo uso, como el de reset de password) lleva `pwd_fp`
  (huella `sha256` del `hashed_password` vigente al emitirlo). Quien lo
  valida recalcula la huella contra el hash *actual* del usuario; si no
  coincide, el token es inválido. Cualquier cambio de contraseña invalida
  así, de un solo golpe, todos los tokens emitidos antes — ver
  `services/api/security.py`.
- Rate limiting simple (dict + lock en memoria, ventana deslizante) para
  endpoints sensibles a fuerza bruta/abuso sin agregar una dependencia
  nueva — ver `services/api/rate_limit.py`. Limitación conocida: no se
  comparte entre workers/instancias, igual que TinyDB y `store.py`.
- Interfaces compartidas con el frontend → `packages/` cuando haya dos
  consumidores **y** haya workspace tooling que lo haga importable (ver
  nota de "Auth de frontend" arriba: hoy no lo hay, así que dos
  consumidores por ahora significa duplicar, no extraer).
- **Lógica Python compartida entre proyectos `uv` independientes**: SÍ vale
  la pena extraerla a `packages/shared/` (paquete `nexova_shared`) aunque
  no haya workspace tooling, porque el problema que resuelve no es
  "importar entre apps" (npm) sino "no repetir reglas de validación" (ver
  `nexova_shared.incidents_analysis`, usado por `scripts/` y
  `services/api`, y `nexova_shared.incident_validation`, usado por
  `services/incident-manager-api` y `scripts/seed_incidents.py`). Se
  alcanza con `sys.path` (mismo patrón que ya usaba `shared/`), no como
  dependencia `uv`/`pip` instalada — cada proyecto Python en este repo
  sigue siendo independiente (su propio `pyproject.toml`/`.venv`/`uv.lock`).
- **Segundo backend FastAPI** (`services/incident-manager-api/`, excepción
  documentada a "una sola app"): cuando un dominio nuevo tiene un modelo de
  persistencia genuinamente distinto (SQLAlchemy/SQLite con restricciones
  CHECK, frente a TinyDB), puede justificar un servicio propio en vez de un
  router más en `services/api`. Trae su propio formato de error uniforme,
  `{"error": {"code","message","fields"?}}` (`ApiError` + 4
  `exception_handler`s: la excepción propia, `RequestValidationError`,
  `StarletteHTTPException` y `Exception`), distinto del `{"detail": [...]}`
  por defecto de FastAPI que usa `services/api` — un cliente frontend
  contra el backend nuevo necesita su propio parseo de error, no puede
  reutilizar el existente (ver "Frontend" arriba).
- **Restricciones de enum a nivel de BD generadas desde Python, no
  duplicadas a mano**: `services/incident-manager-api/models.py` construye
  sus `CheckConstraint` (`category IN (...)`, etc.) a partir de las mismas
  tuplas de `nexova_shared.incident_constants` que usa la validación de
  aplicación, para que la base de datos y la app nunca puedan permitir
  valores distintos.
- **SQLite y timezone-aware datetimes**: `DateTime(timezone=True)` de
  SQLAlchemy sobre SQLite escribe bien un datetime UTC-aware pero lo
  devuelve *naive* al leerlo (comprobado a mano, no es solo un detalle
  teórico). Si un campo debe ser siempre UTC-aware en Python (para
  serializar con el sufijo `+00:00`), envolver el tipo en un
  `TypeDecorator` que reasigne `tzinfo=UTC` en `process_result_value` (ver
  `UTCDateTime` en `services/incident-manager-api/models.py`) — no basta
  con poner `timezone=True` y confiar en que SQLAlchemy lo preserve.

## Convenciones transversales

- Commits: Conventional Commits en español, imperativo, sin tildes. Sin firmas de
  IA. Ramas `feature/*` → PR a `main`.
- Comprobaciones antes de commit según el área tocada (ver `AGENTS.md` §4).
- Registro de prompts del proyecto en `docs/prompts.md`.
