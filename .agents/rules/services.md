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

## Antes de commit

- Linter y tests del servicio en verde.
- Si cambió el contrato de la API, actualiza el frontend y la doc del servicio.
