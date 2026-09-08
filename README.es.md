# Nexova Solutions — Proyecto de Compañía de Ingeniería de IA

[![4Geeks Academy](https://img.shields.io/badge/4Geeks-Academy-blue)](https://4geeksacademy.com)
[![AI Engineering](https://img.shields.io/badge/track-AI%20Engineering-green)](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)

_Proyecto transversal del Programa de Carrera en Ingeniería de IA de 4Geeks Academy, sobre la empresa ficticia **Nexova Solutions** (consultora de RRHH y adquisición de talento — Valencia + Miami). Basado en la plantilla monorepo de 4Geeks._

_These instructions are also available in [English](./README.md)._

---

## Propósito

Una sola empresa construida a lo largo de varios hitos (Web, Programación, Backend, Telemetría, RAG, Agentes, Workflows, Tiempo real). Cada carpeta de primer nivel tiene una responsabilidad única, como en un repo real de un equipo de ingeniería.

- **[`CONTEXT.md`](./CONTEXT.md)** es la fuente única de verdad del dominio (nombres de campos, textos, validaciones, reglas de negocio). Los briefings por hito están en [`docs/context/`](./docs/context/).
- **[`AGENTS.md`](./AGENTS.md)** define cómo opera cualquier agente de IA aquí: qué leer al inicio de sesión, el flujo obligatorio antes de commit y qué no se debe modificar sin confirmación.
- Las reglas detalladas y las skills reutilizables están en [`.agents/`](./.agents/); la memoria del proyecto en [`memory-bank/`](./memory-bank/).

---

## Cómo trabajar aquí

1. **Lee** [`AGENTS.md`](./AGENTS.md) y los archivos de [`memory-bank/`](./memory-bank/).
2. **Abre el `README.md`** de la carpeta en la que vas a trabajar, y su regla en [`.agents/rules/`](./.agents/rules/) si tiene una.
3. **Implementa en la carpeta correcta** — nunca vuelques código en la raíz.
4. **Documenta** lo que añadas: cada app, servicio, agente o pipeline nuevo lleva subcarpeta + `README.md`.

---

## Cómo ejecutar las apps

Cada app tiene su propio `package.json` y `node_modules` — ejecuta los comandos desde su carpeta.

| App | Ruta | Comandos |
| --- | --- | --- |
| Web pública (Hito 1) | [`uis/website/`](./uis/website/) | `npm install` · `npm run dev` (→ http://localhost:3000) |
| Backoffice — pipeline de talento (Hito 3) | [`uis/backoffice/`](./uis/backoffice/) | `npm install` · `npm run dev` — necesita `.env.local` (ver `.env.example`) |
| Modelo de dominio + lógica (Hito 2) | [`packages/domain/`](./packages/domain/) | `npm install` · `npm run typecheck` · `npm run demo` |

---

## Cómo entender este monorepo

| Capa                    | Carpetas                                | Qué vive aquí                                                             |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| **Contexto de empresa** | `CONTEXT.md`, `docs/context/`           | Datos del dominio, nombres de campos, restricciones, briefings por hito  |
| **Config de agentes**   | `AGENTS.md`, `.agents/`, `memory-bank/` | Cómo operan los agentes, reglas, skills, memoria del proyecto            |
| **Cara al usuario**     | `uis/`, `services/`                     | Frontends y backends con los que interactúan usuarios u operadores       |
| **Datos**               | `data/`                                 | Archivos crudos, pipelines, datasets procesados y conjuntos de evaluación|
| **IA**                  | `agents/`, `skills/`, `mcps/`           | Agentes, capacidades reutilizables para agentes y servidores MCP         |
| **Automatización**      | `workflows/`                            | Flujos n8n y orquestación entre sistemas                                 |
| **Reutilización**       | `packages/`, `shared/`                  | Tipos compartidos, lógica de dominio, SDKs, esquemas, plantillas         |
| **Operaciones**         | `infra/`, `scripts/`, `internal/`       | Docker, despliegue, scripts puntuales, CLIs internas                     |
| **Documentación**       | `docs/`                                 | Arquitectura, decisiones, convenciones, registro de prompts              |

**Regla rápida:** si tiene interfaz visual → `uis/`. Si expone una API o corre en segundo plano → `services/`. Si mueve o transforma datos → `data/`. Si el trabajo lo hace un modelo de IA → `agents/` (+ `skills/` o `mcps/` según haga falta).

---

## Estado del proyecto

| Hito | Entregable | Estado |
| --- | --- | --- |
| 1 — Web pública | Landing corporativa + formulario de captación de talento (responsive, accesible, SEO) | ✅ En [`uis/website/`](./uis/website/) (Next.js/React). Migrado del HTML estático original, ya eliminado. |
| 2 — Fundamentos de programación | Modelo de dominio + lógica (scoring, matching, filtrado) en TypeScript | ✅ En [`packages/domain/`](./packages/domain/) (`@repo/domain`) |
| 3 — Pipeline de talento | App interna: listado con filtros, ficha, alta/edición, notas; consume la API de 4Geek Tracker | 🚧 En [`uis/backoffice/`](./uis/backoffice/) |
| 4+ — Backend, Telemetría, RAG, Agentes, Workflows, Tiempo real | — | ⏳ Sin empezar |

`services/`, `data/`, `agents/`, `mcps/`, `workflows/`, `infra/`, `internal/` siguen siendo estructura vacía.

---

## Guía de carpetas — qué va en cada una

Lee el `README.md` enlazado dentro de cada carpeta antes de empezar a programar ahí.

### Archivos en la raíz

| Ruta                         | Propósito                                              | Qué haces aquí                                              |
| ---------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| [`CONTEXT.md`](./CONTEXT.md) | Fuente única de verdad del dominio de Nexova           | Léelo antes de construir nada; solo lo cambia el desarrollador |
| [`AGENTS.md`](./AGENTS.md)   | Cómo opera cualquier agente de IA en este repo         | Lectura al inicio de sesión, flujo de commit, lista de "no tocar" |
| `README.md` / `README.es.md` | Esta guía                                             | Orientación — estás aquí                                   |
| `netlify.toml`               | Config de build de Netlify — publica solo `uis/website` (Next.js) | Editar si cambia el build del sitio público |
| `docker-compose.yml`         | Orquestación local (aún no existe)                     | Añadir en la raíz cuando haya `services/` y bases de datos |

### `uis/` — interfaces de usuario

**Propósito:** Todas las aplicaciones frontend — todo lo que un humano ve y en lo que hace clic.

**Pon aquí:**

- Sitio web público → [`uis/website/`](./uis/website/)
- Admin interno / backoffice → [`uis/backoffice/`](./uis/backoffice/)
- Portales de clientes, dashboards con UI, herramientas Streamlit/Gradio

Cada app: su propio `package.json`, `README.md`, layout y una vista de entrada funcional desde el primer commit.

→ Ver [`uis/README.md`](./uis/README.md)

### `services/` — API centralizada de la empresa (FastAPI)

**Propósito:** Un **backend FastAPI centralizado** para toda la empresa — un solo punto de entrada que reduce la complejidad a medida que crece el proyecto.

**Pon aquí:**

- Una app FastAPI principal (p. ej. `api/`) con routers/módulos por dominio
- Workers en background solo cuando de verdad necesiten correr separados de la API

**Recomendación:** evita dividir en muchos microservicios al inicio.

→ Ver [`services/README.md`](./services/README.md)

### `data/` — datasets, pipelines y evaluación

**Propósito:** Todo lo relacionado con datos, desde archivos crudos hasta tablas listas para producción.

| Subcarpeta                                      | Propósito                     | Qué haces aquí                                                                  |
| ----------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| [`data/raw/`](./data/raw/README.md)             | Datos fuente sin tocar        | Guardar dumps, exports, CSV/JSON de ejemplo — documentar origen y reglas de PII |
| [`data/pipelines/`](./data/pipelines/README.md) | Jobs ETL/ELT                  | Escribir scripts de ingesta, limpieza y transformación                          |
| [`data/process/`](./data/process/README.md)     | Salidas limpias / intermedias | Guardar artefactos de pipelines (features, agregados, tablas limpias)           |
| [`data/eval/`](./data/eval/README.md)           | Medición de calidad           | Golden sets, datasets de evaluación RAG/agentes, métricas de experimentos       |

**Flujo:** `raw` → `pipelines` → `process` → consumido por `services/`, `uis/` o `agents/`. Usa `eval` para demostrar calidad.

### `agents/` — agentes de IA

**Propósito:** Asistentes de IA autónomos o semi-autónomos para la empresa.

**Pon aquí:**

- Una subcarpeta por agente (p. ej. `support-agent/`, `onboarding-agent/`)
- Config del agente, prompts, herramientas, tests
- Empieza desde [`agents/_template/`](./agents/_template/README.md) al crear un agente nuevo

> No confundir con [`.agents/`](./.agents/), que contiene la **configuración** de agentes (reglas y skills) para quien trabaje en este repo.

→ Ver [`agents/README.md`](./agents/README.md)

### `skills/` — capacidades reutilizables para agentes

**Propósito:** Instrucciones empaquetadas + scripts que agentes reutilizan en todo el repo.

**Pon aquí:**

- Skills de análisis de datos, code review, scraping, investigación, etc.
- Cada skill = carpeta con `SKILL.md`, scripts y recursos opcionales

> Las skills propias del proyecto van en [`.agents/skills/`](./.agents/skills/); `skills/` y `.claude/skills/` son de la plantilla.

→ Ver [`skills/README.md`](./skills/README.md)

### `mcps/` — servidores Model Context Protocol

**Propósito:** Conectar modelos de IA con tus sistemas — bases de datos, APIs, GitHub, herramientas propias. Una subcarpeta por servidor MCP, con sus definiciones de tools, resources y config.

→ Ver [`mcps/README.md`](./mcps/README.md)

### `workflows/` — automatización y orquestación

**Propósito:** Conectar sistemas sin escribir apps completas — jobs programados, webhooks, notificaciones. Exports de n8n, configs de Make/Zapier u orquestación que enlaza `services/`, `data/pipelines/` y `agents/`.

→ Ver [`workflows/README.md`](./workflows/README.md)

### `packages/` — librerías compartidas

**Propósito:** Código versionable reutilizado por varias apps, agentes o pipelines.

**Pon aquí:**

- [`packages/domain/`](./packages/domain/) → `@repo/domain` — modelo y lógica del dominio de reclutamiento (Hito 2)
- [`packages/shared/`](./packages/shared/) → `@repo/shared-types` — tipos compartidos entre apps y servicios
- Librerías de componentes UI, clientes API, SDKs de analytics

**Regla:** si `uis/` y `services/` comparten la misma interfaz → extráela aquí.

→ Ver [`packages/README.md`](./packages/README.md)

### `shared/` — recursos sueltos compartidos

**Propósito:** Recursos que no son un paquete completo — esquemas JSON, plantillas de email, specs OpenAPI, design tokens.

→ Ver [`shared/README.md`](./shared/README.md)

### `docs/` — documentación transversal

**Propósito:** Arquitectura y decisiones que abarcan todo el proyecto.

**Contiene:** [`docs/context/`](./docs/context/) (briefings por hito), `docs/company-choice.md`, `docs/prompts.md` (registro de prompts). Añade aquí diagramas de arquitectura, ADRs y convenciones.

→ Ver [`docs/README.md`](./docs/README.md)

### `infra/` — infraestructura y despliegue

**Propósito:** Cómo corre el proyecto en Docker, cloud o CI. Dockerfiles, Terraform, manifiestos K8s, configs Nginx, pipelines CI/CD.

→ Ver [`infra/README.md`](./infra/README.md)

### `scripts/` — scripts de ayuda

**Propósito:** Automatización pequeña y repetible — no apps completas. Scripts de setup, generadores de seed data, migraciones puntuales. Documenta cada uno.

→ Ver [`scripts/README.md`](./scripts/README.md)

### `internal/` — herramientas internas para desarrolladores

**Propósito:** Utilidades robustas para el equipo — CLIs, herramientas de migración empaquetadas, evaluadores de prompts, con su propio `package.json` y tests.

→ Ver [`internal/README.md`](./internal/README.md)

---

## ¿Dónde pongo esto?

```text
¿Web pública?                                → uis/website/
¿App interna (operadores / RRHH)?            → uis/backoffice/
¿Corre en servidor / API / cola?             → services/
¿Es dato crudo o transformado?               → data/raw/ o data/process/
¿Mueve datos entre sistemas?                 → data/pipelines/
¿Mides calidad de IA / pipelines?            → data/eval/
¿Es un asistente de IA con un objetivo?      → agents/
¿Es una regla de cómo trabajan los agentes?  → .agents/rules/
¿Es una skill reutilizable de agente?        → .agents/skills/
¿Estado del proyecto a recordar entre sesiones? → memory-bank/
¿Código importado por 2+ carpetas?           → packages/
¿Es esquema / plantilla / asset, no librería?→ shared/
¿Es arquitectura o docs de todo el equipo?   → docs/
¿Es Docker / deploy / config cloud?          → infra/
¿Es un script puntual?                       → scripts/
¿Es una CLI con su propio paquete?           → internal/
```

---

## Estructura del repositorio (árbol)

```text
nexovaSolutions/
├── README.md / README.es.md   # Esta guía
├── CONTEXT.md                 # Fuente de verdad del dominio (briefing Hito 1)
├── AGENTS.md                  # Cómo operan los agentes de IA aquí
├── netlify.toml               # Build de Netlify — publica uis/website
├── .agents/
│   ├── rules/                 # Reglas de desarrollo con alcance declarado
│   └── skills/                # Skills reutilizables (+ scripts verificadores)
├── memory-bank/               # Memoria del proyecto (negocio + técnico + estado)
├── uis/
│   ├── website/               # Web pública (Next.js) — Hito 1
│   └── backoffice/            # App de pipeline de talento (Next.js) — Hito 3
├── packages/
│   ├── domain/                # @repo/domain — lógica de reclutamiento — Hito 2
│   └── shared/                # @repo/shared-types
├── services/                  # API FastAPI centralizada (vacía)
├── data/{raw,pipelines,process,eval}/   # Ciclo de vida del dato (vacío)
├── agents/                    # Agentes de IA (+ plantilla _template/) (vacío)
├── skills/  mcps/  workflows/ # Estructura de plantilla (vacía)
├── docs/                      # context/, company-choice.md, prompts.md
├── infra/  scripts/  internal/  shared/ # (vacío)
```

---

## Enlaces

- [4Geeks Academy — Ingeniería de IA](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)
- [Cómo empezar un proyecto de código](https://4geeks.com/lesson/how-to-start-a-project)

---

## Contribuidores

Construido sobre la plantilla monorepo de Ingeniería de IA de 4Geeks Academy por [@marcogonzalo](https://www.linkedin.com/in/marcogonzalo) y [@alezanchezr](https://x.com/alesanchezr), junto a otros muchos colaboradores. Descubre más sobre nuestro [Curso de Ingeniería de IA](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia) y sobre [otros cursos](https://4geeksacademy.com/es/comparar-programas).

Puedes encontrar otras plantillas y recursos similares en la [página de GitHub de 4Geeks Academy](https://github.com/4geeksacademy).
