# Nexova — Operaciones (`uis/application`)

Aplicación interna del equipo de operaciones de Nexova. Módulos: **login y
cuenta** (`/login`, `/register`, `/forgot-password`, `/reset-password`,
`/account/profile`, `/account/change-password`), el **directorio de
proveedores** (`/suppliers`) y el **gestor de incidencias**
(`/incidents/new`, `/incidents`, `/incidents/summary`). Next.js 16 (App
Router) + React 19 + Tailwind v4, mismas versiones que `uis/backoffice`.

## Arrancar

Necesita **dos** APIs en marcha: `services/api` (login, proveedores) y
`services/incident-manager-api` (gestor de incidencias) — ver sus README:

```bash
# terminal 1 — API de proveedores/auth
cd services/api
uv sync
cp .env.example .env      # completa SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
uv run seed
uv run seed-users          # crea el primer admin, para poder probar el login
uv run uvicorn main:app --reload --port 8000

# terminal 2 — API del gestor de incidencias
cd services/incident-manager-api
uv sync
uv run --project services/incident-manager-api python ../../scripts/seed_incidents.py
uv run serve                # → puerto 8001

# terminal 3 — esta app
cd uis/application
npm install
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001). Usa el puerto **3001**
para poder convivir con el backoffice (3000); ambas APIs ya permiten ese
origen por CORS.

Variables opcionales en `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_INCIDENTS_API_URL=http://localhost:8001
```

## Qué hace el login

Sesión con `Authorization: Bearer <token>` guardado en `localStorage`
(`lib/auth-storage.ts`); no hay cookies ni SSR de datos de sesión.

- **`/login`**: email + password contra `POST /auth/login`. Si viene de
  `/reset-password` (`?reset=success`), muestra un aviso. Enlaza a
  `/forgot-password` y a `/register`.
- **`/register`**: email + password + `name`/`phone`/`address` opcionales
  en un solo formulario (si se llena `name`, `POST /users` crea también el
  `Profile` vinculado en la misma llamada) → login automático con las
  mismas credenciales → redirige a `/`.
- **`/forgot-password`**: pide el email y siempre muestra el mismo mensaje de
  éxito, exista o no la cuenta (igual que hace la API, para no revelar qué
  emails están registrados). Si el backend tiene `RESEND_API_KEY`
  configurada, el link real llega por email (vía Resend); si no, el token
  se ve en la consola del backend (`uv run uvicorn ...`) — hay que copiarlo
  a mano para probar `/reset-password`.
- **`/reset-password?token=...`**: nueva contraseña + confirmación; si no
  coinciden, no llega a llamar a la API. Éxito → redirige a
  `/login?reset=success`.
- **`/account/profile`**: requiere sesión (envuelta en `<RequireAuth>`).
  Muestra email/rol (de `GET /auth/me`, que `RequireAuth` ya resolvió — la
  página no repite la llamada) y un formulario para `name`/`phone`/`address`
  vía `PUT /profiles/me` (upsert). Enlaza a `/account/change-password`.
- **`/account/change-password`**: requiere sesión. Contraseña actual +
  nueva + confirmación. La API devuelve un access token nuevo al cambiarla
  (invalida el anterior); esta página lo guarda sola.
- **`<RequireAuth>`** (`app/_components/require-auth.tsx`): al montar hace
  `GET /auth/me`; si falla, limpia el token y redirige a `/login`. Puede
  envolver un nodo normal o una función `(currentUser) => nodo` cuando la
  página necesita los datos del usuario ya autenticado (así lo usa
  `/account/profile`, para no duplicar la llamada a `/auth/me`).
- **Interceptor centralizado** (`lib/api-client.ts::apiRequest`): adjunta el
  token guardado (si hay) en cada request — ningún cliente de dominio
  (`auth-api.ts`, `suppliers-api.ts`) arma el header a mano. Si una llamada
  *que llevaba token* responde `401` (sesión inválida/expirada), limpia el
  storage y redirige a `/login` automáticamente. Un `401` en una llamada
  *sin* token (ej. login con credenciales malas) no dispara nada de esto: se
  muestra como error normal en el formulario.
- El nav (`nav-links.tsx`) muestra "Iniciar sesión" o "Mi cuenta" / "Cerrar
  sesión" según haya token guardado (`useSyncExternalStore` sobre
  `lib/auth-storage.ts`, para no leer `localStorage` dentro de un efecto).
- Política de contraseña: en `/register`, la API solo exige 8+ caracteres;
  en reset/change, 8+ con mayúscula, minúscula y número (la valida la API;
  esta UI no duplica la regla, solo muestra el mensaje que devuelve).

## Qué hace `/suppliers`

- **Listado** con nombre, país, categorías, tarifa mensual (con símbolo de
  moneda, formato `es-ES`) y estado como insignia de color (verde «Activo»,
  ámbar «Suspendido»).
- **Filtros** de país y categoría: se guardan en la URL (`?country=&category=`),
  así que se pueden compartir, y cada cambio vuelve a pedir
  `GET /suppliers` sin recargar la página.
- **Alta** (`POST /suppliers`): la moneda se fija sola según el país. Los
  errores de validación de la API (422) se muestran traducidos al español.
- **Acciones rápidas**: editar la tarifa (`PATCH …/rate`), activar/suspender
  (`PATCH …/status`) y eliminar con confirmación (`DELETE`). La fila se
  actualiza con la respuesta de la API en cuanto la petición tiene éxito.

`lib/api-client.ts` adjunta el token guardado automáticamente en toda
llamada que pase por `apiRequest` (incluida `lib/suppliers-api.ts`), así que
alta/edición/eliminación de proveedores ya funcionan estando logueado.

## Qué hace `/incidents`

Consume `services/incident-manager-api` (puerto 8001, no `services/api`) a
través de `lib/incidents-api.ts`, un cliente propio: el formato de error de
ese backend (`{"error": {"code","message","fields"}}`) es distinto del
`{"detail": [...]}` de Pydantic que traduce `lib/api-client.ts`, así que no
lo reutiliza. Sin login: este gestor no tiene autenticación propia.

- **`/incidents/new`**: alta de incidencia (título, descripción, categoría,
  origen, sede — el estado siempre nace "Abierta"). Validación en cliente
  campo a campo (`aria-invalid`/`aria-describedby`); si `origen = Sede`, el
  campo sede se resalta con un aviso ("Estás reportando desde una sede
  específica"). Los errores de la API nunca se muestran tal cual: solo se
  usan `code` y las claves de `fields`, con mensajes propios de esta UI.
- **`/incidents`**: listado con filtros de estado/origen/sede en la URL,
  paginado de 25 filas, y cambio de estado en línea. El selector de estado
  solo ofrece las transiciones válidas desde el estado actual
  (`nextStatusOptions` en `types/incident.ts`); los estados finales
  (Resuelta/Descartada) se muestran como insignia bloqueada. El cambio es
  optimista: la fila cambia antes de que responda la API, y si el `PATCH`
  falla, vuelve a su estado anterior con un aviso.
- **`/incidents/summary`**: 4 tarjetas (estado, categoría, origen, sede) con
  los totales de `GET /api/incidents/summary`. Carga y error aislados del
  resto de la página.

## Estructura

```
app/
├─ layout.tsx                 # root layout: fuentes + <AppShell>
├─ page.tsx                   # entrada: acceso a los módulos
├─ _components/
│  ├─ app-shell.tsx           # sidebar (escritorio) + topbar (móvil)
│  ├─ nav-links.tsx           # menú principal con estado activo + sesión
│  ├─ require-auth.tsx        # guard client-side: redirige a /login sin token
│  └─ form-styles.ts          # clases Tailwind compartidas por los forms de auth
├─ login/page.tsx
├─ register/page.tsx
├─ forgot-password/page.tsx
├─ reset-password/page.tsx    # lee ?token= (useSearchParams)
├─ account/
│  ├─ profile/page.tsx        # envuelta en <RequireAuth>, usa el currentUser que ya resolvio
│  └─ change-password/page.tsx   # envuelta en <RequireAuth>
├─ suppliers/
│  ├─ page.tsx                # cabecera + <Suspense> del directorio
│  └─ _components/
│     ├─ suppliers-directory.tsx  # estado, filtros en URL, acciones
│     ├─ supplier-filters.tsx     # selects de país y categoría
│     ├─ supplier-table.tsx       # tabla + acciones por fila
│     ├─ supplier-form.tsx        # formulario de alta
│     ├─ rate-editor.tsx          # edición rápida de tarifa
│     └─ status-badge.tsx         # insignia Activo / Suspendido
└─ incidents/
   ├─ new/page.tsx            # registro de incidencia
   ├─ page.tsx                # cabecera + <Suspense> del listado
   ├─ summary/page.tsx        # resumen
   └─ _components/
      ├─ incident-form.tsx           # formulario de alta
      ├─ incident-filters.tsx        # selects de estado/origen/sede
      ├─ incident-table.tsx          # tabla + cambio de estado por fila
      ├─ status-select.tsx           # transiciones válidas / insignia si es final
      ├─ incidents-panel.tsx         # estado, filtros en URL, paginación, optimismo
      └─ incidents-summary-panel.tsx # 4 tarjetas de GET /api/incidents/summary
lib/
├─ api-client.ts              # fetch genérico compartido (fetch + errores + jsonInit) — services/api
├─ suppliers-api.ts           # cliente de /suppliers: DTO ↔ modelo, errores en español
├─ auth-api.ts                # cliente de /auth: login, forgot/reset/change-password
├─ auth-storage.ts            # token en localStorage + subscribeToken (useSyncExternalStore)
└─ incidents-api.ts           # cliente de services/incident-manager-api: formato de error propio
types/
├─ supplier.ts                # tipos + COUNTRY_LABELS / CATEGORY_LABELS / STATUS_LABELS
├─ auth.ts                    # User, UserProfile, LoginCredentials
└─ incident.ts                # espejo TS de nexova_shared/incident_constants.py + etiquetas
```

## Convenciones

- La UI va en **español**; nunca se muestran valores crudos de la API (`Spain`,
  `payments`, `active`…): se traducen con los diccionarios de
  `types/supplier.ts` / `types/incident.ts`.
- Antes de commit: `npm run lint` y `npm run build` en verde.
- Next.js del repo trae breaking changes: consulta `node_modules/next/dist/docs/`
  antes de tocar código de Next. El bloque de `AGENTS.md` lo regenera `next dev`.
