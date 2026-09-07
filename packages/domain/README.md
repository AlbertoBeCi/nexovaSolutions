# `@repo/domain`

Modelo de dominio del pipeline de reclutamiento de Nexova y la lógica de negocio
que lo alimenta. Entregable del **Hito 2 — Fundamentos de Programación**
(TypeScript puro, sin IA). Contexto:
[`docs/context/hito-2-fundamentos-de-programacion.md`](../../docs/context/hito-2-fundamentos-de-programacion.md).

Antes vivía en la raíz del repo (`/src`); se movió a `packages/` por ser código
de dominio reutilizable (lo consumirán `services/` y `uis/`).

## Contenido

```
src/
├─ types/models.ts       # Candidate, Vacancy, SelectionProcess y sus enums
├─ utils/
│  ├─ collections.ts     # filtrado y orden de candidatos
│  ├─ search.ts          # búsqueda y matching candidato ↔ vacante
│  ├─ transformations.ts # scoring y agregaciones
│  └─ validations.ts     # validación de datos de negocio
├─ data/create-objects.ts # datos de ejemplo
├─ demo.ts / demo-runner.ts / browser-demo.ts + demo.html  # demo ejecutable
```

> No confundir con `uis/backoffice/src/types/candidate.ts`: ese es el DTO de la
> API pública de 4Geek Tracker; este es el dominio de negocio (skills, seniority,
> salario, encaje con vacantes).

## Uso

```bash
cd packages/domain
npm install
npm run typecheck        # tsc, debe pasar limpio
npm run demo             # ejecuta la demo por consola (tsx)
npm run build:demo-web   # empaqueta la demo web en dist/ (esbuild)
```

Para ver la demo web: `npm run build:demo-web` y abre `src/demo.html`.
