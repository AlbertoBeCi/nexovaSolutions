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
- Capa de servicios (`uis/backoffice/src/services/api.ts`, `uis/application/lib/suppliers-api.ts`,
  `uis/application/lib/auth-api.ts`) que traduce entre el DTO de la API
  (snake_case) y el modelo de la UI (camelCase) en ambas direcciones.
  En `uis/application`, el fetch genérico (`apiRequest`/`extractErrorMessage`/
  `jsonInit`) vive en `lib/api-client.ts`; cada dominio (`suppliers-api.ts`,
  `auth-api.ts`) solo aporta su propio `translateIssue`. Extraer ese cliente
  compartido en cuanto haya un segundo consumidor evita duplicar la lógica de
  errores/red.
- Diccionarios de etiquetas ES para todo enum de la API; la UI nunca muestra el
  valor crudo. Filtros que se guardan en la URL.
- Estados de carga y error explícitos en cada consumo de API.
- Estado de sesión (token en `localStorage`) se lee con `useSyncExternalStore`
  (`lib/auth-storage.ts::subscribeToken`), no con `useEffect` + `setState`: el
  lint de `eslint-plugin-react-hooks` de este repo bloquea ese patrón
  ("Avoid calling setState() directly within an effect").
- Los mensajes de error que arma el backend en Python (`services/api/`) no
  llevan tildes (ver más abajo); si un cliente de `uis/` los muestra tal
  cual, hay que reescribirlos con la ortografía correcta antes de
  mostrarlos al usuario (ver `KNOWN_MESSAGE_FIXES` en
  `uis/application/lib/auth-api.ts`).

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
- Interfaces compartidas con el frontend → `packages/` cuando haya dos consumidores.

## Convenciones transversales

- Commits: Conventional Commits en español, imperativo, sin tildes. Sin firmas de
  IA. Ramas `feature/*` → PR a `main`.
- Comprobaciones antes de commit según el área tocada (ver `AGENTS.md` §4).
- Registro de prompts del proyecto en `docs/prompts.md`.
