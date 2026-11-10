# Plan de implementación — pipeline resiliente de desempeño de negocio

## Seguimiento

- [x] 1. Preparación: rama `feature/resilient-business-performance-pipeline` desde `origin/main` actualizado.
- [x] 2. Contrato: allowlist de `tags` y pruebas de conservación de campos KPI.
- [x] 3. Dependencia y migración: Prefect 3 y esquema de reporting explícito.
- [x] 4. Transformación: validación, deduplicación, agregación y pruebas KPI.
- [x] 5. Flow Prefect, reintentos, caché, checkpoints, staging e idempotencia.
- [x] 6. CLI programado y documentación operativa.
- [x] 7. Endpoints de reporting y pruebas de auth/contrato.
- [x] 8. Empaquetado y validación local sintética; PostgreSQL real no disponible en este entorno.
- [ ] 9. Documentación final, commits, push y PR.

## Objetivo y límites

Implementar el diseño aprobado en `data/pipelines/PIPELINE_DESIGN.md`: leer telemetría de forma read-only, generar los KPIs acordados en `reporting.weekly_office_program_performance`, añadir endpoints al área separada `services/reporting/` y conservar intacto el reporte técnico. El trabajo se hará por etapas pequeñas y revisables; al terminar cada etapa se revisarán los cambios antes de continuar.

Fuentes de contrato: el briefing adjunto por el usuario, los documentos de diseño y telemetría del repositorio, `CONTEXT.md` y las reglas de `AGENTS.md`. Los nombres del KPI y la forma JSON del endpoint seguirán el briefing. No se redefinirán métricas.

Fuera de alcance: cambios a `services/telemetry/analysis.py`, `GET /telemetry/report`, escrituras a `telemetry_events`, cambios a `docker-compose.yml` o infraestructura, detección automática de eventos tardíos (v1 usará backfill semanal manual), y alteraciones a documentación fuente protegida.

## Plan por etapas

1. **Preparación y rama.** Guardar este plan, verificar árbol limpio, actualizar referencias de Git, partir de `origin/main` y crear una rama de implementación. Confirmar que el diseño aprobado está en la base.
2. **Contrato y compatibilidad mínima de telemetría.** Trazar KPIs y campos obligatorios hasta los esquemas/eventos reales. Añadir únicamente los campos de negocio aprobados que falten al allowlist de `tags`, conservando el sobre inmutable y el análisis técnico. Agregar pruebas de ida y vuelta del almacenamiento.
3. **Dependencia y esquema de reporting.** Incorporar Prefect 3 al proyecto `services/api`; crear migración SQL explícita bajo `reporting` para la tabla KPI y las tablas auxiliares de corrida/staging/lease descritas por el diseño. No ejecutar DDL automáticamente al arrancar la API.
4. **Transformación de dominio.** Crear funciones reutilizables en `data/process/` para deduplicar, validar y agregar eventos a semanas ISO UTC y las oficinas/programas válidos. Aplicar exactamente los KPIs: `total_material_cost`, `kits_delivered_count`, `shortage_events_count`, `cost_variance_events_count`, con EUR para Valencia y USD para Miami. Añadir fixtures sintéticos y pruebas unitarias.
5. **Pipeline Prefect.** Implementar `data/pipelines/pipeline.py` con tasks explícitas para extracción de solo lectura, validación/dedupe, agregación, validación de agregado, staging, reemplazo idempotente de semana y finalización/auditoría. Configurar reintentos para interacciones externas, cache persistente de una hora para transformación determinista, manejo explícito de task opcional con `return_state=True`, metadatos de corrida, bloqueo por semana y salida legible de errores. Los extractos/intermedios irán a `data/raw/` y las evaluaciones a `data/eval/`, excluidos de Git cuando sean artefactos runtime.
6. **CLI, calendario y documentación de operación.** Permitir ejecución directa del script con backfill opcional por semana; documentar el comando y la frecuencia semanal (lunes 06:00 UTC). Configurar la ejecución programada mediante Prefect sin acoplarla al arranque de FastAPI.
7. **API de reporting.** Añadir módulo separado en `services/reporting/` e incluir sus rutas en la app FastAPI existente: consulta de última corrida, disparo manual de flow, consulta de filas KPI según contrato. Restringir administración según la convención actual y mantener la respuesta de negocio precisa. El disparo delegará al flow/deployment; no duplicará lógica ETL.
8. **Empaquetado y pruebas de integración.** Ajustar el empaquetado Docker solo para que el servicio pueda importar reporting/pipeline y sus esquemas necesarios; no tocar Compose. Añadir/actualizar pruebas de autenticación, contratos, límites/errores, retries/cache/idempotencia y persistencia. Usar PostgreSQL desechable para integración si está disponible; no apuntar a la base real ni ejecutar pruebas destructivas sin backup verificado.
9. **Cierre de cambios y PR.** Revisar diffs completos y que telemetry técnico siga intacto; ejecutar comprobaciones del servicio, pruebas de pipeline y comando CLI contra datos sintéticos; actualizar README/memory-bank/TESTING y aprendizaje relevante. Crear commits pequeños con la convención del repositorio, subir la rama y abrir PR contra `main` según la autorización original. Compartir enlace y resumen de validación.

## Decisiones confirmadas

- Excepción mínima aprobada: preservar en `tags` los campos de negocio ya definidos en contratos, sin añadir columnas a `telemetry_events`.
- Versión inicial: backfill explícito por semana; detección automática de tardíos queda pendiente.
- Se conserva el sistema de reporte técnico existente sin cambios.

## Criterios de aceptación

- Flow Prefect con al menos tres tasks, pasos separados, tolerancia a fallo opcional, retries y caché de transformación por una hora.
- Lectura read-only de `telemetry_events`; escrituras aisladas a `reporting`; carga repetida de igual semana sin duplicados ni cambios innecesarios.
- Auditoría de corrida con inicio, fin, procesados, estado y errores.
- CLI ejecutable; frecuencia semanal y comando documentados.
- Tres endpoints de reporting conforme a briefing, con autenticación y pruebas.
- Campos de eventos permiten extraer correctamente los KPIs sin modificar análisis/reporte técnico.
- Pruebas relevantes pasan; PR contra `main` enlazado al usuario.
