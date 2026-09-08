# Nexova — Website

Web corporativa **de cara al público** (entregable del Hito 1). Next.js 16 (App
Router) + React 19 + Tailwind v4.

Migrada desde la landing estática HTML/CSS/JS que vivía en la raíz del repo
(`index.html`, `application.html`, `validation.js`, `form-modal.js`), ya
eliminada. El diseño editorial (Fraunces + Public Sans, paleta crema/verde, tema
claro/oscuro) y las validaciones se conservan.

## Arrancar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura

```
src/
├─ app/
│  ├─ layout.tsx            # fuentes, script de tema, JSON-LD Organization, <SiteHeader>/<SiteFooter>
│  ├─ page.tsx              # landing: hero + ficha de candidato, servicios, por qué Nexova, CTA
│  ├─ talento/page.tsx      # registro de talento: intro + aviso B2B + <TalentForm>
│  ├─ globals.css           # paleta editorial + [data-theme] claro/oscuro
│  └─ _components/
│     ├─ site-header.tsx    # cabecera fija, nav de sección, menú móvil
│     ├─ site-footer.tsx    # sedes de Valencia y Miami (GEO-SEO)
│     ├─ theme-toggle.tsx   # alterna data-theme, persiste en localStorage
│     └─ talent-form.tsx    # asistente de 3 pasos con validación en vivo
└─ lib/
   └─ talent-validation.ts  # validación pura + opciones de los selects
```

## Despliegue

Netlify. La app es un **export estático** de Next (`output: "export"` en
`next.config.ts`): `npm run build` genera `out/` con HTML/CSS/JS, sin runtime.
Config en [`../../netlify.toml`](../../netlify.toml) (raíz): `base = "uis/website"`,
`command = "npm run build"`, `publish = "out"`. Solo se publica esta app; el
backoffice no se despliega.

> Requiere que todo sea estático: nada de route handlers, `cookies()`/`headers()`,
> ISR ni datos en request. Hoy se cumple.

## Convenciones

- Contenido en **español** (idioma base). Textos, mensajes de error, mensaje de
  éxito y datos de contacto salen **literalmente** de
  [`../../CONTEXT.md`](../../CONTEXT.md); no inventar ni parafrasear copy.
- El envío del formulario se **simula** (sin backend): al validar, se muestra el
  mensaje de éxito.
- Jerarquía de encabezados estricta (un solo `<h1>` por página).
- Accesibilidad: `:focus-visible`, contraste ≥ 4.5:1, `aria-hidden` en adornos,
  `aria-describedby` en los campos con error.
- Antes de commit: `npm run lint` y `npm run build` en verde.
- Next.js del repo trae breaking changes: consulta `node_modules/next/dist/docs/`
  antes de tocar código de Next. El bloque de `AGENTS.md` lo regenera `next dev`.
