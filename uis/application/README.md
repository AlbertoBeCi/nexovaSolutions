# Nexova — Operaciones (`uis/application`)

Aplicación interna del equipo de operaciones de Nexova. Módulos: **login y
cuenta** (`/login`, `/forgot-password`, `/reset-password`,
`/account/change-password`) y el **directorio de proveedores**
(`/suppliers`). Next.js 16 (App Router) + React 19 + Tailwind v4, mismas
versiones que `uis/backoffice`.

## Arrancar

Necesita la API de `services/api` en marcha (ver su README):

```bash
# terminal 1 — API
cd services/api
uv sync
cp .env.example .env      # completa SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
uv run seed
uv run seed-users          # crea el primer admin, para poder probar el login
uv run uvicorn main:app --reload --port 8000

# terminal 2 — esta app
cd uis/application
npm install
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001). Usa el puerto **3001**
para poder convivir con el backoffice (3000); la API ya permite ese origen por
CORS.

Variable opcional en `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Qué hace el login

Sesión con `Authorization: Bearer <token>` guardado en `localStorage`
(`lib/auth-storage.ts`); no hay cookies ni SSR de datos de sesión.

- **`/login`**: email + password contra `POST /auth/login`. Si viene de
  `/reset-password` (`?reset=success`), muestra un aviso.
- **`/forgot-password`**: pide el email y siempre muestra el mismo mensaje de
  éxito, exista o no la cuenta (igual que hace la API, para no revelar qué
  emails están registrados). No hay proveedor de email todavía: el token de
  reset se ve en la consola del backend (`uv run uvicorn ...`), no en el
  navegador — hay que copiarlo a mano para probar `/reset-password`.
- **`/reset-password?token=...`**: nueva contraseña + confirmación; si no
  coinciden, no llega a llamar a la API. Éxito → redirige a
  `/login?reset=success`.
- **`/account/change-password`**: requiere sesión (envuelta en
  `<RequireAuth>`, que redirige a `/login` si no hay token válido).
  Contraseña actual + nueva + confirmación. La API devuelve un access token
  nuevo al cambiarla (invalida el anterior); esta página lo guarda solo.
- El nav (`nav-links.tsx`) muestra "Iniciar sesión" o "Mi cuenta" / "Cerrar
  sesión" según haya token guardado (`useSyncExternalStore` sobre
  `lib/auth-storage.ts`, para no leer `localStorage` dentro de un efecto).
- Política de contraseña en reset/change: 8+ caracteres, mayúscula,
  minúscula y número (la valida la API; esta UI no duplica la regla, solo
  muestra el mensaje que devuelve).

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

> **Pendiente:** `lib/suppliers-api.ts` todavía no adjunta el
> `Authorization: Bearer <token>` del login. `POST/PATCH/DELETE /suppliers`
> ya lo exige en la API (ver `services/api/README.md`), así que esas
> acciones devuelven `401` aunque el usuario haya iniciado sesión; solo
> `GET /suppliers` (lectura) sigue funcionando. Conectar `lib/auth-storage.ts`
> con `lib/suppliers-api.ts` queda para una tarea siguiente.

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
├─ forgot-password/page.tsx
├─ reset-password/page.tsx    # lee ?token= (useSearchParams)
├─ account/change-password/page.tsx   # envuelta en <RequireAuth>
└─ suppliers/
   ├─ page.tsx                # cabecera + <Suspense> del directorio
   └─ _components/
      ├─ suppliers-directory.tsx  # estado, filtros en URL, acciones
      ├─ supplier-filters.tsx     # selects de país y categoría
      ├─ supplier-table.tsx       # tabla + acciones por fila
      ├─ supplier-form.tsx        # formulario de alta
      ├─ rate-editor.tsx          # edición rápida de tarifa
      └─ status-badge.tsx         # insignia Activo / Suspendido
lib/
├─ api-client.ts              # fetch genérico compartido (fetch + errores + jsonInit)
├─ suppliers-api.ts           # cliente de /suppliers: DTO ↔ modelo, errores en español
├─ auth-api.ts                # cliente de /auth: login, forgot/reset/change-password
└─ auth-storage.ts            # token en localStorage + subscribeToken (useSyncExternalStore)
types/
├─ supplier.ts                # tipos + COUNTRY_LABELS / CATEGORY_LABELS / STATUS_LABELS
└─ auth.ts                    # User, UserProfile, LoginCredentials
```

## Convenciones

- La UI va en **español**; nunca se muestran valores crudos de la API (`Spain`,
  `payments`, `active`…): se traducen con los diccionarios de `types/supplier.ts`.
- Antes de commit: `npm run lint` y `npm run build` en verde.
- Next.js del repo trae breaking changes: consulta `node_modules/next/dist/docs/`
  antes de tocar código de Next. El bloque de `AGENTS.md` lo regenera `next dev`.
