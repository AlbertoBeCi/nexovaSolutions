# Resultados de la batería de pruebas

Ejecución del **2026-10-05 20:26** sobre la rama `feature/pruebas-api`
(commit `6224f82`). Pruebas de **lógica** (reglas, permisos, validaciones y
errores); no se prueba la serialización HTTP.

**Entorno:** Python 3.14.8 (vía `uv` 0.12.22), Node v24.18.1, Jest + `next/jest`.

## 1. Resumen

| Área | Comando | Pruebas | Resultado | Duración | Cobertura |
| --- | --- | ---: | :---: | ---: | ---: |
| `services/api` | `uv run pytest` | 374 | ✅ 374 pasan · 0 fallan | 60,8 s | 96 % |
| `services/incident-manager-api` | `uv run pytest` | 217 | ✅ 217 pasan · 0 fallan | 1,5 s | 98 % |
| `uis/application` | `npx jest --coverage` | 143 | ✅ 143 pasan · 0 fallan | 1,1 s | 99,8 % |
| `uis/backoffice` | `npx jest --coverage` | 114 | ✅ 114 pasan · 0 fallan | 1,0 s | 99,5 % |
| **Total** | | **848** | ✅ **848 pasan** | | |

Comprobaciones adicionales en verde: `npm run lint` y `npm run build` en las dos
apps, y el verificador `revision-textos-ui` (**PASS**).

## 2. Resultado por archivo de pruebas

### `services/api` (374)

| Archivo | Pruebas | Qué verifica | Resultado |
| --- | ---: | --- | :---: |
| `test_suppliers.py` | 27 | Proveedores: casos base y seed | ✅ |
| `test_suppliers_rules.py` | 97 | Reglas país↔moneda, límites, filtros, borrado, protección | ✅ |
| `test_incidents_analyze.py` | 59 | 7 reglas del analizador, agregados, errores de archivo, exportación | ✅ |
| `test_accounts_rules.py` | 97 | Registro, login, permisos, perfiles, rutas protegidas/públicas | ✅ |
| `test_security_logic.py` | 36 | Contraseñas, hash, JWT, `get_current_user` | ✅ |
| `test_password_reset.py` | 25 | Olvidé/restablecer/cambiar contraseña | ✅ |
| `test_auth.py` | 13 | Registro y login base | ✅ |
| `test_users.py` | 8 | Usuarios (permisos base) | ✅ |
| `test_profiles.py` | 4 | Perfiles base | ✅ |
| `test_rate_limit.py` | 4 | Límite de intentos | ✅ |
| `test_protected_routes.py` | 3 | 401 sin sesión | ✅ |
| `test_error_handling.py` | 1 | 500 sin filtrar detalles | ✅ |

### `services/incident-manager-api` (217)

| Archivo | Pruebas | Qué verifica | Resultado |
| --- | ---: | --- | :---: |
| `test_api_create.py` | 78 | Alta: normalización, catálogo, campos obligatorios | ✅ |
| `test_api_read.py` | 30 | Listado, filtros, resumen, detalle | ✅ |
| `test_api_status.py` | 34 | 4 transiciones válidas + 8 inválidas | ✅ |
| `test_api.py` | 24 | Casos base de la API | ✅ |
| `test_models_types.py` | 14 | UTC, índices, timestamps, tabla del seed | ✅ |
| `test_models.py` | 11 | Restricciones de la base de datos | ✅ |
| `test_config.py` | 11 | Variables de entorno y `init_db` | ✅ |
| `test_seed.py` | 9 | Seed idempotente | ✅ |
| `test_errors.py` | 6 | 500 genérico sin filtrar | ✅ |

### `uis/application` (143) y `uis/backoffice` (114)

| App | Archivo | Qué verifica | Resultado |
| --- | --- | --- | :---: |
| application | `auth-api.test.ts` | Flujos de cuenta, textos con tildes | ✅ |
| application | `suppliers-api.test.ts` | Mapeo, filtros, errores traducidos | ✅ |
| application | `incidents-api.test.ts` | Mapeo, errores por tipo, transiciones | ✅ |
| application | `api-client.test.ts` | Token, errores, política de 401 | ✅ |
| application | `incident-types.test.ts` | Transiciones espejo del backend, etiquetas | ✅ |
| application | `auth-storage.test.ts` | Almacenamiento del token | ✅ |
| backoffice | `services/api.test.ts` | Candidatos y notas (4Geeks Tracker) | ✅ |
| backoffice | `services/incidents-api.test.ts` | Resumen del análisis, descarga CSV | ✅ |
| backoffice | `lib/api-client.test.ts` | Token, errores, política de 401 | ✅ |
| backoffice | `lib/auth-api.test.ts` | Flujos de cuenta | ✅ |
| backoffice | `lib/auth-storage.test.ts` | Almacenamiento del token | ✅ |

## 3. Qué pasa cuando pasa… y cuando falla

| Situación | Qué ves | Qué significa | Qué hacer |
| --- | --- | --- | --- |
| ✅ **Todo pasa** | `374 passed` (pytest) · `Tests: 143 passed` (Jest) | Las reglas de negocio siguen cumpliéndose. | Nada; se puede commitear. |
| ❌ **Una prueba falla** | `FAILED archivo::prueba` + líneas `E` con lo esperado y lo obtenido | Una regla dejó de cumplirse, o cambió a propósito. | Corregir el código; si el cambio es intencionado, actualizar la prueba. |
| ⚠️ **No arranca** | `ERROR` (pytest) · `Test suite failed to run` (Jest) | Import, fixture o tipo roto antes de ejecutar. | Leer el traceback: suele ser una dependencia o una firma cambiada. |

### Ejemplo real de un fallo

Para comprobar que la batería detecta errores, se rompió **a propósito** una
regla y después se revirtió (`git checkout`; el árbol quedó limpio):

| | |
| --- | --- |
| **Cambio provocado** | En `incident_constants.py`, permitir `open → resolved` (saltarse `in_progress`). |
| **Comando** | `uv run pytest tests/test_api_status.py` |
| **Resultado** | ❌ `2 failed, 32 passed` |
| **Prueba que cazó el error** | `test_invalid_transitions_return_400_and_leave_incident_untouched[open-resolved]` |
| **Qué dijo pytest** | `assert 200 == 400` — la API aceptó una transición que debía rechazar. |
| **Segunda prueba afectada** | `test_skipping_a_step_message` (`KeyError: 'error'`: ya no había mensaje de error). |
| **Estado final** | Cambio revertido; la batería vuelve a `34 passed`. |

## 4. Cobertura

| Módulo | Cobertura | Líneas sin cubrir |
| --- | ---: | --- |
| `services/api` (total) | 96 % | `mailer.py` (envío real de email), apertura de archivos en `database.py` y `users_db.py` |
| `services/incident-manager-api` (total) | 98 % | `main.py`: arranque real del servidor (lifespan y `run`) |
| `uis/application` (`lib/` + `types/incident.ts`) | 99,8 % | Ramas de `auth-storage.ts` |
| `uis/backoffice` (`src/lib` + `src/services`) | 99,5 % | Dos líneas de `auth-api.ts` y `incidents-api.ts` |

La cobertura es **informativa**: no hay umbral que haga fallar el build.

## 5. Cómo repetirlo

```bash
cd services/api && uv run pytest --cov --cov-report=term-missing
cd services/incident-manager-api && uv run pytest --cov --cov-report=term-missing
cd uis/application && npx jest --coverage
cd uis/backoffice && npx jest --coverage
```

Guías detalladas por área: [`services/api/TESTING.md`](../services/api/TESTING.md),
[`services/incident-manager-api/TESTING.md`](../services/incident-manager-api/TESTING.md),
[`uis/application/TESTING.md`](../uis/application/TESTING.md),
[`uis/backoffice/TESTING.md`](../uis/backoffice/TESTING.md).
