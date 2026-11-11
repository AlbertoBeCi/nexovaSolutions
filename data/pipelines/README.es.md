# Carpeta `data/pipelines`

Esta carpeta agrupa **todos los pipelines de datos del monorepo** relacionados con la compañía: procesos de ingesta, ETL/ELT, limpieza, transformación y carga hacia sistemas analíticos o de producción.

Cada subcarpeta o archivo dentro de `data/pipelines/` debe representar **un pipeline o conjunto de jobs** (por ejemplo `sales-etl`, `telemetry-stream`, `customer-segmentation`) e incluir la configuración necesaria (scripts, orquestación, conectores, esquemas, etc.).

- **Propósito principal**: unificar en un único lugar la lógica de movimiento y transformación de datos que soporta las aplicaciones y analíticas de la compañía.
- **Recomendación**: documenta aquí los pipelines que vayas añadiendo, describiendo su objetivo, orígenes/destinos de datos, dependencias y cómo ejecutarlos en desarrollo, pruebas y producción.

## Desempeño semanal por oficina y programa

El flow `weekly_office_program_performance_flow` lee los eventos KPI de
`telemetry_events` en modo de solo lectura y publica las cuatro métricas del
diseño en `reporting.weekly_office_program_performance`. Requiere Prefect 3 y
las variables `TELEMETRY_READONLY_DATABASE_URL` y `REPORTING_DATABASE_URL`.
En local puede usarse `SUPABASE_DATABASE_URL` como fallback para ambas.

Desde la raíz del monorepo, con el entorno API instalado:

```bash
uv run --project services/api python data/pipelines/pipeline.py
uv run --project services/api python data/pipelines/pipeline.py --week-start 2026-11-02 --trigger backfill
uv run --project services/api python data/pipelines/pipeline.py --serve
```

El deployment programado corre los lunes a las 06:00 UTC y procesa la última
semana ISO completa. Aplica primero
[`services/api/migrations/002_weekly_business_reporting.sql`](../../services/api/migrations/002_weekly_business_reporting.sql).
El diseño, sus límites de v1 y la operación están en
[`PIPELINE_DESIGN.md`](./PIPELINE_DESIGN.md).
