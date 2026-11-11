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

En desarrollo, si la pantalla de recuperación está en un origen distinto al
backoffice, FastAPI debe permitir ese origen en CORS. En este monorepo la app
de operaciones puede usar `localhost:3002`; incluir `localhost:3001` para el
backoffice no autoriza automáticamente el puerto 3002.

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

## Reporting de negocio sobre telemetría

El reporte de negocio debe consumir el contrato de cada evento y volver a
validar sus dimensiones; la allowlist JSONB de `tags` es parte del contrato de
almacenamiento. Si se incorpora un KPI nuevo, comprueba en una prueba de ida y
vuelta que todos sus campos requeridos sobreviven la persistencia, sin añadir
columnas al envelope ni modificar el reporte técnico.

Para evitar que una reejecución cambie una semana ya publicada, reemplaza la
partición desde un staging completo dentro de una transacción y actualiza solo
las claves cuyo valor cambió. Deduplica por `event_id`; un identificador con
payload contradictorio debe fallar con auditoría, no escoger un valor al azar.
Una transformación determinista puede usar caché Prefect con una clave derivada
del digest canónico de eventos, la semana y la versión de transformación; deja
sin caché la extracción y la publicación.

Si la fuente no tiene señal de actividad/heartbeat, un extracto vacío no prueba
que la actividad de negocio sea cero. Conserva la partición anterior y deja la
corrida en estado fallido para reconciliar la ingestión en vez de borrar datos.
Mientras `telemetry_events` no conserve `received_at` y `ingestion_id`, repara
semanas con backfill manual y no declares detección automática de eventos tardíos.

## Subflows y dashboard semanal de negocio

Un subflow no sustituye a la lógica pura: agrupa tasks con una responsabilidad
de orquestación. Pasar semana, run_id y resultados explícitos permite probar y
reutilizar cada fase. El flow principal conserva la decisión de publicar, el
lock y el registro terminal. Los checkpoints distinguen extracción, validación,
transformación, staging y carga aunque las fases vivan ahora en subflows.

Para probar transformaciones decoradas por Prefect, llama a `task.fn(...)`
con eventos en memoria: ejecutas el cuerpo real sin servidor Prefect, caché ni
base de datos. Las pruebas de integración sí deben ejecutar el flow real y la
CLI, porque solo ellas comprueban el comportamiento conjunto de los subflows.
Una exportación opcional se invoca con `return_state=True` y se inspecciona
su estado para que un disco lleno no convierta una publicación correcta en un
fallo de negocio.

El dashboard elige la última semana **publicada**, que puede ser anterior a la
última semana calendario. Sus fechas se formatean explícitamente en UTC. Cuando
el usuario cambia de semana, cada respuesta lleva una clave de consulta y las
respuestas antiguas se ignoran. Así una petición lenta no puede sobrescribir
la semana seleccionada. Una tabla vacía significa ausencia de datos publicados;
no equivale a cuatro ceros y nunca justifica inventar actividad.

Una ejecución Prefect puede devolver éxito aunque falle el almacenamiento de
caché. Su clave se puede usar como nombre de archivo: evita caracteres como
los dos puntos de una clave compuesta en Windows. Un hash canónico conserva
la identidad de la entrada y permite verificar en integración que el archivo
cacheado realmente existe, en lugar de comprobar solo el código de salida.
