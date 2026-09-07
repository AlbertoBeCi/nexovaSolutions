# Nexova — Website

Web corporativa **de cara al público**. Next.js 16 (App Router) + React 19 +
Tailwind v4.

## Arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura

```
src/app/
├─ layout.tsx              # shell: <SiteHeader> + <SiteFooter> + JSON-LD Organization
├─ page.tsx                # landing: hero, servicios, por qué Nexova, CTA
├─ talento/page.tsx        # entrada del banco de talento (formulario: hito posterior)
├─ globals.css
└─ _components/
   ├─ site-header.tsx      # cabecera fija; menú móvil con <details> (sin JS)
   └─ site-footer.tsx      # contacto de ambas sedes (GEO-SEO)
```

## Convenciones

- Contenido en **español** (idioma base). Textos y datos de contacto salen de
  [`../../CONTEXT.md`](../../CONTEXT.md); no inventar copy.
- Jerarquía de encabezados estricta (un solo `<h1>` por página).
- Accesibilidad: `:focus-visible`, contraste ≥ 4.5:1, `aria-hidden` en adornos.
- Antes de commit: `npm run lint` y `npm run build` en verde.
- Next.js del repo trae breaking changes: consulta `node_modules/next/dist/docs/`
  antes de tocar código de Next. El bloque de `AGENTS.md` lo regenera `next dev`.
