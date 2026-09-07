---
rule: uis
scope: file-pattern
globs: ["uis/**"]
---

# uis

**Alcance:** por patrón de archivo — activa cuando el cambio toca `uis/**`
(`uis/website/`, `uis/backoffice/` o cualquier frontend futuro).

## Reglas

- Web pública → `uis/website/`. Apps internas (operadores, RRHH) → `uis/backoffice/`.
- Cada app: su propio `package.json`, `README.md`, layout y **vista de entrada
  funcional desde el primer commit** (algo visible desde el día uno).
- Stack por defecto: Next.js (App Router) + React + Tailwind, salvo que una app
  justifique otra cosa en su `README.md`.
- Next.js de este repo trae breaking changes: lee `node_modules/next/dist/docs/`
  (resuelto desde la carpeta de la app) antes de escribir código de Next. Si
  `next dev` regenera el bloque de su `AGENTS.md`, commitéalo tal cual.
- Idioma base de la UI: **español**. Nunca mostrar valores crudos de la API; usar
  los diccionarios de etiquetas (`STATUS_LABELS`, `STAGE_LABELS`, …).
- Estados de carga y error visibles siempre que se consuma la API.
- Accesibilidad: etiquetas semánticas, `:focus-visible`, contraste ≥ 4.5:1,
  `aria-hidden` en iconos decorativos.

## Antes de commit

- `npm run lint` y `npm run build` desde la carpeta de la app, en verde.
- Si tocaste tipos compartidos con `services/`, revisa que ambos lados compilen.
