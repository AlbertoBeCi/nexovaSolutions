# Rutas de reporting de negocio

Este módulo expone endpoints de administrador para el pipeline semanal de
desempeño por oficina y programa. Se monta en la aplicación FastAPI existente
mediante `services/api/reporting_adapter.py`; no es un servicio independiente.

El router importa las funciones del pipeline desde
`data/pipelines/pipeline.py`. No consulta telemetría ni implementa ETL. El
endpoint de reporte lee exclusivamente
`reporting.weekly_office_program_performance`; el endpoint manual solicita una
corrida al deployment de Prefect.

Consulta [el diseño y las instrucciones de operación](../../data/pipelines/PIPELINE_DESIGN.md)
y el [`README de services/api`](../api/README.es.md).
