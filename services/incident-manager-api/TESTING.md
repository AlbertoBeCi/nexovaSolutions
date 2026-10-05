# Pruebas de `services/incident-manager-api`

Batería de **217 pruebas** con `pytest` sobre la **lógica** del gestor de
incidencias: validación, transiciones de estado, filtros, conteos, errores y
modelo de datos. No comprueba la serialización HTTP (CORS, cabeceras, JSON mal
formado…).

## Cómo ejecutarlas

```bash
cd services/incident-manager-api
uv sync                                          # una sola vez
uv run pytest                                    # toda la batería (~2 s)
uv run pytest tests/test_api_status.py           # un solo archivo
uv run pytest --cov --cov-report=term-missing    # con cobertura (informativa)
```

Cada prueba usa su propia base SQLite temporal: **no toca**
`data/incidents.db`.

## Cómo leer el resultado

| Salida de pytest | Significado | Qué hacer |
| --- | --- | --- |
| `217 passed` ✅ | La lógica del gestor se comporta como se espera. | Nada. |
| `F` / `FAILED archivo::prueba` ❌ | Una regla dejó de cumplirse (o cambió a propósito). | Leer el `assert`: muestra valor esperado y obtenido. |
| `E` / `ERROR` ⚠️ | La prueba no pudo ejecutarse (fixture o import roto). | Revisar el traceback. |

## Qué se prueba y qué significa el resultado

| Archivo | Qué comprueba | Si pasa ✅ | Si falla ❌ |
| --- | --- | --- | --- |
| `test_api_create.py` (78) | Alta de incidencia: `strip`, los 8 valores de categoría/3 de origen/4 de sede, campos obligatorios (ausente, vacío, solo espacios, `null`, número, lista…), enums exactos, estado inicial solo `open`, nada se guarda si falla. | Solo entran incidencias válidas y bien normalizadas. | Entraría una incidencia incompleta o con valores fuera del catálogo. |
| `test_api_read.py` (30) | Listado (4 filtros, combinados con AND, orden por fecha), resumen (conteos por estado/categoría/origen/sede) y detalle por id. | Los datos que ve la UI son correctos y consistentes. | El listado devuelve registros equivocados o los conteos no suman. |
| `test_api_status.py` (34) | Las **4 transiciones válidas** y las **8 inválidas** del flujo de estados, mensajes exactos, que un PATCH fallido no modifique nada y que el 404 tenga prioridad. | El ciclo de vida respeta `open → in_progress → resolved/discarded`. | Se podría reabrir una incidencia cerrada o saltarse pasos. |
| `test_errors.py` (6) | Un error inesperado devuelve un 500 genérico **sin filtrar** el texto de la excepción. | No se expone información interna. | Un fallo interno mostraría datos sensibles al cliente. |
| `test_models.py` (11) + `test_models_types.py` (14) | Restricciones de la base de datos (CHECK/NOT NULL), fechas siempre en UTC, `updated_at` que cambia solo al actualizar, índices y tabla del seed. | La base protege los datos aunque falle la capa de aplicación. | Se podrían guardar datos inválidos o fechas sin zona horaria. |
| `test_config.py` (11) | Variables de entorno (`INCIDENTS_DATABASE_URL`, puerto, CORS), creación de la carpeta SQLite y `init_db` idempotente. | El servicio arranca bien con cualquier configuración válida. | Una variable mal leída llevaría la API a la base equivocada. |
| `test_api.py` (24) + `test_seed.py` (9) | Casos base de la API y del seed del CSV (idempotencia, descartes). | Los flujos principales y la carga inicial funcionan. | Se rompió un flujo básico o el seed duplica/pierde filas. |

## Comportamientos «fijados» (pueden ser discutibles)

Marcados en el código con `# Comportamiento actual:`. Si corriges alguno, su
prueba fallará y habrá que actualizarla: es lo esperado.

| Comportamiento actual | Prueba |
| --- | --- |
| `title`/`description` no tienen límite de longitud. | `test_create_accepts_very_long_text` |
| Un filtro vacío (`?status=`) es un error 400, no se ignora. | `test_list_rejects_empty_filter_value` |
| No hay desempate por `id` cuando dos incidencias tienen la misma fecha. | `test_list_with_identical_created_at_…` |
| Claves desconocidas en el body o en la query se ignoran. | `test_create_ignores_unknown_keys`, `test_list_ignores_unknown_query_params` |

## Cobertura actual (informativa, sin umbral)

**98 %** en total; `routes/`, `models.py`, `db.py`, `errors.py` y `config.py` al
100 %. Lo no cubierto es el arranque real del servidor (`main.py`: lifespan y `run`).
