# Nexova — Backoffice

Aplicaciones internas de Nexova (operadores, RRHH). Next.js 16 (App Router) +
React 19 + Tailwind v4.

> Antes era `uis/talent-pipeline-tracker/`; se renombró a `uis/backoffice/` como
> destino canónico de las apps internas (ver [`AGENTS.md`](../../AGENTS.md)).

## Arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

`.env.local` (copia de `.env.example`):

```
NEXT_PUBLIC_API_URL=https://playground.4geeks.com/tracker/api/v1
NEXT_PUBLIC_INCIDENTS_API_URL=http://localhost:8000
NEXT_PUBLIC_APPLICATION_URL=http://localhost:3001
```

`NEXT_PUBLIC_INCIDENTS_API_URL` apunta al servicio propio de Nexova en
`services/api` (ver su README). Debe estar corriendo (`uv run uvicorn main:app
--port 8000`) y con CORS habilitado para `http://localhost:3000` (ya
configurado por defecto en `services/api/main.py`) para que `/incidencias` y
el login puedan llamarlo desde el navegador.

## Login y cuenta

Igual mecanismo que `uis/application` (mismo backend, mismo contrato):
`/login`, `/register`, `/account/profile`, `/account/change-password`. Token
en `localStorage` (`lib/auth-storage.ts`), adjuntado automáticamente por
`lib/api-client.ts::apiRequest` en cada llamada — incluida
`services/incidents-api.ts`, ya que `POST /api/incidents/analyze` requiere
login. `/incidencias` está envuelta en `<RequireAuth>`.

**No hay `/forgot-password`/`/reset-password` en esta app**: el email de
reset de `services/api` siempre apunta a un único `FRONTEND_URL`, hoy
`uis/application`. `/login` enlaza ahí ("¿Olvidaste tu contraseña?") en vez
de duplicar el flujo. Ver `services/api/README.md`.

## Estructura

```
src/
├─ app/
│  ├─ layout.tsx              # root layout: fuentes + <AppShell>
│  ├─ page.tsx                # entrada: pipeline de candidatos con filtros
│  ├─ _components/
│  │  ├─ app-shell.tsx        # sidebar (escritorio) + topbar (móvil)
│  │  ├─ nav-links.tsx        # navegación con estado activo + sesión
│  │  ├─ require-auth.tsx     # guard client-side: redirige a /login sin token
│  │  └─ form-styles.ts       # clases Tailwind compartidas por los forms de auth
│  ├─ login/page.tsx
│  ├─ register/page.tsx
│  ├─ account/
│  │  ├─ profile/page.tsx          # envuelta en <RequireAuth>
│  │  └─ change-password/page.tsx  # envuelta en <RequireAuth>
│  ├─ candidates/
│  │  ├─ [id]/page.tsx        # ficha + notas + cambio rápido de estado/etapa
│  │  ├─ [id]/edit/page.tsx   # edición
│  │  └─ new/page.tsx         # alta
│  └─ incidencias/
│     ├─ page.tsx             # envuelta en <RequireAuth>; sube un CSV, muestra el resumen y exporta
│     └─ _components/
│        ├─ csv-uploader.tsx      # drag & drop + selector de archivo
│        └─ analysis-summary.tsx  # métricas, desgloses y alertas de inválidos
├─ lib/
│  ├─ api-client.ts           # fetch genérico: adjunta el token, 401 -> /login
│  ├─ auth-api.ts             # cliente de /auth, /users, /profiles/me
│  └─ auth-storage.ts         # token en localStorage + subscribeToken (useSyncExternalStore)
├─ services/
│  ├─ api.ts                  # cliente de la API de 4Geek Tracker
│  └─ incidents-api.ts        # cliente de services/api (análisis de incidencias), vía lib/api-client.ts
└─ types/
   ├─ candidate.ts            # tipos + diccionarios de etiquetas ES
   ├─ incidents.ts            # categorías/estados/reglas de invalidez de incidencias
   └─ auth.ts                 # User, UserProfile, LoginCredentials, RegisterInput
```

## Convenciones

- La UI va en **español**; nunca se muestran valores crudos de la API (se traducen
  con `statusLabels` / `stageLabels`).
- La UI tampoco muestra errores crudos: `services/api.ts` traduce los fallos de
  red a un mensaje en español (`safeFetch`), y `services/incidents-api.ts`
  traduce los errores de validación de la API y corrige las tildes de sus
  mensajes en texto plano (`KNOWN_MESSAGE_FIXES`, mismo patrón que
  `lib/auth-api.ts`). Las páginas con carga diferida muestran el error en un
  `<div role="alert">` con botón **"Reintentar"**.
- Antes de commit: `npm run lint`, `npm run build` y `npm test` (Jest) en verde. Guía de pruebas: [`TESTING.md`](./TESTING.md).
- Next.js del repo trae breaking changes: consulta `node_modules/next/dist/docs/`
  antes de tocar código de Next. El bloque de `AGENTS.md` lo regenera `next dev`.
