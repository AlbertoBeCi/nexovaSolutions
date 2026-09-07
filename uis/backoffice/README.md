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
```

## Estructura

```
src/
├─ app/
│  ├─ layout.tsx              # root layout: fuentes + <AppShell>
│  ├─ page.tsx                # entrada: pipeline de candidatos con filtros
│  ├─ _components/
│  │  ├─ app-shell.tsx        # sidebar (escritorio) + topbar (móvil)
│  │  └─ nav-links.tsx        # navegación con estado activo
│  └─ candidates/
│     ├─ [id]/page.tsx        # ficha + notas + cambio rápido de estado/etapa
│     ├─ [id]/edit/page.tsx   # edición
│     └─ new/page.tsx         # alta
├─ services/api.ts            # cliente de la API de 4Geek Tracker
└─ types/candidate.ts         # tipos + diccionarios de etiquetas ES
```

## Convenciones

- La UI va en **español**; nunca se muestran valores crudos de la API (se traducen
  con `statusLabels` / `stageLabels`).
- Antes de commit: `npm run lint` y `npm run build` en verde.
- Next.js del repo trae breaking changes: consulta `node_modules/next/dist/docs/`
  antes de tocar código de Next. El bloque de `AGENTS.md` lo regenera `next dev`.
