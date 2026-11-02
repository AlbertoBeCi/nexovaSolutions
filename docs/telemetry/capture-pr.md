# feat: telemetry event capture

## Descripción del PR (borrador)

El backoffice y la API capturan eventos del contrato aprobado sin persistirlos
ni escribir en inventario. Se añade el stub de lotes, un servicio frontend con
cola acotada y productores de navegación, flujos, autenticación y diagnóstico.
El receptor responde `200 {"received": N}` y solo registra cantidad y tipos.

Los cambios se dividen en tres commits: stub, servicio/identidad e instrumentación.
Este documento es el borrador solicitado; todavía no se ha abierto un PR.

## Eventos instrumentados

Todos los eventos del navegador pasan por `services/telemetry.ts::track()`;
los de servidor por `telemetry_capture.track()` y el mismo receptor interno.

| Evento | Origen en el plan | Autoridad | Componente/hook o productor |
| --- | --- | --- | --- |
| `direct_stock_edit_rejected` | Obligatorio | Servidor | `TelemetryRequestMiddleware`, rechazo 422/405 de campos raíz de stock en rutas conocidas. |
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

## Métricas obligatorias pendientes

| Evento | Prerrequisito y ubicación futura |
| --- | --- |
| `inbound_order_created` | Programa, categoría analítica, proveedor estable y coste; transacción de entrada en API. |
| `outbound_order_created` | Programa y categoría analítica; transacción de salida en API. |
| `stock_threshold_triggered` | Umbral/versionado y dimensiones de producto; evaluador de cruces tras movimientos. |
| `kit_cost_variance_detected` | Costes, moneda, proveedor y comparables históricos; evaluador de variación. |

La base real carece de esos metadatos. No se inventan valores ni se transforman
lecturas de UI en eventos autoritativos. **Queda completado uno de los cinco
eventos obligatorios.** `direct_stock_edit_rejected` utiliza la resolución nula
permitida por el contrato cuando no se resuelve el producto.

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
- Cuatro métricas obligatorias siguen bloqueadas. Candidatos requiere un puente
  de identidad del sujeto; website/application quedan fuera de esta captura.
- Stub público sin persistencia, allowlists por evento ni verificación de
  procedencia. Los productores se comprueban contra el JSON aprobado en pruebas.
  Sin outbox, deduplicación distribuida ni entrega exactamente una vez.
- Beacon tiene límite de 48 KiB por lote y respaldo keepalive; la salida de la
  página es mejor esfuerzo y puede perder una petición normal en curso.

## Validación

- API: **452 passed / 1 skipped**, 70,19 s, con almacenes temporales y conexiones
  remotas desactivadas; omisión existente de concurrencia PostgreSQL aislada.
- Backoffice: **176 pruebas / 19 suites**; TypeScript, lint, build y revisión de
  textos correctos. Sin nuevas dependencias.
- Contrato: **9.450 comprobaciones** de los 66 contratos aprobados.
- Docker: login y contexto HMAC 200; lote sintético de dos eventos por el proxy
  200/received 2, lote vacío 200/received 0; request ID conservado. Lecturas reales
  con 6 productos / 7 órdenes y filtros 4 Valencia / 2 Miami. Usuarios intactos;
  sin crear movimientos, ejecutar seeds o aplicar migraciones.

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
