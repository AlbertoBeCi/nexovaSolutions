# Pruebas de `services/api`

Batería de **374 pruebas** con `pytest` que verifica la **lógica** de la API
(reglas de negocio, permisos, validaciones y manejo de errores). No comprueba
cómo se serializa HTTP (cabeceras, formato del JSON, CORS…).

## Cómo ejecutarlas

```bash
cd services/api
uv sync                                     # una sola vez
uv run pytest                               # toda la batería (~1 min)
uv run pytest tests/test_suppliers_rules.py # un solo archivo
uv run pytest -k "login"                    # solo las pruebas que contienen «login»
uv run pytest --cov --cov-report=term-missing   # con cobertura (informativa)
```

Las pruebas **no tocan datos reales**: cada una usa bases TinyDB temporales y
no envía emails (el mailer se sustituye).

## Cómo leer el resultado

| Salida de pytest | Significado | Qué hacer |
| --- | --- | --- |
| `374 passed` ✅ | Todas las reglas se comportan como se espera. | Nada: se puede continuar. |
| `F` / `FAILED archivo::prueba` ❌ | Una regla dejó de cumplirse (o cambió a propósito). | Leer el bloque `assert` que pytest imprime: muestra el valor esperado y el obtenido. |
| `E` / `ERROR` ⚠️ | La prueba no pudo ni empezar (fixture o import roto). | Revisar el traceback: suele ser una dependencia o un cambio de firma. |

## Qué se prueba y qué significa el resultado

| Archivo | Qué comprueba | Si pasa ✅ | Si falla ❌ |
| --- | --- | --- | --- |
| `test_suppliers.py` + `test_suppliers_rules.py` (124) | Alta, listado, filtros, detalle, cambio de tarifa/estado y borrado de proveedores; reglas país↔moneda; límites de la tarifa y las fechas. | El directorio de proveedores respeta sus reglas de negocio. | Se aceptan datos inválidos (p. ej. España con USD) o se rechazan datos válidos. |
| `test_incidents_analyze.py` (59) | Las 7 reglas de invalidez del analizador de CSV y sus límites (5 caracteres, puntuación 1–5…), agregados, errores de archivo y exportación del último análisis. | El resumen del análisis es correcto y nunca expone filas ni emails. | Un ticket inválido se cuenta como válido (o al revés) y los porcentajes salen mal. |
| `test_accounts_rules.py` (97) | Registro, login, usuarios y perfiles: límites de contraseña, email duplicado, permisos propio/admin, y matriz de rutas protegidas vs. públicas. | Cada usuario solo accede a lo suyo; las rutas protegidas exigen sesión. | Un usuario podría leer o borrar datos ajenos, o una ruta protegida quedaría abierta. |
| `test_security_logic.py` (36) | Lógica de seguridad sin HTTP: política de contraseñas, hash, JWT (expiración, firma, tipo, huella) y `get_current_user`. | Tokens manipulados, caducados o de otro tipo se rechazan. | Se aceptaría un token falso/caducado o una contraseña débil. |
| `test_password_reset.py` (25) | Flujo olvidé/restablecer/cambiar contraseña; token de un solo uso; límite de intentos. | El reset es seguro y no revela si un email existe. | Un token se podría reutilizar o se filtraría qué emails están registrados. |
| `test_auth.py` (13), `test_users.py` (8), `test_profiles.py` (4) | Casos base de login, registro, usuarios y perfiles. | Los flujos principales funcionan. | Se rompió un flujo básico. |
| `test_protected_routes.py` (3), `test_rate_limit.py` (4), `test_error_handling.py` (1) | 401 sin sesión, límite de intentos y que un error interno nunca expone detalles. | La API se defiende de accesos y abusos y no filtra información interna. | Una ruta queda sin protección o un 500 muestra información interna. |

## Comportamientos «fijados» (pueden ser discutibles)

Algunas pruebas documentan lo que la API hace **hoy** aunque quizá se quiera
cambiar. Están marcadas con el comentario `# Comportamiento actual:`. Si decides
corregir alguno, esa prueba fallará y habrá que actualizarla: es lo esperado.

| Comportamiento actual | Prueba |
| --- | --- |
| `GET /api/incidents/results/export` es público (`analyze` exige login). | `test_export_is_public_today` |
| El registro solo exige 8 caracteres (la política fuerte solo aplica a reset/cambio). | `test_registration_only_enforces_min_length` |
| `Ñ` no cuenta como mayúscula en la política de contraseñas. | `test_only_ascii_uppercase_letters_count_as_uppercase` |
| El email es sensible a mayúsculas (`Ana@x.com` ≠ `ana@x.com`). | `test_registration_email_uniqueness_is_case_sensitive` |
| Un proveedor puede duplicarse por nombre y tener nombre solo de espacios. | `test_duplicate_names_are_allowed_…`, `test_create_accepts_whitespace_only_name` |
| El proveedor puede pasar de `active` a `suspended` y viceversa sin restricciones; se puede borrar uno activo. | `test_status_can_flip_in_any_direction_…` |
| Un admin puede borrarse a sí mismo. | `test_admin_can_delete_themselves` |

## Cobertura actual (informativa, sin umbral)

`routes/`, `models.py`, `security.py`, `rate_limit.py`, `store.py` y `analysis.py`
están al **100 %**; el total es **96 %**. Lo no cubierto es el envío real de
email (`mailer.py`) y la apertura de archivos en `database.py`/`users_db.py`.

## Añadir una prueba nueva

1. Elige el archivo por tema (`*_rules.py` para reglas de negocio).
2. Usa los clientes de `tests/conftest.py`: `anon_client` (sin sesión),
   `user_client` (usuario normal) o `admin_client` (administrador).
3. Un caso por comportamiento; varios valores de entrada → `@pytest.mark.parametrize`.
4. Si fijas algo discutible, añade `# Comportamiento actual: …`.
