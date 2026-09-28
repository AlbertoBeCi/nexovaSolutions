---
rule: services
scope: file-pattern
globs: ["services/**"]
---

# services

**Alcance:** por patrón de archivo — activa cuando el cambio toca `services/**`
(API, workers, webhooks, jobs programados).

## Reglas

- Un solo backend FastAPI para la empresa, con routers/módulos por dominio
  (`candidates`, `notes`, …). Evita microservicios múltiples; extrae un worker
  aparte solo cuando de verdad deba correr separado de la API.
- Contrato de datos alineado con el frontend: si `uis/` y `services/` comparten
  una interfaz, extráela a `packages/` en vez de duplicarla.
- Configuración por variables de entorno; nunca hardcodees URLs, claves ni
  credenciales. `.env*` reales no se commitean.
- Errores con mensajes claros que la UI pueda mostrar al usuario.

### Proteger una ruta nueva (`services/api/security.py`)

- "Requiere login" sin usar el usuario en el handler → `dependencies=[Depends(get_current_user)]`
  en el decorador del router (no un parámetro sin usar en la firma). Ver
  `routes/suppliers.py` o `routes/incidents.py`.
- Necesitas el usuario autenticado (por ejemplo para filtrar por `user_id`) →
  parámetro `current_user: CurrentUser` en la firma del handler.
- Solo admin → dependencia `get_current_admin` en vez de `get_current_user`.
- "Propio recurso o admin" (rutas con un `{id}` de otro dominio, ej. `/users/{id}`)
  → llama a `ensure_self_or_admin(current_user, target_id)` al principio del
  handler (función plana, no `Depends`, porque necesita el id del path).

### Invalidar tokens sin tabla de revocados

Un JWT (access token o de un solo uso, como el de reset de password) puede
llevar `pwd_fp` (huella `sha256` del `hashed_password` vigente al emitirlo,
ver `password_fingerprint()` en `security.py`). Quien lo valida recalcula la
huella contra el hash *actual* y la compara; si no coincide, el token es
inválido. Reutiliza esto en vez de agregar una tabla de tokens revocados
cuando necesites invalidar sesiones tras un cambio de credenciales.

### Rate limiting

`rate_limit.py::enforce_rate_limit(key, max_attempts, window_seconds)` — dict
en memoria + lock, sin dependencia nueva. Úsalo en endpoints públicos
sensibles a fuerza bruta/abuso (login, forgot-password, reset-password).
Limitación conocida: no se comparte entre workers/instancias. En tests,
limpia `rate_limit._attempts` entre casos (ver la fixture `autouse` en
`tests/conftest.py`) para que no haya fugas de estado.

### Enviar un email

`mailer.py` es el único punto de envío (Resend). Sigue su patrón para
cualquier email nuevo: la función de envío nunca lanza (atrapa la excepción,
loguea y devuelve `False`), y si no hay API key configurada devuelve `False`
sin intentar nada — el caller decide el fallback (en `forgot-password`, es
loguear el link por consola). Así el flujo se puede probar en un checkout
nuevo sin cuenta de ningún proveedor externo. **No lo llames `email.py`**:
tapa el paquete `email` de la stdlib en este layout plano.

## Antes de commit

- Linter y tests del servicio en verde.
- Si cambió el contrato de la API, actualiza el frontend y la doc del servicio.
