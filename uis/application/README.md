# Nexova — Operaciones (`uis/application`)

Aplicación interna del equipo de operaciones de Nexova. Primer módulo: el
**directorio de proveedores** (`/suppliers`). Next.js 16 (App Router) +
React 19 + Tailwind v4, mismas versiones que `uis/backoffice`.

## Arrancar

Necesita la API de `services/api` en marcha (ver su README):

```bash
# terminal 1 — API
cd services/api
uv sync
uv run seed
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

## Estructura

```
app/
├─ layout.tsx                 # root layout: fuentes + <AppShell>
├─ page.tsx                   # entrada: acceso a los módulos
├─ _components/
│  ├─ app-shell.tsx           # sidebar (escritorio) + topbar (móvil)
│  └─ nav-links.tsx           # menú principal con estado activo
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
└─ suppliers-api.ts           # cliente de /suppliers: DTO ↔ modelo, errores en español
types/
└─ supplier.ts                # tipos + COUNTRY_LABELS / CATEGORY_LABELS / STATUS_LABELS
```

## Convenciones

- La UI va en **español**; nunca se muestran valores crudos de la API (`Spain`,
  `payments`, `active`…): se traducen con los diccionarios de `types/supplier.ts`.
- Antes de commit: `npm run lint` y `npm run build` en verde.
- Next.js del repo trae breaking changes: consulta `node_modules/next/dist/docs/`
  antes de tocar código de Next. El bloque de `AGENTS.md` lo regenera `next dev`.
