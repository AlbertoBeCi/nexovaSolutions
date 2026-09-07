# AGENTS.md — Nexova Solutions

Guía operativa para **cualquier agente de IA** (Claude Code, Cursor, Copilot, etc.)
que trabaje en este repositorio. Léela completa antes de tocar código. Para reglas
más específicas de una carpeta o tarea, consulta [`.agents/`](./.agents/).

---

## 1. Qué es este repositorio

Monorepo del proyecto transversal de **4Geeks Academy — AI Engineering**, construido
sobre el escenario de empresa ficticia **Nexova Solutions** (consultora de RRHH y
adquisición de talento, sedes en Valencia y Miami).

- **[`CONTEXT.md`](./CONTEXT.md) es la única fuente de verdad del dominio**: nombres
  de campos, textos, validaciones, restricciones de negocio. Todo lo que construyas
  debe reflejar ese contexto. Si algo entra en conflicto con `CONTEXT.md`, gana
  `CONTEXT.md`.
- **[`README.md`](./README.md)** explica la estructura de carpetas y qué va en cada
  una. No vuelques código en la raíz: cada app, servicio, agente o pipeline vive en
  su carpeta con su propio `README.md`.

### Al inicio de cada sesión: lee el banco de memoria

Antes de tocar nada, lee **en este orden** (todos, no solo uno):

1. [`memory-bank/projectbrief.md`](./memory-bank/projectbrief.md) — objetivo, hitos, alcance.
2. [`memory-bank/productContext.md`](./memory-bank/productContext.md) — problema de negocio, stakeholders, decisiones de producto.
3. [`memory-bank/techContext.md`](./memory-bank/techContext.md) — stack, versiones, restricciones técnicas.
4. [`memory-bank/systemPatterns.md`](./memory-bank/systemPatterns.md) — arquitectura y decisiones tomadas.
5. [`memory-bank/activeContext.md`](./memory-bank/activeContext.md) — en qué se trabaja ahora.
6. [`memory-bank/progress.md`](./memory-bank/progress.md) — qué funciona, qué falta, próximos pasos.

Luego esta guía completa y, del área en la que vayas a trabajar, su archivo en
[`.agents/rules/`](./.agents/rules/) y el `README.md` de su carpeta.

### Idioma

- La documentación del repo es bilingüe (`README.md` / `README.es.md`).
- El **idioma base del producto Nexova es español**: la UI, los mensajes de error y
  el contenido de cara al usuario van en español.
- En la UI **nunca** se muestran valores crudos de la API (`received`, `pending`…):
  se traducen con los diccionarios de etiquetas (`STATUS_LABELS`, `STAGE_LABELS`…).

---

## 2. Áreas de trabajo actuales

| Área | Ruta | Stack | Comandos |
| --- | --- | --- | --- |
| Modelo de dominio + utils (Hito 2) | [`packages/domain/`](./packages/domain/) | TypeScript puro, `tsx`, `esbuild` | `npm run typecheck`, `npm run demo`, `npm run build:demo-web` |
| Web pública (Hito 1) | [`uis/website/`](./uis/website/) | Next.js 16, React 19, Tailwind v4 | `npm run dev`, `npm run build`, `npm run lint` |
| Backoffice (pipeline de talento, Hito 3) | [`uis/backoffice/`](./uis/backoffice/) | Next.js 16, React 19, Tailwind v4 | `npm run dev`, `npm run build`, `npm run lint` |

La landing del Hito 1 se sirvió como HTML/CSS/JS estático en la raíz; ya está
migrada a Next/React en `uis/website/` y esos archivos (`index.html`,
`application.html`, `validation.js`, `form-modal.js`) se han eliminado.

Cada área tiene su **propio `package.json` y `node_modules`**. Ejecuta los comandos
desde la carpeta correspondiente, no desde la raíz.

### Estructura de la capa de aplicación

Sigue la estructura del monorepo. Toda app nueva va en una de estas dos carpetas:

| Carpeta | Para qué | Notas |
| --- | --- | --- |
| `./uis/website` | Web corporativa **de cara al público** | Landing, servicios, captación de talento |
| `./uis/backoffice` | **Aplicaciones internas** (operadores, RRHH) | Pipeline de talento (Hito 3) — antes `uis/talent-pipeline-tracker/` |

Reglas para cada app:

- Debe tener **su propio layout y una vista de entrada** funcional desde el primer
  commit — algo visible desde el día uno, aunque sea un esqueleto.
- Su propio `package.json`, `README.md` y configuración.

**Cualquier servicio backend** (API, worker, webhook, job programado) va dentro de
[`./services/`](./services/) — preferiblemente una sola app FastAPI con routers por
dominio, no muchos microservicios.

### Nota sobre las apps Next.js

Cada app de `uis/` tiene su propio `AGENTS.md` **autogenerado por `next dev`**.
Reglas:

- Esta versión de Next.js trae breaking changes: lee la guía correspondiente en
  `node_modules/next/dist/docs/` (resuelto desde esa carpeta) antes de escribir
  código de Next.
- Si `next dev` reescribe ese bloque y aparece en tu diff, **haz commit del cambio
  tal cual**; borrarlo solo lo vuelve a generar.

---

## 3. Modelo mental para decidir dónde va algo

```
¿Web pública?                        → uis/website/
¿App interna (operadores/RRHH)?      → uis/backoffice/
¿Corre en servidor / API / cola?     → services/
¿Es dato crudo o transformado?       → data/raw/ | data/process/
¿Mueve datos entre sistemas?         → data/pipelines/
¿Es un asistente de IA con objetivo? → agents/  (+ skills/ o mcps/)
¿Lo importan 2+ carpetas?            → packages/
¿Es schema / template / asset?       → shared/
¿Es doc de arquitectura del repo?    → docs/
¿Es un script de una sola vez?       → scripts/
```

Al crear una carpeta nueva de app/servicio/agente, **añade su `README.md`**.

---

## 4. Flujo obligatorio antes de cada commit

No hagas `git commit` hasta haber completado estos pasos:

1. **Acota el alcance.** Revisa `git status` y `git diff`. Haz commit **solo** de lo
   que el usuario pidió. Si ves cambios ajenos (p. ej. archivos generados, pruebas
   locales), pregunta antes de incluirlos o excluirlos.

2. **Coloca los cambios en la carpeta correcta** según el modelo mental de la
   sección 3. Nada de código nuevo suelto en la raíz.

3. **Pasa las comprobaciones del área tocada:**
   - `packages/domain/` → `npm run typecheck` (debe pasar limpio).
   - App de `uis/` (Next.js) → `npm run lint` y `npm run build` desde su carpeta.
   - Servicio de `services/` → linter y tests del servicio.
   - Si tocaste `uis/**`, ejecuta la skill `revision-textos-ui`.
   - Si tocaste varias áreas, corre las comprobaciones de todas.

4. **Actualiza la documentación afectada:**
   - `README.md` de la carpeta si cambió su estructura o cómo se ejecuta.
   - Carpeta o app nueva → su `README.md`.
   - Si el flujo del proyecto lo usa, añade el prompt al registro `docs/prompts.md`.
   - Si cambió el dominio, revisa que siga alineado con `CONTEXT.md`.
   - Si cambió el foco, el estado o una decisión, actualiza `memory-bank/`.
   - Si añadiste una convención nueva de un área, documéntala en `.agents/rules/`.

5. **No filtres secretos.** `.env*.local` y `.claude/` están en `.gitignore`;
   mantenlo así. Nunca metas claves, tokens ni `.env` reales en un commit.

6. **Stagea explícitamente** los archivos que quieres (`git add <rutas>`), no
   `git add .` a ciegas. Vuelve a mirar `git diff --staged`.

7. **Escribe el mensaje de commit** siguiendo la sección 5.

8. **No hagas `push` ni abras PR salvo que el usuario lo pida.**

---

## 5. Convención de mensajes de commit

Conventional Commits, **en español**, en presente/imperativo y **sin tildes**
(consistente con el historial):

```
<tipo>: <descripcion breve en minuscula>
```

- Tipos en uso: `feat`, `fix`, `chore`, `docs`.
- Ejemplos reales del repo:
  - `feat: agrega pagina principal del pipeline de candidatos con filtros`
  - `fix: make filterCandidatesBySkills match skills case-insensitively`
  - `docs: documenta el codigo base y elimina duplicados de api/candidato`
- Cuerpo opcional para explicar el *por qué*, no el *qué*.
- **No añadas firmas de IA** (`Co-Authored-By`, `Generated with…`) en commits ni
  PRs. Es decisión del usuario.

### Ramas y PRs

- Trabajo nuevo → rama `feature/<tema>` partiendo de `main`.
- Los PRs apuntan a `main`.
- Abre el PR solo cuando el usuario lo pida.

---

## 6. Configuración de agentes — `.agents/` y `memory-bank/`

```
./.agents
├─ rules/
│  └─ <rule-name>.md        # una regla por archivo (kebab-case)
└─ skills/
   └─ <skill>/
      └─ SKILL.md           # capacidad reutilizable + sus scripts/recursos

./memory-bank
├─ projectbrief.md          # negocio: objetivo, hitos, alcance
├─ productContext.md        # negocio: problema, stakeholders, decisiones de producto
├─ techContext.md           # técnico: stack, versiones, restricciones
├─ systemPatterns.md        # técnico: arquitectura y decisiones
├─ activeContext.md         # estado: en qué se trabaja ahora
└─ progress.md              # estado: qué funciona, qué falta
```

- **`.agents/rules/`** — reglas más detalladas que esta guía, específicas de una
  carpeta o tarea. Antes de trabajar en un área, revisa si tiene regla y síguela;
  si añades una convención nueva, documéntala ahí en el mismo commit.
- **`.agents/skills/`** — skills reutilizables (una carpeta por skill con su
  `SKILL.md`) que cualquier agente puede invocar.
- **`memory-bank/`** — al empezar una sesión, lee estos archivos para recuperar el
  estado del proyecto; cuando algo relevante cambie (avance, decisión, foco
  actual), actualízalos en el mismo commit.

Detalle y orden de precedencia en [`.agents/README.md`](./.agents/README.md).

---

## 7. No modificar sin confirmación explícita del desarrollador

Puedes leer estos archivos siempre, pero **no los edites, muevas ni borres** sin
que el desarrollador lo pida de forma explícita en la conversación:

| Ruta | Motivo |
| --- | --- |
| `CONTEXT.md`, `docs/context/**` | Briefing de la empresa. Fuente de verdad; solo lo cambia el desarrollador. |
| `README.md`, `README.es.md` (raíz y de cada carpeta) | Guía de estructura del repo. Actualízala si el cambio la afecta, pero no la reescribas por estilo. |
| `.git/**`, historial, ramas, tags | Nunca reescribas historia ni fuerces push. |
| `.env`, `.env.local`, `.env*.local`, cualquier secreto real | Nunca se leen para copiar valores ni se commitean. |
| `.claude/**`, `.agents/rules/**` de otras áreas | Config de herramientas / reglas ajenas a tu tarea. |
| `LICENSE`, `package-lock.json` (salvo que instales dependencias) | Cambios ruidosos o legales. |
| Código o config fuera del alcance que pidió el desarrollador | Un cambio = un propósito. |

Acciones que **siempre** requieren luz verde explícita: `git push`, abrir o
actualizar un PR, `git commit` cuando no se pidió, borrar archivos que no creaste
tú en esta sesión, renombrar/mover carpetas de nivel superior, tocar
`docker-compose.yml` o `infra/`.

Si crees que uno de estos cambios es necesario, **propónlo y espera respuesta**.
