# Carpeta `services`

Esta carpeta contiene **todos los servicios backend** (APIs y workers en segundo plano) relacionados con la compañía para el proyecto transversal de AI Engineering.

Cada subcarpeta dentro de `services/` debe corresponder a **un servicio concreto** (por ejemplo `admin-api`, `data-processor-worker`) e incluir su propia documentación técnica y funcional.

- **Propósito principal**: centralizar toda la lógica backend, APIs y consumidores de colas que dan soporte a los casos de uso de la compañía.
- **Recomendación**: documenta en este archivo (o en sub-READMEs) los servicios que vayas añadiendo, su objetivo, tecnología usada y cómo ejecutarlos.

## Resumen de servicios

- `api/`: Aplicación principal FastAPI para talento, proveedores, inventario, autenticación, almacenamiento de telemetría y reporting.
- `incident-manager-api/`: Servicio dedicado con SQLite y SQLAlchemy para gestión de incidencias.
- `job_runner/`: Módulo de control de estado para tareas en segundo plano (tabla `job_runs`). Implementa la máquina de estados canónica (`pending -> processing -> completed | failed`), distributed locks mediante `processing` e idempotencia diaria. Independiente de FastAPI.
- `reporting/`: Endpoints y adaptadores para reportes de desempeño de negocio.
- `telemetry/`: Análisis operacional de telemetría.

