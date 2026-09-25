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
```

`NEXT_PUBLIC_INCIDENTS_API_URL` apunta al servicio propio de Nexova en
`services/api` (ver su README). Debe estar corriendo (`uv run uvicorn main:app
--port 8000`) y con CORS habilitado para `http://localhost:3000` (ya
configurado por defecto en `services/api/main.py`) para que la página
`/incidencias` pueda llamarlo desde el navegador.

## Estructura

```
src/
├─ app/
│  ├─ layout.tsx              # root layout: fuentes + <AppShell>
│  ├─ page.tsx                # entrada: pipeline de candidatos con filtros
│  ├─ _components/
│  │  ├─ app-shell.tsx        # sidebar (escritorio) + topbar (móvil)
│  │  └─ nav-links.tsx        # navegación con estado activo
│  ├─ candidates/
│  │  ├─ [id]/page.tsx        # ficha + notas + cambio rápido de estado/etapa
│  │  ├─ [id]/edit/page.tsx   # edición
│  │  └─ new/page.tsx         # alta
│  └─ incidencias/
│     ├─ page.tsx             # sube un CSV, muestra el resumen y exporta
│     └─ _components/
│        ├─ csv-uploader.tsx      # drag & drop + selector de archivo
│        └─ analysis-summary.tsx  # métricas, desgloses y alertas de inválidos
├─ services/
│  ├─ api.ts                  # cliente de la API de 4Geek Tracker
│  └─ incidents-api.ts        # cliente de services/api (análisis de incidencias)
└─ types/
   ├─ candidate.ts            # tipos + diccionarios de etiquetas ES
   └─ incidents.ts            # categorías/estados/reglas de invalidez de incidencias
```

## Convenciones

- La UI va en **español**; nunca se muestran valores crudos de la API (se traducen
  con `statusLabels` / `stageLabels`).
- Antes de commit: `npm run lint` y `npm run build` en verde.
- Next.js del repo trae breaking changes: consulta `node_modules/next/dist/docs/`
  antes de tocar código de Next. El bloque de `AGENTS.md` lo regenera `next dev`.
