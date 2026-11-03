# Análisis de telemetría de Nexova

Este módulo carga desde Supabase solo las filas y el período necesarios de la
tabla append-only `telemetry_events` y las transforma con Pandas. Sus métricas
independientes alimentan `GET /telemetry/report` en `services/api`:

- Volumen por día UTC y tipo de evento.
- Errores observados por el cliente por día y ruta.
- Latencia observada por el cliente por día y ruta.
- Proporción diaria de fallos de inicio de sesión.

Cada función recibe una ventana UTC explícita, aplica en SQL los filtros de
fecha y tipo de evento, convierte los timestamps antes de agrupar y devuelve
registros serializables a JSON. El módulo no crea otro servicio ni otra
conexión a la base de datos.

Ejecuta sus pruebas con `uv run pytest tests/test_telemetry_analysis.py` desde
`services/api`.
