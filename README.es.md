# Nexova Solutions — Proyecto de Ingeniería de IA

[![4Geeks Academy](https://img.shields.io/badge/4Geeks-Academy-blue)](https://4geeksacademy.com)
[![AI Engineering](https://img.shields.io/badge/track-AI%20Engineering-green)](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)

_Proyecto transversal del Programa de Carrera en Ingeniería de IA de 4Geeks Academy. Construimos la empresa ficticia **Nexova Solutions**, una consultora de RR. HH. y adquisición de talento con sedes en Valencia y Miami, sobre una plantilla monorepo de 4Geeks._

También puedes leer esta guía en [inglés](./README.md).

## 🧭 Índice

- [El proyecto](#el-proyecto)
- [Arranque rápido](#arranque-rapido)
- [Desarrollo con Docker Compose](#desarrollo-con-docker-compose)
- [Cómo trabajar en el repo](#como-trabajar-en-el-repo)
- [Mapa del monorepo](#mapa-del-monorepo)
- [Estado de los hitos](#estado-de-los-hitos)
- [Guía de carpetas](#guia-de-carpetas)
- [¿Dónde pongo esto?](#donde-pongo-esto)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Enlaces y colaboradores](#enlaces-y-colaboradores)

<a id="el-proyecto"></a>
## 🌱 El proyecto

Una sola empresa construida a lo largo de varios hitos: web, programación, backend, telemetría, RAG, agentes, workflows y tiempo real. Cada carpeta de primer nivel tiene una responsabilidad concreta, como en un equipo real de ingeniería.

### Fuentes y orientación

- **[`CONTEXT.md`](./CONTEXT.md)** es la fuente única de verdad del dominio: nombres de campos, textos, validaciones y reglas de negocio. Los briefings de cada hito están en [`docs/context/`](./docs/context/).
- **[`AGENTS.md`](./AGENTS.md)** explica cómo deben trabajar los agentes de IA: qué leer al comenzar, el flujo previo a un commit y qué archivos no modificar sin confirmación.
- **[`.agents/`](./.agents/)** contiene reglas detalladas y skills reutilizables; **[`memory-bank/`](./memory-bank/)** conserva la memoria del proyecto.

<a id="arranque-rapido"></a>
## 🚀 Arranque rápido

Cada app tiene su propio `package.json` y `node_modules`. Ejecuta los comandos desde la carpeta indicada.

### Interfaces web

| Aplicación | Carpeta | Arranque |
| --- | --- | --- |
| Web pública (Hito 1) | [`uis/website/`](./uis/website/) | `npm install` y `npm run dev` → [localhost:3000](http://localhost:3000) |
| Backoffice — pipeline de talento (Hito 3) | [`uis/backoffice/`](./uis/backoffice/) | `npm install` y `npm run dev`; necesita `.env.local` (ver `.env.example`) |
| Operaciones — proveedores e incidencias | [`uis/application/`](./uis/application/) | `npm install` y `npm run dev` → [localhost:3001](http://localhost:3001); necesita las dos APIs en marcha |

### APIs y lógica de dominio

| Área | Carpeta | Comandos principales |
| --- | --- | --- |
| API de incidencias (análisis CSV) y proveedores | [`services/api/`](./services/api/) | `uv sync` · `uv run seed` · `uv run uvicorn main:app --reload --port 8000` |
| Gestor de incidencias persistente | [`services/incident-manager-api/`](./services/incident-manager-api/) | `uv sync` · `uv run --project services/incident-manager-api python scripts/seed_incidents.py` · `uv run serve` (puerto 8001) |
| Modelo y lógica de dominio (Hito 2) | [`packages/domain/`](./packages/domain/) | `npm install` · `npm run typecheck` · `npm run demo` |

<a id="desarrollo-con-docker-compose"></a>
## 🐳 Desarrollo con Docker Compose

Desde la raíz del repositorio, ejecuta:

```bash
docker compose up
```

Arranca la web pública en `localhost:3000`, el backoffice en `localhost:3001`, la API en `localhost:8000` y PostgreSQL local para inventario. El archivo `.env.example` contiene valores locales; crea o edita `.env` en la raíz solo si necesitas personalizarlos. Para reconstruir las imágenes después de cambiar dependencias o Dockerfiles, ejecuta `docker compose up --build`.

La API empieza con el almacén local de usuarios vacío. Crea una vez el administrador de desarrollo con:

```bash
docker compose exec api uv run seed-users
```

El email y la contraseña se toman del `.env` de la raíz o de los valores predeterminados de Compose. `docker compose down` detiene los servicios y conserva los volúmenes de datos.

<a id="como-trabajar-en-el-repo"></a>
## 🛠️ Cómo trabajar en el repo

1. Lee [`AGENTS.md`](./AGENTS.md) y los archivos de [`memory-bank/`](./memory-bank/).
2. Abre el `README.md` de la carpeta donde trabajarás y consulta su regla en [`.agents/rules/`](./.agents/rules/) si existe.
3. Implementa en la carpeta que corresponda; no añadas código suelto a la raíz.
4. Documenta lo que añadas: cada app, servicio, agente o pipeline nuevo debe tener su propia carpeta y un `README.md`.

<a id="mapa-del-monorepo"></a>
## 🗺️ Mapa del monorepo

| Área | Carpetas | Qué encontrarás |
| --- | --- | --- |
| Contexto de empresa | `CONTEXT.md`, `docs/context/` | Dominio, nombres de campos, restricciones y briefings por hito |
| Configuración de agentes | `AGENTS.md`, `.agents/`, `memory-bank/` | Instrucciones, reglas, skills y memoria del proyecto |
| Interfaces y servicios | `uis/`, `services/` | Aplicaciones frontend y backends con los que interactúan usuarios y operadores |
| Datos | `data/` | Archivos crudos, pipelines, datasets procesados y conjuntos de evaluación |
| Inteligencia artificial | `agents/`, `skills/`, `mcps/` | Agentes, capacidades reutilizables y servidores MCP |
| Automatización | `workflows/` | Flujos n8n y orquestación entre sistemas |
| Reutilización | `packages/`, `shared/` | Tipos, lógica de dominio, SDKs, esquemas y plantillas compartidos |
| Operaciones | `infra/`, `scripts/`, `internal/` | Docker, despliegue, scripts puntuales y CLIs internas |
| Documentación | `docs/` | Arquitectura, decisiones, convenciones y registro de prompts |

**Regla rápida:** si tiene interfaz visual → `uis/`; si expone una API o corre en segundo plano → `services/`; si mueve o transforma datos → `data/`; si el trabajo lo hace un modelo de IA → `agents/` (con `skills/` o `mcps/` cuando haga falta).

<a id="estado-de-los-hitos"></a>
## 📍 Estado de los hitos

| Hito | Entregable | Estado |
| --- | --- | --- |
| 1 — Web pública | Landing corporativa y formulario de captación de talento: responsive, accesible y optimizado para SEO | ✅ En [`uis/website/`](./uis/website/), con Next.js/React. El HTML estático original ya se migró y eliminó. |
| 2 — Fundamentos de programación | Modelo de dominio y lógica de scoring, matching y filtrado en TypeScript | ✅ En [`packages/domain/`](./packages/domain/) (`@repo/domain`) |
| 3 — Pipeline de talento | App interna con listado y filtros, ficha, alta y edición, notas; consume la API de 4Geek Tracker | 🚧 En [`uis/backoffice/`](./uis/backoffice/) |
| 4+ — Backend, telemetría, RAG, agentes, workflows y tiempo real | — | ⏳ Sin empezar |

`data/`, `agents/`, `mcps/`, `workflows/` e `internal/` siguen siendo estructura de plantilla. `infra/` contiene documentación de infraestructura; los Dockerfiles se mantienen junto a las aplicaciones en `uis/` y `services/`.

<a id="guia-de-carpetas"></a>
## 📂 Guía de carpetas

Lee el `README.md` de cada carpeta antes de empezar a trabajar allí.

### Archivos de la raíz

| Ruta | Propósito | Uso |
| --- | --- | --- |
| [`CONTEXT.md`](./CONTEXT.md) | Fuente única de verdad del dominio Nexova | Léelo antes de construir; solo lo cambia el desarrollador |
| [`AGENTS.md`](./AGENTS.md) | Guía operativa para agentes de IA | Lectura inicial, flujo de commit y archivos restringidos |
| `README.md` / `README.es.md` | Guía del repositorio | Orientación general |
| [`docker-compose.yml`](./docker-compose.yml) | Orquestación local | Arranca las apps Next.js, FastAPI y PostgreSQL local |

### 🖥️ `uis/` — interfaces de usuario

Contiene las aplicaciones frontend: todo lo que una persona ve y con lo que interactúa.

- Web pública → [`uis/website/`](./uis/website/)
- Administración y backoffice interno → [`uis/backoffice/`](./uis/backoffice/)
- Operaciones y directorio de proveedores → [`uis/application/`](./uis/application/)
- También caben portales de clientes, dashboards y herramientas Streamlit/Gradio.

Cada app debe tener su propio `package.json`, `README.md`, layout y una vista de entrada funcional desde el primer commit. Consulta [`uis/README.md`](./uis/README.md).

### ⚙️ `services/` — API de la empresa (FastAPI)

Aquí vive el backend centralizado de la empresa, en un único punto de entrada que reduce la complejidad al crecer.

- Pon aquí la app FastAPI principal (por ejemplo, `api/`) con routers y módulos por dominio.
- Añade workers en segundo plano solo cuando realmente necesiten ejecutarse separados de la API.
- Evita dividir el sistema en muchos microservicios al inicio.

**Excepción del repo:** [`services/incident-manager-api/`](./services/incident-manager-api/) es una segunda app FastAPI independiente, con su propio `pyproject.toml` y puerto, porque el ejercicio del gestor de incidencias pedía explícitamente un servicio nuevo. La justificación está en el `README.md` de esa carpeta. Consulta también [`services/README.md`](./services/README.md).

### 📊 `data/` — datos, pipelines y evaluación

Todo lo relacionado con datos, desde archivos crudos hasta tablas listas para producción.

| Subcarpeta | Propósito | Uso |
| --- | --- | --- |
| [`data/raw/`](./data/raw/README.md) | Datos fuente sin modificar | Dumps y CSV/JSON de ejemplo; documenta el origen y las reglas de PII |
| [`data/pipelines/`](./data/pipelines/README.md) | Jobs ETL/ELT | Scripts de ingesta, limpieza y transformación |
| [`data/process/`](./data/process/README.md) | Salidas limpias o intermedias | Artefactos de pipelines: features, agregados y tablas limpias |
| [`data/eval/`](./data/eval/README.md) | Medición de calidad | Golden sets, datasets de evaluación de RAG/agentes y métricas de experimentos |

**Flujo de datos:** `raw` → `pipelines` → `process` → consumo desde `services/`, `uis/` o `agents/`. Usa `eval` para demostrar la calidad.

### 🤖 `agents/` — agentes de IA

Asistentes autónomos o semiautónomos para la empresa.

- Crea una subcarpeta por agente (por ejemplo, `support-agent/` o `onboarding-agent/`).
- Incluye su configuración, prompts, herramientas y pruebas.
- Para empezar, usa [`agents/_template/`](./agents/_template/README.md).

> No lo confundas con [`.agents/`](./.agents/), que guarda la configuración —reglas y skills— para quienes trabajan en este repo.

Consulta [`agents/README.md`](./agents/README.md).

### 🧩 `skills/` — capacidades reutilizables para agentes

Instrucciones empaquetadas y scripts que los agentes reutilizan en el repo.

- Aquí van skills de análisis de datos, revisión de código, scraping e investigación, entre otras.
- Cada skill vive en su propia carpeta con un `SKILL.md` y, opcionalmente, scripts y recursos.
- Las skills propias del proyecto van en [`.agents/skills/`](./.agents/skills/); `skills/` y `.claude/skills/` pertenecen a la plantilla.

Consulta [`skills/README.md`](./skills/README.md).

### 🔌 `mcps/` — servidores Model Context Protocol

Conectan modelos de IA con sistemas como bases de datos, APIs, GitHub y herramientas propias. Usa una subcarpeta por servidor MCP e incluye definiciones de tools, resources y configuración.

Consulta [`mcps/README.md`](./mcps/README.md).

### 🔄 `workflows/` — automatización y orquestación

Conecta sistemas sin escribir apps completas: jobs programados, webhooks y notificaciones. Aquí van exports de n8n, configuraciones de Make/Zapier y orquestación entre `services/`, `data/pipelines/` y `agents/`.

Consulta [`workflows/README.md`](./workflows/README.md).

### 📦 `packages/` — librerías compartidas

Código versionable que reutilizan varias apps, agentes o pipelines.

- [`packages/domain/`](./packages/domain/) → `@repo/domain`: modelo y lógica del dominio de reclutamiento (Hito 2).
- [`packages/shared/`](./packages/shared/) → `@repo/shared-types` (TypeScript, tipos compartidos entre apps y servicios) y `nexova-shared` (Python, validación de incidencias y análisis compartidos por `scripts/` y `services/*`).
- También puede contener librerías de componentes UI, clientes API y SDKs de analítica.

**Regla:** si `uis/` y `services/` comparten una interfaz, extráela aquí. Consulta [`packages/README.md`](./packages/README.md).

### 🗃️ `shared/` — recursos compartidos sueltos

Para recursos que no necesitan ser un paquete completo: esquemas JSON, plantillas de email, especificaciones OpenAPI y design tokens.

Consulta [`shared/README.md`](./shared/README.md).

### 📚 `docs/` — documentación transversal

Guarda arquitectura y decisiones que abarcan el proyecto: [`docs/context/`](./docs/context/) (briefings por hito), [`docs/company-choice.md`](./docs/company-choice.md) y [`docs/prompts.md`](./docs/prompts.md) (registro de prompts). Añade aquí diagramas de arquitectura, ADRs y convenciones.

Consulta [`docs/README.md`](./docs/README.md).

### ☁️ `infra/` — infraestructura y despliegue

Documenta cómo corre el proyecto en Docker, cloud o CI. Aquí corresponden Dockerfiles, Terraform, manifiestos K8s, configuraciones Nginx y pipelines CI/CD.

Consulta [`infra/README.md`](./infra/README.md).

### 🧰 `scripts/` — scripts de ayuda

Automatización pequeña y repetible, no apps completas: scripts de configuración, generadores de datos seed y migraciones puntuales. Documenta cada script.

Consulta [`scripts/README.md`](./scripts/README.md).

### 🧑‍💻 `internal/` — herramientas internas

Utilidades robustas para el equipo de desarrollo: CLIs, herramientas de migración empaquetadas y evaluadores de prompts. Cada herramienta puede tener su propio `package.json` y pruebas.

Consulta [`internal/README.md`](./internal/README.md).

<a id="donde-pongo-esto"></a>
## 🧩 ¿Dónde pongo esto?

| Si estás creando… | Va en… |
| --- | --- |
| Una web pública | `uis/website/` |
| Una app interna para operaciones o RR. HH. | `uis/backoffice/` |
| Una app interna para proveedores y operaciones | `uis/application/` |
| Un servicio, API o cola en segundo plano | `services/` |
| Datos crudos o transformados | `data/raw/` o `data/process/` |
| Un proceso que mueve datos entre sistemas | `data/pipelines/` |
| Una evaluación de calidad de IA o pipelines | `data/eval/` |
| Un asistente de IA con un objetivo | `agents/` |
| Una regla para el trabajo de los agentes | `.agents/rules/` |
| Una skill reutilizable de agente | `.agents/skills/` |
| Estado del proyecto que deba recordarse | `memory-bank/` |
| Código importado por dos o más carpetas | `packages/` |
| Un esquema, plantilla o asset (no una librería) | `shared/` |
| Arquitectura o documentación para todo el equipo | `docs/` |
| El Dockerfile de una app o servicio | Su carpeta (`uis/` o `services/`) |
| Una guía general de infraestructura | `infra/` |
| Un script puntual | `scripts/` |
| Una CLI con su propio paquete | `internal/` |

<a id="estructura-del-repositorio"></a>
## 🌳 Estructura del repositorio

```text
nexovaSolutions/
├── README.md / README.es.md   # Guías del repositorio
├── CONTEXT.md                 # Fuente de verdad del dominio (briefing Hito 1)
├── AGENTS.md                  # Cómo trabajan los agentes de IA aquí
├── .agents/
│   ├── rules/                 # Reglas de desarrollo con alcance declarado
│   └── skills/                # Skills reutilizables y scripts verificadores
├── memory-bank/               # Memoria de negocio, técnica y estado del proyecto
├── uis/
│   ├── website/               # Web pública (Next.js) — Hito 1
│   ├── backoffice/            # Pipeline de talento (Next.js) — Hito 3
│   └── application/           # Operaciones: directorio de proveedores (Next.js)
├── packages/
│   ├── domain/                # @repo/domain — lógica de reclutamiento — Hito 2
│   └── shared/                # @repo/shared-types (TS) + nexova-shared (Python)
├── services/
│   ├── api/                   # FastAPI: incidencias (análisis CSV) y proveedores (TinyDB)
│   └── incident-manager-api/  # Incidencias persistentes (SQLAlchemy/SQLite), API y seed CSV
├── data/{raw,pipelines,process,eval}/   # Ciclo de vida del dato (vacío)
├── agents/                    # Agentes de IA y plantilla _template/ (vacío)
├── skills/ mcps/ workflows/   # Estructura de plantilla (vacía)
├── docs/                      # Contexto, company-choice.md y prompts.md
├── uis/Dockerfile             # Imagen Node Alpine y supervisor website/backoffice
├── services/Dockerfile        # Imagen Python para services/api
├── uis/.dockerignore          # Exclusiones del contexto de interfaces
├── services/.dockerignore     # Exclusiones del contexto de backend
└── scripts/ internal/ shared/ # Scripts, CLIs internas y recursos compartidos
```

<a id="enlaces-y-colaboradores"></a>
## 🔗 Enlaces y colaboradores

- [4Geeks Academy — Ingeniería de IA](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)
- [Cómo empezar un proyecto de código](https://4geeks.com/lesson/how-to-start-a-project)
- [Curso de Ingeniería de IA](https://4geeksacademy.com/es/programas-de-carrera/ingenieria-ia)
- [Otros cursos](https://4geeksacademy.com/es/comparar-programas)
- [Plantillas y recursos de 4Geeks Academy en GitHub](https://github.com/4geeksacademy)

Construido sobre la plantilla monorepo de Ingeniería de IA de 4Geeks Academy por [@marcogonzalo](https://www.linkedin.com/in/marcogonzalo), [@alezanchezr](https://x.com/alesanchezr) y muchos otros colaboradores.
