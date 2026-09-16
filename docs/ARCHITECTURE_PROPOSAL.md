# Propuesta de Arquitectura de Backend — Nexova Solutions

> Estado: propuesta para discusión. Este documento no implementa código; define el patrón arquitectónico, la estructura de carpetas y los criterios de organización que debe seguir el primer servicio backend del proyecto (`services/`), hoy inexistente.
>
> Fuentes consultadas: `AGENTS.md`, `CONTEXT.md`, `services/README.md`, `memory-bank/` (`systemPatterns.md`, `techContext.md`, `productContext.md`), `packages/domain/`, `uis/backoffice/src/services/api.ts` y `uis/backoffice/src/types/candidate.ts`.

---

## 0. Contexto de partida

Nexova Solutions es una consultora de RRHH y adquisición de talento (headhunting ejecutivo, outsourcing de atención al cliente, formación corporativa), con sede en Valencia y oficina en Miami. El monorepo ya contiene dos frontends operativos:

- **`uis/website`** (público): landing corporativa + formulario de registro de talento en 3 pasos (`/talento`). Hoy el envío del formulario **se simula** en cliente (`talent-validation.ts`); no existe todavía un endpoint real que lo reciba.
- **`uis/backoffice`** (interno, RRHH): pipeline de candidatos. Consume hoy una **API externa temporal**, la 4Geek Tracker (`https://playground.4geeks.com/tracker/api/v1`, configurable vía `NEXT_PUBLIC_API_URL`), con un contrato REST ya definido: recursos `/records` y `/records/{id}/notes`, DTO en `snake_case` (`full_name`, `linkedin_url`, `cv_url`, `experience_years`, `applied_at`…), estados (`status`: `received|in_progress|selected|discarded`; `stage`: `pending|review|personal_interview|technical_interview|offer_presented`) y errores de validación en formato FastAPI (`detail: [{msg}]`).
- **`packages/domain`** (TypeScript puro, entregable del Hito 2): modelo de dominio del pipeline de reclutamiento (`Candidate`, `Vacancy`, `SelectionProcess`) con utilidades de filtrado, búsqueda, scoring/matching y validación.
- **`services/`**: carpeta destinada a todo el backend, **hoy vacía** (solo `README.md`). El propio repositorio ya deja escrita la intención: *"una sola app FastAPI con routers por dominio, no muchos microservicios"* (`AGENTS.md`, `services/README.md`, `memory-bank/systemPatterns.md`).

Esta propuesta parte de esa intención ya fijada por el equipo y la desarrolla en un diseño concreto, en lugar de proponer alternativas que la contradigan.

---

## 1. Resumen ejecutivo y patrón arquitectónico

### Patrón elegido: arquitectura en capas organizada por dominio, dentro de un monolito modular

Se propone una **única aplicación FastAPI**, desplegada como un solo servicio, pero **organizada internamente por dominio de negocio** (no por tipo técnico de archivo) y con una separación en capas dentro de cada dominio: enrutamiento HTTP → esquemas de entrada/salida → lógica de negocio → persistencia.

### Por qué este patrón y no otro

- **Escala del proyecto y del equipo.** Nexova está en una fase temprana: dos frontends ya construidos y un backend que arranca de cero. Microservicios reales (despliegue, observabilidad y contratos independientes por servicio) añadirían costo operativo que ningún dominio actual justifica todavía. El propio `services/README.md` ya lo advierte: *"Recommendation: avoid splitting into many microservices early."*
- **Dominios de negocio ya identificables y estables.** El repo evidencia como mínimo cuatro capacidades de negocio con forma de recurso HTTP: captación de leads de talento (Hito 1), pipeline de candidatos (Hito 3), vacantes y procesos de selección con scoring (Hito 2), y autenticación de usuarios internos del backoffice. Organizar el código por estos dominios permite que cada uno crezca, se pruebe y se documente de forma aislada sin necesitar un servicio propio.
- **Se descarta MVC clásico**: no hay vistas server-rendered que devolver desde el backend; el backend es puramente una API consumida por SPAs Next.js ya desacopladas.
- **Se descarta Domain-Driven Design (DDD) o arquitectura hexagonal "completa"** (capas de dominio puro, puertos y adaptadores, agregados explícitos): son patrones pensados para dominios de negocio complejos con múltiples equipos y reglas cambiantes; aquí se toma prestado únicamente el criterio más valioso de DDD —**delimitar el código por dominio/bounded context**— sin la sobrecarga de sus capas adicionales, que sería sobre-ingeniería para el alcance actual.
- **Camino de evolución claro.** Si en el futuro un dominio (por ejemplo, el RAG de atención al cliente o el scoring de candidatos con IA, mencionados en `docs/company-choice.md`) necesita escalar o desplegarse de forma independiente, la separación por dominio dentro del monolito hace esa extracción a un servicio propio mucho más barata que si el código estuviera mezclado por tipo técnico.

---

## 2. Estándares FastAPI y ecosistema de referencia

La comunidad de FastAPI ha convergido en una convención de facto para proyectos medianos que abandona la estructura clásica "por tipo de archivo" (`routers/`, `models/`, `schemas/` como carpetas planas con un archivo por cada recurso) en favor de una estructura **"por módulo/dominio"**, donde cada carpeta de dominio agrupa todo lo que le pertenece. Los elementos estándar que esta propuesta adopta son:

- **Configuración centralizada** (`core/config.py`) usando `pydantic-settings`, que valida variables de entorno al arrancar la aplicación en vez de leerlas de forma dispersa.
- **Gestión de la base de datos aislada** (`core/database.py`): motor/engine, fábrica de sesiones y la función de dependencia que las inyecta en cada request.
- **Separación estricta entre esquema de API y modelo de persistencia**: los modelos Pydantic (`schemas.py`, lo que viaja por HTTP) nunca son los mismos objetos que los modelos de base de datos (`models.py`, ORM). Esta separación ya existe como principio en el propio repo —`techContext.md` distingue deliberadamente el modelo de dominio (`packages/domain`) del DTO de API (`uis/backoffice/src/types/candidate.ts`)— y FastAPI la estandariza también en el backend.
- **Inyección de dependencias explícita** (`Depends`) para sesión de base de datos, usuario autenticado, paginación y filtros comunes, en vez de resolver esas dependencias manualmente dentro de cada endpoint.
- **Versionado de API por prefijo de router** (`/api/v1/...`), registrado una sola vez en el punto de entrada de la aplicación.
- **Lógica de negocio fuera de las funciones de endpoint** (`service.py`), de forma que los routers queden como una capa delgada de traducción HTTP ↔ dominio, y la lógica sea testeable sin levantar un servidor.

### Cómo influyen estas convenciones en la decisión final

Estas prácticas no son un añadido cosmético: son exactamente lo que hace viable el patrón elegido en la sección 1. La separación router/schema/service/model es la que permite que "una sola app FastAPI organizada por dominio" no degenere en un archivo monolítico de miles de líneas por dominio, y es la que traza, dentro de cada carpeta de dominio, la frontera en capas (HTTP → validación → negocio → datos) que esta propuesta exige.

---

## 3. Arquitectura desacoplada (frontend y backend independientes)

`uis/website` y `uis/backoffice` ya son aplicaciones Next.js completamente independientes del backend (se despliegan, versionan y ejecutan por separado). El backend nuevo debe preservar y formalizar ese desacoplamiento:

- **CORS.** El backend debe declarar una lista explícita de orígenes permitidos por entorno (`http://localhost:3000` y `3001` en desarrollo; el dominio de Netlify de `uis/website` y el dominio donde se despliegue `uis/backoffice` en producción), nunca un wildcard (`*`), dado que el backoffice manejará autenticación y datos internos de candidatos.
- **Contrato de API y versionado.** Se recomienda mantener el mismo esquema que el backoffice ya consume hoy contra la API externa: prefijo `/api/v1`, payloads en `snake_case`, y errores de validación en el formato que ya entiende `uis/backoffice/src/services/api.ts` (`detail: [{msg}]`, propio de FastAPI). Esto no es una preferencia estética: es lo que permite migrar el backoffice de la API externa (4Geek Tracker) al backend propio cambiando solo la variable de entorno `NEXT_PUBLIC_API_URL`, sin reescribir la capa de servicios del frontend. Cualquier cambio de contrato futuro debe introducirse como una nueva versión (`/api/v2`) y no como una modificación silenciosa de `/api/v1`.
- **Autenticación y autorización.** Los dos frontends tienen necesidades distintas y deben tratarse como dominios de acceso distintos:
  - `uis/website` (público): el alta de leads de talento no requiere autenticación de usuario; solo protección básica contra abuso (rate limiting) a nivel de endpoint.
  - `uis/backoffice` (interno, RRHH): requiere autenticación de usuarios internos (por ejemplo, OAuth2 con JWT de acceso/refresco) y, a futuro, control de permisos por rol si se distingue entre reclutadores y administradores.
- **Variables de entorno y configuración por entorno.** El frontend ya sigue el patrón de exponer la URL de API vía variable de entorno (`NEXT_PUBLIC_API_URL`, ver `uis/backoffice/.env.example`). El backend debe seguir el mismo principio en la dirección opuesta: toda configuración sensible o dependiente de entorno (cadena de conexión a base de datos, secreto de JWT, orígenes CORS permitidos) vive en variables de entorno propias del servicio (`services/api/.env`), nunca hardcodeada ni compartida con el `.env` de los frontends. `.env*.local` ya está en `.gitignore` a nivel de repo; el backend debe respetar la misma disciplina.
- **Despliegues independientes.** `uis/website` ya se despliega como export estático de Next.js en Netlify (`netlify.toml`, `base = "uis/website"`, sin runtime de servidor). El backend, al requerir un runtime Python persistente, necesita un proveedor de hosting distinto (tipo Render, Railway o similar) con su propio pipeline de CI/CD, ciclo de versionado y variables de entorno, completamente independiente del despliegue del frontend. `uis/backoffice` tampoco se despliega hoy (es una app interna); cuando se despliegue, debe hacerlo también de forma independiente del backend.

---

## 4. Estructura de carpetas y módulos del backend

### Ubicación y nombre del servicio

Siguiendo el criterio ya documentado en `services/README.md` ("cada subcarpeta de `services/` corresponde a un servicio, con su propia documentación"), el backend vive en **`services/api/`**.

### Árbol propuesto

```
services/api/
├── README.md
├── pyproject.toml (o requirements.txt)
├── .env.example
└── app/
    ├── main.py                  # instancia FastAPI, registro de routers, middlewares (CORS)
    ├── core/
    │   ├── config.py            # settings (pydantic-settings)
    │   ├── database.py          # engine, sesión, dependencia get_db
    │   └── security.py          # hashing, JWT, dependencias de autenticación
    ├── shared/
    │   ├── exceptions.py        # excepciones de negocio comunes y sus handlers
    │   └── pagination.py        # esquema y utilidades de paginación/filtrado comunes
    └── domains/
        ├── talent_leads/        # captación de talento (Hito 1, uis/website)
        │   ├── router.py
        │   ├── schemas.py
        │   ├── service.py
        │   └── models.py
        ├── candidates/          # pipeline de candidatos (Hito 3, uis/backoffice)
        │   ├── router.py
        │   ├── schemas.py
        │   ├── service.py
        │   └── models.py
        ├── vacancies/           # vacantes (Hito 2)
        │   ├── router.py
        │   ├── schemas.py
        │   ├── service.py
        │   └── models.py
        ├── selection_processes/ # procesos de selección, scoring/matching (Hito 2)
        │   ├── router.py
        │   ├── schemas.py
        │   ├── service.py
        │   └── models.py
        └── auth/                # autenticación de usuarios internos (backoffice)
            ├── router.py
            ├── schemas.py
            ├── service.py
            └── models.py
tests/
└── domains/                     # estructura de tests en espejo a app/domains/
```

### Criterio de separación

La separación es **por capacidad de negocio (dominio)**, no por tipo técnico. Cada carpeta bajo `app/domains/` corresponde a un límite de negocio ya visible en el repo actual, no a una decisión arbitraria:

- `talent_leads` corresponde al formulario de `CONTEXT.md` / `uis/website/talento`.
- `candidates` corresponde al DTO y a las operaciones ya consumidas por `uis/backoffice/src/services/api.ts`.
- `vacancies` y `selection_processes` corresponden a las entidades `Vacancy` y `SelectionProcess` de `packages/domain/src/types/models.ts`.
- `auth` es transversal a `uis/backoffice` pero se trata como dominio propio porque tiene su propio ciclo de vida (usuarios, sesiones, permisos), no porque sea "infraestructura" a mezclar en `core/`.

`core/` y `shared/` contienen exclusivamente lo que **ningún dominio posee en solitario** (conexión a base de datos, seguridad transversal, paginación genérica): no deben convertirse en el lugar donde acaba la lógica de negocio que no se supo dónde ubicar.

### Relación con `packages/domain` (TypeScript)

`packages/domain` ya implementa en TypeScript scoring, matching y validaciones sobre `Candidate`/`Vacancy`/`SelectionProcess` como entregable del Hito 2. El backend Python **no puede importar ese código** (son runtimes distintos), lo que crea el riesgo de mantener dos implementaciones de las mismas reglas de negocio. Se recomienda que, a partir de la existencia de `services/api`, **la lógica de `selection_processes/service.py` en Python sea la única fuente de verdad productiva** para scoring y matching; `packages/domain` se conserva como lo que ya es —el entregable de aprendizaje del Hito 2— y no como una dependencia que el backend deba replicar constantemente. Si en el futuro se necesita compartir tipos entre frontend y backend, ese contrato debe vivir en la definición de los `schemas.py` de FastAPI (que generan OpenAPI/JSON Schema) y no en el código TypeScript de `packages/domain`.

---

## 5. Organización de routers y endpoints por dominio

*(Descripción estructural; no se incluyen bloques de código con la implementación de endpoints.)*

- **Un router por dominio.** Cada carpeta bajo `app/domains/` expone un único `APIRouter` en su `router.py`, registrado una sola vez en `app/main.py` con un prefijo de recurso bajo `/api/v1` y una etiqueta (`tags=[...]`) para la documentación automática de OpenAPI.
- **Recursos propuestos y su prefijo:**
  - `/api/v1/talent-leads` — alta pública de leads de talento (dominio `talent_leads`), sin autenticación.
  - `/api/v1/candidates` y su sub-recurso `/api/v1/candidates/{id}/notes` — pipeline de candidatos y sus notas internas (dominio `candidates`), con autenticación de backoffice.
  - `/api/v1/vacancies` — gestión de vacantes (dominio `vacancies`).
  - `/api/v1/selection-processes` — procesos de selección y su avance por etapas, incluido el scoring (dominio `selection_processes`).
  - `/api/v1/auth` — login, refresco de token y gestión de sesión de usuarios internos (dominio `auth`).
- **Convención de nombres de archivo dentro de cada dominio**, consistente en los cinco dominios para que cualquier desarrollador sepa dónde buscar sin memorizar excepciones:
  - `router.py` — únicamente definición de rutas HTTP y llamadas a `service.py`; sin lógica de negocio.
  - `schemas.py` — modelos Pydantic de entrada (`*Create`, `*Update`) y salida (`*Read`/`*Out`), incluyendo los esquemas de paginación de listados.
  - `service.py` — reglas de negocio y orquestación (validaciones no triviales, cálculo de scoring, transiciones de `stage`/`status` permitidas).
  - `models.py` — modelos de persistencia (ORM), separados de `schemas.py` según el estándar descrito en la sección 2.
- **Criterio de agrupación de endpoints dentro de un router**: se agrupan por el mismo recurso raíz y sus sub-recursos directos (por ejemplo, notas de un candidato viven dentro del router de `candidates`, no en un router propio), evitando routers "utilitarios" que mezclen recursos sin relación.
- **Compatibilidad de listados.** Los endpoints de listado (`GET /candidates`, `GET /vacancies`, etc.) deben soportar los mismos parámetros de consulta que el backoffice ya usa contra la API externa (`search`, `status`, `stage`, `limit`, página), definidos como un esquema de query compartido en `shared/pagination.py`, para que la migración del backoffice al backend propio no requiera cambios en la UI ya construida.

---

## 6. Riesgos y puntos de fallo

1. **Fragmentación prematura en microservicios o mezcla de carpetas por tipo técnico.** Si el equipo, ante la presión de nuevas funcionalidades, empieza a crear servicios independientes por cada dominio (o revierte a una estructura plana de `routers/`, `models/`, `schemas/` como carpetas globales), se pierde exactamente la ventaja que este documento busca: un único punto de despliegue y configuración, con fronteras de dominio claras pero baratas de mantener. El costo no es solo estético — implica duplicar configuración de CORS, autenticación y base de datos en cada servicio nuevo, y contradice una decisión que el propio repositorio ya documentó (`AGENTS.md`, `services/README.md`). El riesgo se materializa de forma silenciosa: cada excepción parece razonable de forma aislada, pero la suma erosiona la arquitectura sin que nadie tome la decisión explícitamente.

2. **Divergencia entre las reglas de negocio en TypeScript (`packages/domain`) y en el backend Python.** Si scoring, matching o las reglas de transición de etapa se reimplementan en `selection_processes/service.py` sin declarar explícitamente cuál de las dos implementaciones es la autoritativa, es solo cuestión de tiempo antes de que ambas diverjan (una regla de validación se corrige en un lado y no en el otro) y el sistema produzca resultados de negocio distintos según si se calculan en la demo del Hito 2 o en producción. Esto ya es una tensión conocida y documentada en `memory-bank/techContext.md`; ignorarla no la resuelve, solo la posterga hasta que aparezca como un bug difícil de rastrear porque "los números no coinciden".

3. **Ruptura del contrato que `uis/backoffice` ya consume.** El backoffice fue construido contra un contrato externo concreto (nombres de campo en `snake_case`, valores de `status`/`stage`, formato de error de FastAPI). Si el backend propio se implementa sin mapear cuidadosamente ese contrato —por ejemplo, cambiando nombres de campo "porque ahora sí controlamos la API" o alterando el formato de error sin versionar— la migración de `NEXT_PUBLIC_API_URL` de la API externa al backend propio dejará de ser un cambio de una línea y se convertirá en una regresión visible en una interfaz ya terminada y en uso, sin que el equipo de frontend haya tocado su código.
