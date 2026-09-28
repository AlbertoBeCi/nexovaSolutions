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

## Antes de commit

- Linter y tests del servicio en verde.
- Si cambió el contrato de la API, actualiza el frontend y la doc del servicio.
