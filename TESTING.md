# 🧪 TESTING — Batería de pruebas de Nexova Solutions

> 📅 **Ejecución:** 2026-10-16 · 🌿 **Rama:** `feature/backoffice-inventory-management`
> 🐍 Python 3.14.8 (`uv` 0.12.22) · 🟢 Node v24.18.1 · 🛠️ `pytest` + 🃏 Jest

> 🔄 Integración del 20/10/2026: backoffice **148 pruebas en 11 suites**, todas
> correctas (14,85 s), tras unir las 140 de `main` con las ocho de auditoría.
> Lint/build de ambos frontends y revisión de textos correctos. Los resultados
> Python, application y coberturas que siguen conservan su fecha histórica;
> no se han vuelto a ejecutar en esta integración del PR.

> Integración del 02/11/2026 (`feature/docker-supabase`): API **404 passed / 1
> skipped**, 70,98 s, con dotenv y conexiones remotas desactivados y TinyDB
> temporal. La omisión existente corresponde a concurrencia PostgreSQL, que
> requiere una base de pruebas aislada. No se añadieron pruebas ni dependencias.

🎯 Las pruebas verifican la **lógica** (reglas, permisos, validaciones y errores).
🚫 No prueban la serialización HTTP (CORS, cabeceras, JSON mal formado). La auditoría
añade cinco pruebas del selector React accesible y tres de las URLs de precarga.

> Integración del 03/11/2026 (`feature/telemetry-report-endpoint`): API **509 passed / 1 skipped** (78,09 s; 510 recopiladas). Backoffice **182 pruebas en 21 suites**. Lint, build y revisión de textos del backoffice en verde.

> Integración del 10/11/2026 (`feature/resilient-business-performance-pipeline`): API **528 passed / 1 skipped** (83,83 s; 529 recopiladas) con `PYTHON_DOTENV_DISABLED=1`. Pipeline **16 passed**, incluida la ejecución del CLI dos veces sobre SQLite sintético y aislado. PostgreSQL real no estuvo disponible en el entorno local.

> Integración del 11/11/2026 (Parte 3): **44 pruebas de pipelines** correctas (45,59 s), incluyendo 17 de tasks aisladas y dos ejecuciones CLI reales. Backoffice **207 pruebas en 23 suites** (27,91 s), lint/build y revisión de textos correctos. El ejecutor de raíz completa sus **4 grupos** (143,98 s): API, incident-manager, shared y pipelines. Se conserva la omisión PostgreSQL preexistente; no se añade ningún skip.

## 📌 Índice

1. [🏆 Resumen](#-resumen)
2. [🚀 Cómo ejecutarlas](#-cómo-ejecutarlas)
3. [🚦 Cómo leer el resultado](#-cómo-leer-el-resultado)
4. [📝 Plan de pruebas y por qué](#-plan-de-pruebas-y-por-qué)
5. [🔍 Qué se prueba, por área](#-qué-se-prueba-por-área)
6. [🤖 Flujo asistido por IA y bugs detectados](#-flujo-asistido-por-ia-y-bugs-detectados)
7. [💥 Ejemplo real de un fallo](#-ejemplo-real-de-un-fallo)
8. [📌 Comportamientos fijados](#-comportamientos-fijados)
9. [📈 Cobertura](#-cobertura)
10. [➕ Añadir una prueba](#-añadir-una-prueba)

---

## 🏆 Resumen

| 🧩 Área | ⌨️ Comando | 🔢 Pruebas | 🚦 Resultado | ⏱️ Tiempo | 📈 Cobertura |
| --- | --- | ---: | :---: | ---: | ---: |
| 🐍 `services/api` | `uv run pytest`* | 529 | ✅ 528 · ❌ 0 · ⏭ 1 | 83,83 s | — |
| 🐍 `data/pipelines` + `tests/pipelines` | `uv run --project services/api python -m pytest tests/pipelines data/pipelines/tests` | 44 | ✅ 44 · ❌ 0 | 45,59 s | — |
| 🐍 `services/incident-manager-api` | `uv run pytest` | 217 | ✅ 217 · ❌ 0 | 1,5 s | 98 % |
| 🟦 `uis/application` | `npx jest --coverage` | 143 | ✅ 143 · ❌ 0 | 1,1 s | 99,8 % |
| 🟦 `uis/backoffice` | `npm test -- --runInBand` | 207 | ✅ 207 · ❌ 0 | 27,91 s | — |
| 🏁 **Total documentado** | | **1140** | ✅ **1139** · ❌ **0** · ⏭ 1 | | |

\* En la ejecución del 10/11/2026 `uv` no pudo inicializar su caché global y tampoco pudo
resolver `setuptools` desde PyPI en la caché temporal; se ejecutó la misma suite
con `services/api/.venv/Scripts/python.exe -m pytest -p no:cacheprovider`.

| ✅ Otras comprobaciones | 🟦 `uis/application` | 🟦 `uis/backoffice` |
| --- | :---: | :---: |
| `npm run lint` | ✅ | ✅ |
| `npm run build` | — | ✅ |
| 🔤 Verificador `revision-textos-ui` | ✅ PASS | ✅ PASS |

### Captura de telemetría — fases 1, 2 y 3 (02/11/2026)

La captura añade `test_telemetry.py` (envelope, lotes y puente HMAC),
`test_telemetry_capture.py` (17 casos de productores, expiración verificada,
rechazo de stock/acceso, privacidad, correlación y fallo del receptor), pruebas
del servicio, observador, hook de flujos y componentes de catálogo/entrada.
Los eventos capturados se validan contra el JSON aprobado con Ajv existente.
La prueba de contrato del servidor invoca Node: ejecutar `npm ci` en
`uis/backoffice` antes de esa suite para disponer del Ajv del tooling.
El servicio comprueba 20 eventos/10 segundos, Beacon, reintentos, descarte,
concurrencia, identidad opcional, privacidad, límites, correlación y sesión.
Los componentes comprueban que solo una respuesta correcta completa el flujo y
que filtros fallidos no inventan resultados; errores y Web Vitals usan códigos
y métricas del contrato.

Resultado actual: API 476 passed / 1 skipped y backoffice 176 pruebas en 19
suites. TypeScript, lint, build y revisión de textos correctos; 9.450 checks del
contrato en verde. La API no configura un linter ni type-checker independiente.
Las pruebas desactivan dotenv y conexiones remotas, usan TinyDB temporal y
fixtures SQLite; no disparan escrituras en Supabase real. El transporte frontend
se simula. Prueba real adicional: proxy Docker → stub, lote sintético de dos
eventos 200/received 2 y vacío 200/received 0, contexto HMAC 200 y request ID
conservado. Inventario de solo lectura 6 productos/7 órdenes, usuarios idénticos.
La captura visual de DevTools queda como marcador en
[`capture-pr.md`](docs/telemetry/capture-pr.md).

El cierre añade `test_telemetry_inventory.py` (19 casos) y
`test_telemetry_demo_seed.py` (5 casos). Los cinco obligatorios se capturan desde
rutas reales en SQLite y validan contra el JSON aprobado. Se comprueban rollback
sin publicación, cruce/rearme, comparación estricta ±10%, referencia ponderada,
ventana de 90 días, separación de proveedor/oficina/moneda y ausencia de metadatos.
El seed prueba veinte entradas, separación de originales, idempotencia y rechazo
de URL remota antes de leer credenciales. Sin dependencias nuevas.

### Almacenamiento de eventos de telemetría (03/11/2026)

`test_telemetry_storage.py` comprueba las ocho columnas, índices, allowlist de
`tags`, rechazo individual de inválidos, persistencia y que un lote genera una
sola sentencia `INSERT`. También verifica que un fallo de base de datos devuelva
503 en lugar de confirmar eventos no persistidos. Resultado: API 490 passed /
1 skipped; cliente de telemetría del backoffice 15/15 y verificador de contrato
9.450/9.450.

La migración remota se aplicó tras autorización explícita. La tabla quedó con
las ocho columnas, los índices de `timestamp`, `event_type` y GIN de `tags`, RLS
activa y sin permisos para `PUBLIC`, `anon`, `authenticated` ni `service_role`.
Las cuatro filas anteriores se conservaron y sus dimensiones permitidas se
trasladaron a `tags`.

Verificación real: el backoffice registró una entrada y una salida de una unidad
del producto DEMO `DEMO-TEL-001`, y almacenó eventos técnicos de los flujos.
La consulta directa a Supabase confirmó `event_type`, `timestamp` y `tags` para
eventos técnicos y de negocio. El lote mixto con un evento válido y otro inválido
respondió `{"received":2,"stored":1,"rejected":1}`. La captura de cinco filas
se adjunta a la descripción del PR. No hubo cambios bajo `uis/`.

La carga DEMO real fue una acción autorizada independiente de pytest: seis
productos y veinte entradas con procedencia sintética; backup de public
restaurado en PostgreSQL aislado antes de escribir, originales y usuarios
idénticos por firma. Repetición cero filas nuevas; veinte eventos de entrada y
dos variaciones de coste en el stub. [Detalle](docs/telemetry/demo-data.md).
No se simula una captura DevTools: Computer Use se detuvo al verificar la URL de
Chrome, incluso con la ventana maximizada. El marcador visual continúa pendiente.

### Integración manual de Docker y Supabase — 02/11/2026

| Comprobación | Resultado |
| --- | --- |
| `docker compose config` | API/UI únicamente; URL Supabase obligatoria y secretos de autenticación del backend. |
| Configuración sin `SUPABASE_DATABASE_URL` | Rechazo antes de arrancar contenedores. |
| Login por `localhost:3001/_nexova-api` y `GET /auth/me` | 200; administrador existente, activo. |
| Lecturas de inventario por el mismo proxy | 200; 6 productos, 7 órdenes y 7 creadores resueltos. Filtros: Valencia 4 productos, Miami 2. |
| Persistencia y conexión | Archivo de usuarios idéntico antes/después; UUID y hashes conservados. TLS y transacciones de auditoría de solo lectura. Inventario real: 6 activos, 4 entradas y 3 salidas. |
| Perfil opcional | `/profiles/me` devuelve 404 porque la cuenta aún no tiene perfil; no impide login ni inventario. |
| Estado de servicios | API saludable; web y backoffice disponibles. PostgreSQL local anterior detenido con su volumen conservado. |

Las comprobaciones reales solo emitieron tokens de sesión y realizaron lecturas;
no crearon usuarios, perfiles ni movimientos. No se ejecutaron seeds ni migraciones.

---

## 🚀 Cómo ejecutarlas

```bash
# 🏠 Todo el backend Python desde la raíz del repo (4 grupos, cada uno en su entorno)
uv run pytest                                  # ⏱️ ~1,5 min

# 🐍 Una suite concreta (Python)
cd services/api && uv sync && uv run pytest
cd services/incident-manager-api && uv sync && uv run pytest

# 🟦 Frontends (TypeScript) — Jest con cobertura
cd uis/application && npm install && npx jest --coverage
cd uis/backoffice && npm install && npx jest --coverage
```

| 🎛️ Quiero… | ⌨️ Comando |
| --- | --- |
| 📄 Un solo archivo | `uv run pytest tests/test_api_status.py` · `npx jest incidents-api` |
| 🔎 Filtrar por nombre | `uv run pytest -k "login"` |
| 📈 Ver cobertura | `uv run pytest --cov --cov-report=term-missing` · `npx jest --coverage` |

ℹ️ El `pyproject.toml` de la raíz solo orquesta: `tests/test_suites.py` lanza `uv run --directory <área> pytest` para `services/api`, `services/incident-manager-api` y `packages/shared`. Los servicios no pueden compartir un único proceso porque definen módulos con el mismo nombre (`main`, `models`, `config`).

🛡️ **Seguras de ejecutar:** cada prueba usa bases temporales (TinyDB / SQLite),
no envía emails y en Jest `fetch` es un doble de prueba. No tocan datos reales
ni necesitan ninguna API levantada.

---

## 🚦 Cómo leer el resultado

| 🚥 Situación | 👀 Qué ves | 💡 Qué significa | 🛠️ Qué hacer |
| --- | --- | --- | --- |
| ✅ **Todo pasa** | `369 passed` (pytest) · `Tests: 143 passed` (Jest) | Las reglas de negocio siguen cumpliéndose. | 🎉 Nada: se puede commitear. |
| ❌ **Una prueba falla** | `FAILED archivo::prueba` y líneas `E` (pytest) · `✕ prueba` con `Expected` / `Received` (Jest) | Una regla dejó de cumplirse, o cambió a propósito. | 🔧 Corregir el código; si el cambio es intencionado, actualizar la prueba. |
| ⚠️ **No arranca** | `ERROR` (pytest) · `Test suite failed to run` (Jest) | Import, fixture o tipo roto antes de ejecutar. | 🔎 Leer el traceback: suele ser una dependencia o una firma cambiada. |

---

## 📝 Plan de pruebas y por qué

Antes de escribir código se listaron, por endpoint, los casos de los tres niveles
exigidos. La IA ayudó a generar el boilerplate y a sugerir casos límite.

### 🔐 Endpoints de autenticación (AUTH-088)

| 🌐 Endpoint | 🟢 Camino feliz | 🟡 Caso límite | 🔴 Modo de fallo | 📄 Dónde |
| --- | --- | --- | --- | --- |
| `POST /users` (registro) | Crea usuario con rol `user`, activo, solo se guarda el hash | Contraseña de 7 (rechaza) y 8 caracteres (acepta); email con distinto *casing*; perfil con nombre de 1 carácter | Email duplicado → 409 y no se crea nada; email inválido; campos de sistema (`role`, `is_active`) → 422 | `test_accounts_rules.py` |
| `POST /auth/login` | Credenciales correctas → token usable en `/auth/me` | Email con mayúsculas distintas | Contraseña mala, usuario inexistente y usuario inactivo dan **el mismo mensaje** (no revela cuál falló) | `test_accounts_rules.py` |
| `GET /auth/me` | Devuelve el usuario del token | — | Cabeceras mal formadas, token manipulado, **token expirado**, de otro tipo, con huella de contraseña obsoleta, usuario borrado o desactivado | `test_accounts_rules.py` · `test_security_logic.py` |
| `POST /auth/forgot-password` | Genera token de reset | Email inexistente responde **igual** que uno existente (anti-enumeración) | Más de 5 intentos → 429 | `test_password_reset.py` |
| `POST /auth/reset-password` | Cambia la contraseña con el token | Contraseña nueva en el límite de la política | Token basura, **token de acceso usado como reset**, token ya usado, misma contraseña, contraseña débil (cada regla) | `test_password_reset.py` · `test_security_logic.py` |
| `POST /auth/change-password` | Cambia la contraseña y devuelve un token nuevo | Contraseña nueva igual a la actual | Contraseña actual incorrecta → 401; sin sesión; contraseña débil; el token viejo deja de valer | `test_password_reset.py` |
| 🧩 **Funciones de seguridad** (sin HTTP) | Hash con sal verificable; JWT con `sub`, `type` y huella | `alg: none`, firma alterada, expiración en el pasado | Contraseña errónea, secreto distinto, token sin `sub` | `test_security_logic.py` |

### 🧭 Resto del backend (extra API-042) y frontend (extra FE-019)

| 🧩 Área | 🟢 Feliz | 🟡 Límite | 🔴 Fallo |
| --- | --- | --- | --- |
| 🏭 Proveedores | Alta/lectura/cambio/borrado | Tarifa `0,01`, país↔moneda, fechas bisiestas | Datos inválidos → 422, id inexistente → 404, sin sesión → 401 |
| 📊 Analizador CSV | Resumen correcto | Descripción de 5 caracteres, puntuación 1 y 5 | Archivo vacío, no UTF-8, columnas que faltan |
| 🚨 Gestor de incidencias | Alta y ciclo de vida | Estados finales, enums exactos, filtros combinados | Transiciones inválidas, filtros vacíos, id inexistente |
| 🟦 Clientes TypeScript | Mapeo DTO → modelo, token adjuntado | Filtros vacíos omitidos, `localStorage` bloqueado | Red caída, 401 con sesión, errores en español sin texto crudo |

### 🎯 Por qué estos casos (y no otros)

| 💭 Criterio | 📝 Decisión |
| --- | --- |
| 🧠 Lógica, no framework | Se prueba lo que el endpoint **decide** (reglas, permisos, mensajes), no cómo responde. Se eliminaron las pruebas que solo comprobaban que FastAPI convierte un id `abc` a entero o exige un campo de formulario. |
| 🔐 Seguridad primero | Más casos en auth: es donde un fallo silencioso (como el del enunciado: expiración de tokens) cuesta más. |
| 🧱 Límites del dominio | Cada regla se prueba justo en su borde (7/8 caracteres, 5 caracteres, puntuación 1–5, estados finales). |
| 📌 Fijar lo discutible | Lo que el código hace hoy y quizá deba cambiar se documenta con `# Comportamiento actual:` en vez de esconderse. |

---

## 🔍 Qué se prueba, por área

Cada tabla indica **qué se comprueba**, **qué significa que pase** y **qué
significaría que falle**. Todas las pruebas de esta ejecución pasan (✅).

### 🐍 `services/api` — inventario de suites (resultado actual: 528 aprobadas + 1 omitida)

| 📄 Archivo | 🔢 | 🧪 Qué comprueba | ✅ Si pasa | ❌ Si falla | 🚦 |
| --- | ---: | --- | --- | --- | :---: |
| 🏭 `test_suppliers.py` | 27 | Proveedores: casos base y seed. | El directorio funciona. | Se rompió un flujo básico. | ✅ |
| 🏭 `test_suppliers_rules.py` | 95 | Reglas país↔moneda, límites de tarifa y fechas, filtros, borrado, protección. | El directorio respeta sus reglas. | Se aceptan datos inválidos (p. ej. España con USD) o se rechazan válidos. | ✅ |
| 📊 `test_incidents_analyze.py` | 58 | 7 reglas de invalidez del analizador CSV y sus límites, agregados, errores de archivo y exportación (**protegida con login**). | El resumen es correcto y nunca expone filas ni emails. | Un ticket inválido cuenta como válido y los porcentajes salen mal. | ✅ |
| 👤 `test_accounts_rules.py` | 98 | Registro, login, permisos propio/admin, perfiles, rutas protegidas vs. públicas (incluye reporting). | Cada usuario solo accede a lo suyo. | Alguien leería/borraría datos ajenos o una ruta quedaría abierta. | ✅ |
| 📈 `test_reporting.py` | 12 | Autorización admin, contrato KPI, semana ISO, errores seguros y delegación a Prefect. | Dashboard y operaciones usan el contrato aprobado. | Lectura/ejecución no autorizada o respuesta incompatible. | ✅ |
| 🔐 `test_security_logic.py` | 36 | Política de contraseñas, hash, JWT (expiración, firma, tipo, huella), `get_current_user`. | Tokens falsos o caducados se rechazan. | Se aceptaría un token falso o una contraseña débil. | ✅ |
| 🔑 `test_password_reset.py` | 25 | Olvidé / restablecer / cambiar contraseña; token de un solo uso. | El reset es seguro y no revela qué emails existen. | Un token se podría reutilizar o se filtrarían emails. | ✅ |
| 🔓 `test_auth.py` | 13 | Registro y login base. | Los flujos principales funcionan. | Se rompió un flujo básico. | ✅ |
| 👥 `test_users.py` | 8 | Permisos base de usuarios. | Se respeta propio/admin. | Un usuario accedería a otro. | ✅ |
| 🪪 `test_profiles.py` | 4 | Perfiles base. | Crear/leer perfil funciona. | Se rompió el perfil. | ✅ |
| ⏳ `test_rate_limit.py` | 4 | Límite de intentos. | Se frena la fuerza bruta. | Intentos ilimitados. | ✅ |
| 🛡️ `test_protected_routes.py` | 3 | 401 sin sesión. | Las rutas protegidas exigen login. | Una ruta queda abierta. | ✅ |
| 🙈 `test_error_handling.py` | 1 | Un 500 no expone detalles internos. | No se filtra información. | Un fallo mostraría datos internos. | ✅ |
| 📦 `test_inventory.py` | 29 + 1 omitida | Caché de productos y órdenes, filtros, invalidación tras escrituras, autorización en aciertos y pruebas aisladas con SQLite. | Las lecturas repetidas se reutilizan y reflejan cambios confirmados; una sesión sigue siendo obligatoria. | Una variante colisiona, una escritura deja datos obsoletos o un acierto evita el login. | ✅ |
| ⏱️ `test_request_timing.py` | 2 | Registra método, ruta, estado y duración sin query string; permite desactivarlo por entorno. | El log contiene tiempos sin valores de parámetros. | Faltan mediciones o se filtra la query. | ✅ |
| 🧠 `test_response_cache.py` | 4 | TTL controlable, claves independientes, invalidación, barrera ante cargas obsoletas, copia de valores, errores y límite LRU. | La caché caduca, invalida y mantiene memoria acotada. | Se reutiliza un valor vencido o crece sin límite. | ✅ |

### 🐍 Pipelines — 44 pruebas

| 📄 Archivo | 🔢 | 🧪 Qué comprueba | ✅ Si pasa | ❌ Si falla | 🚦 |
| --- | ---: | --- | --- | --- | :---: |
| `test_business_performance.py` | 11 | Contratos KPI, deduplicación, monedas, ventanas ISO UTC, costes y conteos. | Se calculan únicamente los cuatro KPI aprobados. | Se inventan datos o se suma una métrica de forma incorrecta. | ✅ |
| `test_pipeline_orchestration.py` | 15 | Retries, caché persistente con clave válida en Windows, seis subflows, orden y argumentos, fases de fallo, lock, fuente vacía y fallo opcional. | Prefect continúa ante fallos opcionales y deja checkpoints seguros. | Una task falla silenciosamente o repite trabajo costoso. | ✅ |
| `test_pipeline_cli_integration.py` | 1 | Ejecuta el CLI real dos veces; comprueba caché persistida, upsert estable, fuente intacta, auditoría y backup restaurable. | La segunda corrida conserva la fila KPI sin duplicarla ni cambiarla. | Repetir una semana altera o duplica el reporte. | ✅ |

| `tests/pipelines/test_pipeline.py` | 17 | Tres tasks mediante `.fn`: costo exacto, conteos, monedas, duplicados, datos inválidos y validación de los cuatro totales. | Las transformaciones se verifican en memoria sin BD ni APIs. | Un dato inválido altera el reporte o un KPI cambia de definición. | ✅ |

### 🐍 `services/incident-manager-api` — 217 pruebas

| 📄 Archivo | 🔢 | 🧪 Qué comprueba | ✅ Si pasa | ❌ Si falla | 🚦 |
| --- | ---: | --- | --- | --- | :---: |
| ➕ `test_api_create.py` | 78 | Alta: `strip`, 8 categorías / 3 orígenes / 4 sedes, campos obligatorios (ausente, vacío, espacios, `null`, número, lista…), enums exactos, estado inicial solo `open`, nada se guarda si falla. | Solo entran incidencias válidas y normalizadas. | Entraría una incidencia incompleta o fuera del catálogo. | ✅ |
| 📋 `test_api_read.py` | 30 | Listado (4 filtros con AND, orden por fecha), resumen por estado/categoría/origen/sede y detalle. | La UI ve datos correctos y consistentes. | Registros equivocados o conteos que no suman. | ✅ |
| 🔀 `test_api_status.py` | 34 | **4 transiciones válidas** y **8 inválidas**, mensajes exactos, un PATCH fallido no modifica nada, el 404 tiene prioridad. | Se respeta `open → in_progress → resolved/discarded`. | Se podría reabrir una incidencia cerrada o saltarse pasos. | ✅ |
| 🧱 `test_api.py` | 24 | Casos base de la API. | Los flujos principales funcionan. | Se rompió un flujo básico. | ✅ |
| 🕐 `test_models_types.py` | 14 | Fechas siempre UTC, `updated_at`, índices, tabla del seed. | Las fechas son coherentes. | Fechas sin zona horaria o `updated_at` incorrecto. | ✅ |
| 🗄️ `test_models.py` | 11 | Restricciones de BD (CHECK / NOT NULL). | La base protege los datos aunque falle la aplicación. | Se guardarían datos inválidos. | ✅ |
| ⚙️ `test_config.py` | 11 | Variables de entorno, carpeta SQLite, `init_db` idempotente. | Arranca bien con cualquier configuración válida. | Una variable mal leída llevaría a la base equivocada. | ✅ |
| 🌱 `test_seed.py` | 9 | Seed del CSV: idempotencia y descartes. | La carga inicial es repetible. | El seed duplica o pierde filas. | ✅ |
| 🙈 `test_errors.py` | 6 | Un 500 genérico **sin filtrar** el texto de la excepción. | No se expone información interna. | Un fallo mostraría datos sensibles. | ✅ |

### 🟦 `uis/application` — 143 pruebas (Jest, en `lib/__tests__/`)

| 📄 Archivo | 🧪 Qué comprueba | ✅ Si pasa | ❌ Si falla | 🚦 |
| --- | --- | --- | --- | :---: |
| 🌐 `api-client.test.ts` | Token solo si existe; red caída, 4xx/5xx y cuerpos ilegibles → mensaje en español; **401 con sesión cierra sesión, sin sesión no**. | Siempre hay un mensaje claro y la sesión caducada se limpia. | Se vería «Failed to fetch» o un login fallido cerraría la sesión. | ✅ |
| 💾 `auth-storage.test.ts` | Guardar/leer/borrar token, suscriptores y `localStorage` bloqueado. | La sesión no rompe en modo privado. | Excepciones si el navegador bloquea el almacenamiento. | ✅ |
| 👤 `auth-api.test.ts` | Login, registro (+ login automático), sesión, perfil, contraseñas; textos con tildes. | Flujos de cuenta en español correcto. | Mensajes sin tildes/en inglés o token inválido guardado. | ✅ |
| 🏭 `suppliers-api.test.ts` | Mapeo `snake_case ⇄ camelCase`, filtros vacíos omitidos, errores traducidos. | Datos y errores correctos en el directorio. | Campos mal mapeados o errores en inglés en pantalla. | ✅ |
| 🚨 `incidents-api.test.ts` | Mapeo, filtros, errores por tipo, transiciones con etiquetas en español y **nunca el texto del backend**. | Los errores usan textos propios de la UI. | Se filtraría texto crudo o un código como `in_progress`. | ✅ |
| 🔀 `incident-types.test.ts` | Transiciones de la UI = las del backend; etiquetas en español; *type guards*. | UI y backend coinciden en el flujo de estados. | Se ofrecerían transiciones que el backend rechaza. | ✅ |

### 🟦 `uis/backoffice` — 151 pruebas (Jest)

| 📄 Archivo | 🧪 Qué comprueba | ✅ Si pasa | ❌ Si falla | 🚦 |
| --- | --- | --- | --- | :---: |
| 🧑‍💼 `src/services/__tests__/api.test.ts` | Candidatos y notas (4Geeks Tracker): mapeo y fechas, filtros, `null` en 404, escritura sin `status`/`stage`, **red caída sin `TypeError` nativo**. | Lista y ficha de candidatos correctas. | «Failed to fetch» o se sobrescribiría el estado del candidato. | ✅ |
| 📊 `src/services/__tests__/incidents-api.test.ts` | Resumen del análisis: 7 reglas / 5 categorías / 3 estados en orden fijo, huecos a 0, tildes en errores, 401, descarga `results.csv`. | El análisis se pinta completo y los errores son claros. | Faltarían filas o saldrían mensajes sin tildes. | ✅ |
| 🌐 `src/lib/__tests__/api-client.test.ts` | Token, errores y política de 401. | La sesión caducada se limpia. | Error crudo o sesión cerrada sin motivo. | ✅ |
| 👤 `src/lib/__tests__/auth-api.test.ts` | Login, registro, sesión, perfil y cambio de contraseña. | Flujos de cuenta correctos. | Mensajes mal escritos o token mal guardado. | ✅ |
| 💾 `src/lib/__tests__/auth-storage.test.ts` | Guardar/leer/borrar token y `localStorage` bloqueado. | No rompe en modo privado. | Excepciones con almacenamiento bloqueado. | ✅ |
| 📦 `src/services/__tests__/inventory-api.test.ts` | Productos, stock, órdenes y traducción de errores de inventario. | Datos y errores coherentes en inventario. | Campos o mensajes incorrectos. | ✅ |
| 🧭 `src/lib/__tests__/auth-navigation.test.ts` y `src/app/inventario/_lib/__tests__/` | Retorno seguro tras login, redirecciones antiguas y aviso de stock. | Navegación interna y aviso conservados. | Retorno inseguro o aviso incorrecto. | ✅ |
| 🏷️ `src/app/candidates/_components/candidate-select.test.tsx` | Cinco casos: nombre accesible, diccionarios, eventos controlados, atributos y guardado. | Selector reutilizable accesible en filtros, alta y ficha. | Se pierden etiquetas o comportamiento nativo. | ✅ |
| ⏳ `src/services/api.test.tsx` | Tres casos: precarga y lectura comparten las URLs de candidato y notas. | Respuestas reutilizables sin alterar `safeFetch`. | Precarga y cliente solicitan recursos distintos. | ✅ |
| 📦 `src/app/candidates/[id]/__tests__/page.test.tsx` | La ficha no consulta notas hasta abrir su panel diferido; comprueba carga de notas. | La consulta y la vista secundaria se activan bajo demanda. | Se descarga el panel o se consultan notas en la carga inicial. | ✅ |
| 📊 `src/app/incidencias/__tests__/page.test.tsx` | El resumen aparece solo después de un análisis correcto y muestra el estado de análisis. | El módulo diferido conserva el flujo de CSV. | El resumen aparece antes de tener datos o no se carga. | ✅ |
| 🧮 `src/app/inventario/_components/__tests__/order-history-summary.test.tsx` | Agregación por tipo/oficina, memoización para la misma referencia y actualización con movimientos nuevos. | El cálculo se reutiliza y responde a datos nuevos. | Se recalcula en cada render o queda obsoleto. | ✅ |

---

## 🤖 Flujo asistido por IA y bugs detectados

| 🔁 Paso | 📝 Qué se hizo |
| --- | --- |
| 1️⃣ **Plan primero** | Se analizaron todos los endpoints con la IA y se redactó el plan (camino feliz / límite / fallo) **antes** de escribir ningún test. |
| 2️⃣ **IA sugiere casos límite** | Propuso casos que se habrían pasado por alto: `alg: none`, token de reset usado como token de acceso, huella de contraseña obsoleta, email con distinto *casing*, `role: null` en la actualización, estados finales del incidente. |
| 3️⃣ **IA genera, se revisa** | El boilerplate lo generó la IA; cada prueba se ejecutó y se contrastó con el comportamiento real. Cuando la IA se equivocó, la ejecución lo destapó (ver tabla). |
| 4️⃣ **Si una prueba revela un bug** | Se escribe la prueba, se comprueba que falla, se corrige el código y se documenta aquí. |

### 🐞 Bug detectado por la batería y corregido

| 🔎 | 📝 |
| --- | --- |
| 🐛 **Bug** | `GET /api/incidents/results/export` era **público**: aunque `POST /analyze` exige login, cualquiera podía descargar el último análisis. |
| 🧪 **Prueba que lo reveló** | `test_export_requires_login` → antes del arreglo: `assert 200 == 401`. |
| 🔧 **Corrección** | `dependencies=[Depends(get_current_user)]` en la ruta (`services/api/routes/incidents.py`). El frontend ya enviaba el token en la descarga, así que no se rompe. |
| ✅ **Estado** | Prueba en verde; la ruta pasó a la matriz de rutas protegidas (`test_protected_routes_reject_anonymous_requests`). Commit `b881b79`. |

### 🪞 Errores de la propia IA que la batería destapó

| 💬 Suposición inicial | 🔬 Realidad (descubierta al ejecutar) |
| --- | --- |
| Los timestamps salen con sufijo `+00:00`. | Salen con `Z`. |
| Un login con contraseña vacía devuelve 401. | Devuelve 422 (campo requerido del formulario); esa prueba se eliminó por ser del framework. |
| La política de contraseñas acepta `Ñ` como mayúscula. | Solo reconoce `A-Z` ASCII (fijado como comportamiento actual). |
| `role: null` en la actualización se rechaza. | Se interpreta como «no cambiar» (200). |

---

## 💥 Ejemplo real de un fallo

Para comprobar que la batería detecta errores, se rompió **a propósito** una
regla y luego se revirtió con `git checkout` (árbol limpio).

| 🔬 Paso | 📝 Detalle |
| --- | --- |
| 🔨 **Cambio provocado** | En `incident_constants.py`, permitir `open → resolved` (saltarse `in_progress`). |
| ⌨️ **Comando** | `uv run pytest tests/test_api_status.py` |
| ❌ **Resultado** | `2 failed, 32 passed` |
| 🎯 **Prueba que lo cazó** | `test_invalid_transitions_return_400_and_leave_incident_untouched[open-resolved]` |
| 💬 **Qué dijo pytest** | `assert 200 == 400` → la API aceptó una transición que debía rechazar. |
| 🎯 **Segunda prueba afectada** | `test_skipping_a_step_message` (`KeyError: 'error'`: ya no había mensaje de error). |
| ↩️ **Después de revertir** | ✅ `34 passed` |

---

## 📌 Comportamientos fijados

🧷 Algunas pruebas documentan lo que el código hace **hoy**, aunque quizá se
quiera cambiar. Llevan `# Comportamiento actual:`. Si corriges alguno, su prueba
fallará y habrá que actualizarla: es lo esperado.

| 🧩 Servicio | 🔎 Comportamiento actual | 🧪 Prueba |
| --- | --- | --- |
| 🐍 `api` | 🔑 El registro solo exige 8 caracteres (la política fuerte solo aplica a reset/cambio). | `test_registration_only_enforces_min_length` |
| 🐍 `api` | 🔠 `Ñ` no cuenta como mayúscula en la política de contraseñas. | `test_only_ascii_uppercase_letters_count_as_uppercase` |
| 🐍 `api` | ✉️ El email distingue mayúsculas (`Ana@x.com` ≠ `ana@x.com`). | `test_registration_email_uniqueness_is_case_sensitive` |
| 🐍 `api` | 🏭 Un proveedor puede duplicarse por nombre o tener nombre solo de espacios. | `test_duplicate_names_are_allowed_…` · `test_create_accepts_whitespace_only_name` |
| 🐍 `api` | 🔄 El proveedor cambia entre `active`/`suspended` sin restricciones; se puede borrar uno activo. | `test_status_can_flip_in_any_direction_…` |
| 🐍 `api` | 🗑️ Un admin puede borrarse a sí mismo. | `test_admin_can_delete_themselves` |
| 🐍 `incident-manager` | 📏 `title` / `description` sin límite de longitud. | `test_create_accepts_very_long_text` |
| 🐍 `incident-manager` | 🕳️ Un filtro vacío (`?status=`) da 400, no se ignora. | `test_list_rejects_empty_filter_value` |
| 🐍 `incident-manager` | 🎲 Sin desempate por `id` si dos incidencias tienen la misma fecha. | `test_list_with_identical_created_at_…` |
| 🐍 `incident-manager` | 🙈 Claves desconocidas en body o query se ignoran. | `test_create_ignores_unknown_keys` · `test_list_ignores_unknown_query_params` |

---

## 📈 Cobertura

> ℹ️ Informativa: no hay umbral que haga fallar el build.

### 🔐 Cobertura del módulo de autenticación (objetivo ≥ 70 %)

> Verificada con `uv run pytest --cov` en `services/api`.

| 📄 Módulo | 📈 Cobertura | 🎯 Objetivo | 🚦 |
| --- | ---: | :---: | :---: |
| `routes/auth.py` | 100 % | ≥ 70 % | ✅ |
| `security.py` (hash, JWT, dependencias) | 100 % | ≥ 70 % | ✅ |
| `routes/users.py` | 100 % | ≥ 70 % | ✅ |
| `routes/profiles.py` | 100 % | ≥ 70 % | ✅ |
| `rate_limit.py` | 100 % | ≥ 70 % | ✅ |

### 🧭 Resto de módulos probados (objetivo ≥ 60 %)

| 📄 Módulo | 📈 Cobertura | 🚦 |
| --- | ---: | :---: |
| `services/api/routes/suppliers.py` | 100 % | ✅ |
| `services/api/routes/incidents.py` | 100 % | ✅ |
| `services/incident-manager-api/routes/incidents.py` | 100 % | ✅ |

### 📊 Cobertura total por área

| 🧩 Área | 📈 Cobertura | 📊 Barra | 🕳️ Sin cubrir |
| --- | ---: | --- | --- |
| 🐍 `services/api` | 96 % | `█████████▌` | `mailer.py` (envío real de email) y apertura de archivos en `database.py` / `users_db.py` |
| 🐍 `services/incident-manager-api` | 98 % | `█████████▊` | `main.py`: arranque real del servidor |
| 🟦 `uis/application` | 99,8 % | `██████████` | Ramas de `auth-storage.ts` |
| 🟦 `uis/backoffice` | 99,5 % | `██████████` | Dos líneas de `auth-api.ts` e `incidents-api.ts` |

---

## ➕ Añadir una prueba

| 🧩 Área | 📝 Pasos |
| --- | --- |
| 🐍 Python | 1️⃣ Elige el archivo por tema (`*_rules.py` para reglas de negocio). 2️⃣ Usa los clientes de `tests/conftest.py`: `anon_client`, `user_client`, `admin_client`. 3️⃣ Un caso por comportamiento; varios valores → `@pytest.mark.parametrize`. 4️⃣ Si fijas algo discutible, añade `# Comportamiento actual: …`. |
| 🟦 TypeScript | 1️⃣ Crea `*.test.ts` en la carpeta `__tests__` del módulo. 2️⃣ Usa `mockFetch` y `jsonResponse` de `helpers.ts`. 3️⃣ Prueba la lógica (mapeo, mensajes, sesión), no el formato del JSON enviado. |

---

## Auditoría de rendimiento e integración

### Ocho pruebas añadidas en la auditoría

Desde `uis/backoffice`: `npm test -- --runInBand` ejecuta **8 pruebas**: cinco de
`CandidateSelect` con Jest y Testing Library. Cubren etiquetas accesibles,
traducción de opciones, eventos controlados, atributos nativos y estado de guardado;
tres comprueban que la precarga y las lecturas de candidato/notas usan las mismas URLs.

### Navegador y rendimiento

Desde la raíz: `node scripts/audit-regression.mjs final` comprueba ambos frontends
en producción. Bloquea las escrituras hacia la API real. Los resultados se guardan
en `audit/checks/`.

`node scripts/audit-frontends.mjs after 3` ejecuta Lighthouse tres veces por URL;
las condiciones y los informes originales quedan en `audit/after/`.

Las herramientas de navegador se instalan en TEMP, según `scripts/README.md`.
Cada app se comprueba también con `npm run lint` y `npm run build`.


## Telemetría — validación de diseño (26/10/2026)

Desde la raíz: node scripts/validate-telemetry.cjs. Requiere Node y Ajv 6 del tooling ya instalado de uis/backoffice; no añade dependencias ni accede a red, servidores o bases de datos.

Resultado: **PASS — 9.450 comprobaciones documentales y de contrato**, 66 esquemas/fichas, cinco obligatorios y 61 oportunidades en siete categorías. Comprueba Draft-07, ejemplos, formatos activos, allowlists, campos requeridos, versiones, oficina/moneda, identidad, autoridad de origen, tablas/metadata/ejemplos Markdown frente a JSON, categorías reales de incidencias y fixtures semánticos de costo/stock/zona horaria. Demuestra que un valor con forma válida necesita además registro/procedencia para ser seguro.

Estas comprobaciones se contabilizan aparte de las suites de aplicación anteriores: no son nuevas pruebas Jest/pytest ni medición de cobertura de instrumentación. Rollback, concurrencia, entrega durable, correlador de abandono y sanitización desplegada están especificados para la fase posterior en el plan; no se afirman ejecutados aquí.

## Parte 3: dashboard y ejecución de pruebas

Desde la raíz, con el entorno API activado:

```bash
python -m pytest tests/pipelines/test_pipeline.py
python -m pytest tests/pipelines data/pipelines/tests
```

La colección predeterminada de raíz apunta a `tests/test_suites.py`; este
lanza las tres suites originales y un cuarto grupo de pipelines en el entorno
de la API, que contiene Prefect/SQLAlchemy. La raíz conserva solo pytest.

| Archivo nuevo de backoffice | Pruebas | Comportamiento |
| --- | ---: | --- |
| `services/__tests__/business-performance.test.ts` | 13 | Contrato, semana ISO, autenticación, ausencia de caché HTTP y errores traducidos, incluido 401. |
| `app/reporting/__tests__/page.test.tsx` | 12 | Cuatro nombres de KPI, período UTC, EUR/USD, carga, vacío, reintento, selector, URL inválida, permisos y respuesta tardía. |

Comportamientos fijados: Kits entregados cuenta eventos, no unidades;
una semana sin filas publicadas no se representa con ceros; cada moneda
conserva su oficina. La caché mantiene semana/versión/digest como identidad,
pero usa su SHA-256 como nombre de archivo para funcionar en Windows.
Se reprodujo el fallo de los dos puntos antes de corregirlo.

Advertencias preexistentes: sqlite3 avisa de la futura retirada del adaptador
de fechas predeterminado; la suite del dashboard técnico emite advertencias
React `act`. Ambas suites pasan; no se cambió el reporte técnico.

Revisión de navegador: build de producción en escritorio y 390 px, login con
retorno a `/reporting`, GET 200 para dos oficinas, consulta semanal vacía,
retorno a la última semana y actualización. La página móvil no desborda el
viewport. La API real corrió con SQLite y cuentas temporales sintéticas; no
se verificaron datos comerciales de Supabase. Capturas locales en
`data/eval/business-performance/dashboard-{desktop,mobile}.png` (ignoradas).
El contexto de telemetría del entorno QA devuelve 503 por carecer de clave
HMAC; ese aviso del sistema técnico no impide consultar los KPI.
