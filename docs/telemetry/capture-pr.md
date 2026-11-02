# feat: telemetry event capture

## Descripción del PR (borrador)

El backoffice y la API capturan eventos del contrato aprobado sin persistirlos
ni escribir en inventario. Se añade el stub de lotes, un servicio frontend con
cola acotada y productores de navegación, flujos, autenticación y diagnóstico.
El receptor responde `200 {"received": N}` y solo registra cantidad y tipos.

Los commits separan stub, servicio/identidad, instrumentación y cierre de métricas
obligatorias con datos de demostración. La captura visual sigue pendiente por un
bloqueo técnico de la integración del navegador.

## Eventos instrumentados

Todos los eventos del navegador pasan por `services/telemetry.ts::track()`;
los de servidor por `telemetry_capture.track()` y el mismo receptor interno.

| Evento | Origen en el plan | Autoridad | Componente/hook o productor |
| --- | --- | --- | --- |
| `inbound_order_created` | Obligatorio | Servidor | `create_inbound_order` y `telemetry_inventory`, después de commit. |
| `outbound_order_created` | Obligatorio | Servidor | `create_outbound_order`, operación confirmada bajo bloqueo. |
| `stock_threshold_triggered` | Obligatorio | Servidor | Evaluador de cruce antes/después de la salida, sin caché. |
| `kit_cost_variance_detected` | Obligatorio | Servidor | Evaluador de referencia ponderada comparable de 90 días y mínimo tres entradas. |
| `direct_stock_edit_rejected` | Obligatorio | Servidor | `TelemetryRequestMiddleware`, rechazo 422/405 de campos raíz de stock en rutas conocidas. |
| `inventory_metadata_missing` | Oportunidad | Servidor | Enriquecimiento ausente o histórico insuficiente; obligatorio incompleto no se emite. |
| `login_succeeded` | Oportunidad | Servidor | `routes/auth.py`, credenciales verificadas. |
| `login_failed` | Oportunidad | Servidor | `routes/auth.py`, credenciales rechazadas. |
| `session_expired` | Oportunidad | Servidor | `security.py`, access token firmado cuya expiración se verifica. |
| `session_invalidated` | Oportunidad | Servidor | `security.py`, contraseña cambiada o cuenta inactiva/eliminada. |
| `access_rejected` | Oportunidad | Servidor | Middleware, 401/403 de inventario. |
| `incident_analysis_completed` | Oportunidad | Servidor | Router de incidencias, conteos del resultado confirmado. |
| `page_viewed` | Oportunidad | Cliente | `TelemetryObserver` y señal de ruta mostrada de `RequireAuth`. |
| `page_performance_recorded` | Oportunidad | Cliente | Observador, `useReportWebVitals` y Navigation Timing. |
| `frontend_error_captured` | Oportunidad | Cliente | Observador central de errores y promesas no manejadas. |
| `session_logged_out` | Oportunidad | Cliente | `auth-api.logout`, acción explícita. |
| `client_request_completed` | Oportunidad | Cliente | Cliente HTTP central y login, excluyendo telemetría. |
| `filter_applied` | Oportunidad | Cliente | `ProductsPage`, resultados correctos tras cambiar oficina. |
| `flow_started` | Oportunidad | Cliente | `useInventoryTelemetry`, primera interacción en entrada/salida. |
| `flow_submitted` | Oportunidad | Cliente | Mismo hook, intento válido antes de enviar. |
| `flow_completed` | Oportunidad | Cliente | Mismo hook, creación confirmada por API. |
| `inventory_validation_failed` | Oportunidad | Cliente | Mismo hook, códigos de validación local. |

## Cobertura y datos de demostración

Los cinco productores obligatorios están implementados y se verifican juntos
contra el contrato aprobado mediante rutas reales en SQLite aislado. Preparan
los eventos dentro de la transacción y los publican solo después de commit;
un rollback no produce creación ni alerta. ±10% no dispara, una caída que sigue
bajo mínimo no repite y una recuperación rearma el siguiente cruce.

Por autorización expresa se crearon seis productos `[DEMO]` y veinte entradas
sintéticas, con tres programas y ambas oficinas. Las filas originales y usuarios
permanecen idénticos. Backup restaurado antes de cargar; repetición idempotente
con cero filas nuevas. Los veinte eventos de entrada y dos anomalías llegaron
al receptor. [Procedencia, IDs y sustitución futura](./demo-data.md).

## Web Vitals, autenticación y privacidad

LCP, INP y CLS se envían si Next los notifica; `load` se obtiene de Navigation
Timing cuando está disponible. Se vinculan a la primera página del documento.
Login y rechazo de sesión se observan centralmente en servidor. Solo una firma
y expiración verificadas generan `session_expired`; un 401 genérico no basta.

El puente autenticado devuelve un seudónimo HMAC `p1_`, separado del secreto JWT.
La clave nunca llega al navegador. Las rutas usan plantillas; los errores envían
códigos controlados, huella y conteos, sin texto ni stack. No se envían emails,
nombres, contraseñas, UUID de usuario original ni contenido CSV/formularios.

## Suposiciones y desviaciones

- Tres intentos totales y backoff de 1/2 segundos, según lo acordado.
- Captura de 20 eventos/10 segundos; las ventanas analíticas del plan se
  implementarán en procesamiento posterior.
- `login_failed` conserva `invalid_credentials`. Los fallos de red usan
  `client_request_completed.outcome: network_error`; la expiración usa
  `session_expired.reason_code: token_expired`, conforme al contrato vigente.
- Backend y frontend comparten receptor, pero el productor del servidor no
  realiza auto-HTTP. El endpoint configurado en backend reserva el patrón futuro.
- Los metadatos DEMO son sintéticos y están separados del inventario original.
  Una falta de enriquecimiento genera el diagnóstico aprobado. Candidatos requiere
  un puente de identidad del sujeto; website/application quedan fuera de esta captura.
- Stub público sin persistencia, allowlists por evento ni verificación de
  procedencia. Los productores se comprueban contra el JSON aprobado en pruebas.
  Sin outbox, deduplicación distribuida ni entrega exactamente una vez.
- Beacon tiene límite de 48 KiB por lote y respaldo keepalive; la salida de la
  página es mejor esfuerzo y puede perder una petición normal en curso.

## Validación

- API: **476 passed / 1 skipped**, 75,28 s, con almacenes temporales y conexiones
  remotas desactivadas; omisión existente de concurrencia PostgreSQL aislada.
- Backoffice: **176 pruebas / 19 suites**; TypeScript, lint, build y revisión de
  textos correctos. Sin nuevas dependencias.
- Contrato: **9.450 comprobaciones** de los 66 contratos aprobados.
- Docker: login y contexto HMAC 200; lote sintético de dos eventos por el proxy
  200/received 2, lote vacío 200/received 0; request ID conservado. Lecturas reales
  iniciales con 6 productos / 7 órdenes. Después de la carga DEMO autorizada:
  12 productos / 24 entradas / 3 salidas; originales y usuarios intactos.
  Sin cambios de esquema ni persistencia de eventos.

## Comprobación local y captura

Desde la raíz: `docker compose up -d api ui`. Abrir
`http://localhost:3001/login`, entrar con una cuenta existente y abrir DevTools →
Network → Preserve log. Filtrar `telemetry/events`, navegar al catálogo y cambiar
oficina. Tras 10 segundos o 20 eventos, comprobar el POST con `{events:[...]}` y
su respuesta `200 {"received": N}`. No crear movimientos sobre Supabase real para
esta verificación. Instrucciones de variables, arranque sin Docker, Beacon y
limitaciones: [capture.md](./capture.md#verificación-local).

> **CAPTURA PENDIENTE:** pegar aquí la captura de DevTools (Network) que muestre
> el lote enviado al stub y la respuesta HTTP 200. Ocultar tokens y datos de
> cuenta que puedan aparecer en otras peticiones.
>
> La integración detecta Chrome con Nexova, pero se detiene al no poder verificar
> la URL de la ventana. Se ha reproducido incluso con Chrome maximizado y la
> barra visible. La prueba HTTP del proxy está verificada; no se presenta como
> una captura visual del navegador. Mantener el PR en borrador hasta adjuntarla.
