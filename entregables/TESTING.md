# 🧪 TESTING — Batería de pruebas de Nexova Solutions

> 📅 **Ejecución:** 2026-10-05 20:26 · 🌿 **Rama:** `feature/pruebas-api`
> 🐍 Python 3.14.8 (`uv` 0.12.22) · 🟢 Node v24.18.1 · 🛠️ `pytest` + 🃏 Jest

🎯 Las pruebas verifican la **lógica** (reglas, permisos, validaciones y errores).
🚫 No prueban la serialización HTTP (CORS, cabeceras, JSON mal formado) ni los componentes React.

## 📌 Índice

1. [🏆 Resumen](#-resumen)
2. [🚀 Cómo ejecutarlas](#-cómo-ejecutarlas)
3. [🚦 Cómo leer el resultado](#-cómo-leer-el-resultado)
4. [🔍 Qué se prueba, por área](#-qué-se-prueba-por-área)
5. [💥 Ejemplo real de un fallo](#-ejemplo-real-de-un-fallo)
6. [📌 Comportamientos fijados](#-comportamientos-fijados)
7. [📈 Cobertura](#-cobertura)
8. [➕ Añadir una prueba](#-añadir-una-prueba)

---

## 🏆 Resumen

| 🧩 Área | ⌨️ Comando | 🔢 Pruebas | 🚦 Resultado | ⏱️ Tiempo | 📈 Cobertura |
| --- | --- | ---: | :---: | ---: | ---: |
| 🐍 `services/api` | `uv run pytest` | 374 | ✅ 374 · ❌ 0 | 60,8 s | 96 % |
| 🐍 `services/incident-manager-api` | `uv run pytest` | 217 | ✅ 217 · ❌ 0 | 1,5 s | 98 % |
| 🟦 `uis/application` | `npx jest --coverage` | 143 | ✅ 143 · ❌ 0 | 1,1 s | 99,8 % |
| 🟦 `uis/backoffice` | `npx jest --coverage` | 114 | ✅ 114 · ❌ 0 | 1,0 s | 99,5 % |
| 🏁 **Total** | | **848** | ✅ **848** · ❌ **0** | | |

| ✅ Otras comprobaciones | 🟦 `uis/application` | 🟦 `uis/backoffice` |
| --- | :---: | :---: |
| `npm run lint` | ✅ | ✅ |
| `npm run build` | ✅ | ✅ |
| 🔤 Verificador `revision-textos-ui` | ✅ PASS | ✅ PASS |

---

## 🚀 Cómo ejecutarlas

```bash
# 🐍 Backend (Python)
cd services/api && uv sync && uv run pytest
cd services/incident-manager-api && uv sync && uv run pytest

# 🟦 Frontends (TypeScript)
cd uis/application && npm install && npm test
cd uis/backoffice && npm install && npm test
```

| 🎛️ Quiero… | ⌨️ Comando |
| --- | --- |
| 📄 Un solo archivo | `uv run pytest tests/test_api_status.py` · `npx jest incidents-api` |
| 🔎 Filtrar por nombre | `uv run pytest -k "login"` |
| 📈 Ver cobertura | `uv run pytest --cov --cov-report=term-missing` · `npx jest --coverage` |

🛡️ **Seguras de ejecutar:** cada prueba usa bases temporales (TinyDB / SQLite),
no envía emails y en Jest `fetch` es un doble de prueba. No tocan datos reales
ni necesitan ninguna API levantada.

---

## 🚦 Cómo leer el resultado

| 🚥 Situación | 👀 Qué ves | 💡 Qué significa | 🛠️ Qué hacer |
| --- | --- | --- | --- |
| ✅ **Todo pasa** | `374 passed` (pytest) · `Tests: 143 passed` (Jest) | Las reglas de negocio siguen cumpliéndose. | 🎉 Nada: se puede commitear. |
| ❌ **Una prueba falla** | `FAILED archivo::prueba` y líneas `E` (pytest) · `✕ prueba` con `Expected` / `Received` (Jest) | Una regla dejó de cumplirse, o cambió a propósito. | 🔧 Corregir el código; si el cambio es intencionado, actualizar la prueba. |
| ⚠️ **No arranca** | `ERROR` (pytest) · `Test suite failed to run` (Jest) | Import, fixture o tipo roto antes de ejecutar. | 🔎 Leer el traceback: suele ser una dependencia o una firma cambiada. |

---

## 🔍 Qué se prueba, por área

Cada tabla indica **qué se comprueba**, **qué significa que pase** y **qué
significaría que falle**. Todas las pruebas de esta ejecución pasan (✅).

### 🐍 `services/api` — 374 pruebas

| 📄 Archivo | 🔢 | 🧪 Qué comprueba | ✅ Si pasa | ❌ Si falla | 🚦 |
| --- | ---: | --- | --- | --- | :---: |
| 🏭 `test_suppliers.py` | 27 | Proveedores: casos base y seed. | El directorio funciona. | Se rompió un flujo básico. | ✅ |
| 🏭 `test_suppliers_rules.py` | 97 | Reglas país↔moneda, límites de tarifa y fechas, filtros, borrado, protección. | El directorio respeta sus reglas. | Se aceptan datos inválidos (p. ej. España con USD) o se rechazan válidos. | ✅ |
| 📊 `test_incidents_analyze.py` | 59 | 7 reglas de invalidez del analizador CSV y sus límites, agregados, errores de archivo y exportación. | El resumen es correcto y nunca expone filas ni emails. | Un ticket inválido cuenta como válido y los porcentajes salen mal. | ✅ |
| 👤 `test_accounts_rules.py` | 97 | Registro, login, permisos propio/admin, perfiles, rutas protegidas vs. públicas. | Cada usuario solo accede a lo suyo. | Alguien leería/borraría datos ajenos o una ruta quedaría abierta. | ✅ |
| 🔐 `test_security_logic.py` | 36 | Política de contraseñas, hash, JWT (expiración, firma, tipo, huella), `get_current_user`. | Tokens falsos o caducados se rechazan. | Se aceptaría un token falso o una contraseña débil. | ✅ |
| 🔑 `test_password_reset.py` | 25 | Olvidé / restablecer / cambiar contraseña; token de un solo uso. | El reset es seguro y no revela qué emails existen. | Un token se podría reutilizar o se filtrarían emails. | ✅ |
| 🔓 `test_auth.py` | 13 | Registro y login base. | Los flujos principales funcionan. | Se rompió un flujo básico. | ✅ |
| 👥 `test_users.py` | 8 | Permisos base de usuarios. | Se respeta propio/admin. | Un usuario accedería a otro. | ✅ |
| 🪪 `test_profiles.py` | 4 | Perfiles base. | Crear/leer perfil funciona. | Se rompió el perfil. | ✅ |
| ⏳ `test_rate_limit.py` | 4 | Límite de intentos. | Se frena la fuerza bruta. | Intentos ilimitados. | ✅ |
| 🛡️ `test_protected_routes.py` | 3 | 401 sin sesión. | Las rutas protegidas exigen login. | Una ruta queda abierta. | ✅ |
| 🙈 `test_error_handling.py` | 1 | Un 500 no expone detalles internos. | No se filtra información. | Un fallo mostraría datos internos. | ✅ |

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

### 🟦 `uis/backoffice` — 114 pruebas (Jest)

| 📄 Archivo | 🧪 Qué comprueba | ✅ Si pasa | ❌ Si falla | 🚦 |
| --- | --- | --- | --- | :---: |
| 🧑‍💼 `src/services/__tests__/api.test.ts` | Candidatos y notas (4Geeks Tracker): mapeo y fechas, filtros, `null` en 404, escritura sin `status`/`stage`, **red caída sin `TypeError` nativo**. | Lista y ficha de candidatos correctas. | «Failed to fetch» o se sobrescribiría el estado del candidato. | ✅ |
| 📊 `src/services/__tests__/incidents-api.test.ts` | Resumen del análisis: 7 reglas / 5 categorías / 3 estados en orden fijo, huecos a 0, tildes en errores, 401, descarga `results.csv`. | El análisis se pinta completo y los errores son claros. | Faltarían filas o saldrían mensajes sin tildes. | ✅ |
| 🌐 `src/lib/__tests__/api-client.test.ts` | Token, errores y política de 401. | La sesión caducada se limpia. | Error crudo o sesión cerrada sin motivo. | ✅ |
| 👤 `src/lib/__tests__/auth-api.test.ts` | Login, registro, sesión, perfil y cambio de contraseña. | Flujos de cuenta correctos. | Mensajes mal escritos o token mal guardado. | ✅ |
| 💾 `src/lib/__tests__/auth-storage.test.ts` | Guardar/leer/borrar token y `localStorage` bloqueado. | No rompe en modo privado. | Excepciones con almacenamiento bloqueado. | ✅ |

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
| 🐍 `api` | 🌐 `GET /api/incidents/results/export` es **público** (`analyze` exige login). | `test_export_is_public_today` |
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
