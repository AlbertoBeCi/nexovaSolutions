# Carpeta `shared`

Esta carpeta está reservada para **recursos compartidos no empaquetados** del monorepo: plantillas, esquemas, assets comunes, documentación técnica breve o configuraciones que se comparten entre varios componentes.

- **Propósito principal**: ofrecer un lugar neutral para elementos reutilizables que no encajan como aplicación (`apps/`) ni como paquete/librería (`packages/`).
- **Recomendación**: documenta qué contiene cada subcarpeta/archivo y enlaza desde los componentes que lo consumen para mantener trazabilidad.

## `incidents_analysis.py`

Shim de compatibilidad. El código real se movió a
[`packages/shared/nexova_shared/incidents_analysis.py`](../packages/shared/README.md)
(un módulo de `packages/` en toda regla, porque lo importan 2+ carpetas:
`scripts/` y `services/api/`). Este archivo solo lo reexporta para que las
importaciones existentes (`from shared.incidents_analysis import ...`)
sigan funcionando. El código nuevo debe importar `nexova_shared.incidents_analysis`
directamente.
