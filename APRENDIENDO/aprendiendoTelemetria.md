# Aprendiendo: reporte técnico de telemetría

Este documento recorre el reporte técnico de Nexova desde los eventos guardados
hasta el JSON que consume el dashboard. El objetivo es observar el sistema
(volumen, errores, latencia y autenticación), no calcular ventas ni conversión.

## Flujo de los datos

```text
telemetry_events (SQL acotado) → DataFrame → tipos UTC y dimensiones tags
→ groupby/agg → JSON → GET /telemetry/report (cache de 60 s)
```

### 1. Cargar en SQL solo el rango necesario

Las métricas reciben `start_date` y `end_date` explícitos. Cada consulta aplica
la ventana semiabierta `[inicio, fin)`: el inicio está incluido y el fin queda
excluido. Las métricas específicas cargan además solo los tipos que necesitan:

```sql
SELECT event_type, timestamp, tags
FROM telemetry_events
WHERE timestamp >= :start_date AND timestamp < :end_date
  AND event_type IN ('client_request_completed');
```

El volumen diario sí consulta todos los tipos del período. La tasa de errores y
la latencia leen `client_request_completed`; la autenticación carga
`login_failed` y `login_succeeded` juntos, porque el denominador incluye ambos.
Filtrar el rango en Python después de traer toda la tabla desperdicia memoria y
traslada trabajo que corresponde a la base de datos.

### 2. Refinar y convertir los tipos antes de agrupar

`tags` es JSONB en PostgreSQL. El pipeline normaliza sus valores a diccionarios,
extrae campos como `route_template`, `status_code` y `duration_ms`, y descarta
filas sin la dimensión requerida. Los timestamps llegan como fecha/hora, pero
se convierten de forma explícita a datetime UTC antes de extraer el día:

```python
frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True, errors="coerce")
frame = frame.dropna(subset=["timestamp"])
frame["date"] = frame["timestamp"].dt.strftime("%Y-%m-%d")
```

Agrupar por una cadena de fecha sin normalizar zona horaria puede separar mal
eventos que pertenecen al mismo día UTC.

### 3. Agrupar y agregar una pregunta operacional

Cada función independiente devuelve registros JSON serializables:

| Función | Pregunta | Dimensiones / agregaciones |
| --- | --- | --- |
| `events_per_day` | ¿Qué volumen de eventos hubo cada día? | Día UTC y `event_type`; conteo `events` |
| `request_error_rate` | ¿Qué rutas concentran fallos observados? | Día y `route_template`; requests, errores y proporción |
| `latency_by_route` | ¿Cómo responde cada ruta? | Día y `route_template`; muestras, media y p95 en ms |
| `auth_failure_rate` | ¿Qué proporción de intentos de login falla? | Día; fallos / (`login_failed` + `login_succeeded`) |

El cliente considera error una respuesta HTTP con código 400–599 o un fallo de
red (código 0). La latencia usa muestras numéricas entre 0 y 3.600.000 ms. Estos
campos reflejan lo observado por el cliente; no equivalen a una medición de
trazas internas del servidor.

### 4. Resolver el período y servir con caché

`GET /telemetry/report` acepta fechas ISO 8601 con zona horaria. Si no se pasan,
calcula los últimos siete días hasta el instante actual, en UTC. Resuelve una
sola ventana y la pasa a las cuatro funciones. Solo administradores pueden
consultar el endpoint. El pipeline vive fuera de la ruta y el resultado se
cachea en memoria durante 60 segundos por ventana solicitada.

La captura de `login_succeeded` y `login_failed` también es best-effort y se
ejecuta después de enviar la respuesta HTTP. Una escritura lenta o fallida en
Supabase no debe retrasar ni cambiar el resultado del inicio de sesión. FastAPI
permite programar este trabajo con `BackgroundTasks`; el 401 usa una respuesta
JSON con la tarea asociada para conservar el mismo contrato de error.

Ejemplo de respuesta (valores ilustrativos, forma del contrato real):

```json
{
  "period": {
    "from": "2026-10-27T12:00:00Z",
    "to": "2026-11-03T12:00:00Z"
  },
  "metrics": {
    "events_per_day": [
      {"date": "2026-11-02", "event_type": "client_request_completed", "events": 18}
    ],
    "request_error_rate": [
      {"date": "2026-11-02", "route_template": "/inventory/products", "requests": 18, "errors": 1, "error_rate": 0.0556}
    ],
    "latency_by_route": [
      {"date": "2026-11-02", "route_template": "/inventory/products", "samples": 18, "mean_ms": 84.5, "p95_ms": 151.2}
    ],
    "auth_failure_rate": [
      {"date": "2026-11-02", "attempts": 4, "failures": 1, "failure_rate": 0.25}
    ]
  }
}
```

Los valores anteriores son ilustrativos, no una captura de la base de datos.
Las funciones de análisis están en `services/telemetry/analysis.py`, la ruta en
`services/api/routes/telemetry_report.py` y el dashboard en
`uis/backoffice/app/telemetry/`.

## Verificación local

Las pruebas usan SQLite/fixtures aislados: comprueban el límite inclusivo y
exclusivo, zonas UTC, dimensiones ausentes, fórmulas, serialización, permisos,
ventanas predeterminadas y explícitas, caché y fallos de almacenamiento. Desde
`services/api`:

```powershell
uv run pytest tests/test_telemetry_analysis.py tests/test_telemetry_report.py
```

No se necesita escribir en Supabase para ejecutar estas pruebas.
