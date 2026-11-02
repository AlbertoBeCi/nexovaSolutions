# Captura de telemetría

## Contrato y alcance

La captura conserva `telemetry-plan.md` y `event-schemas.json`. No persiste
eventos ni modifica inventario. La ingesta es un stub de verificación, no una
confirmación durable ni un colector que verifique la procedencia del navegador.

## Fase 1 — stub

`POST /telemetry/events` es público para admitir Beacon sin cabeceras de
autorización. Recibe `{ "events": [...] }`, valida el envelope de ocho campos
y devuelve `200 { "received": N }`. Un lote vacío devuelve `received: 0`.
Identificadores de evento/petición/sesión son UUID; la identidad es un seudónimo
`p1_` o null. Timestamp exige zona horaria y se normaliza a UTC.

El modelo no impone allowlists de propiedades por evento. Solo se registran
cantidad y tipos; no se registra `properties`. `TELEMETRY_ENDPOINT` se declara
en el backend para el patrón futuro, sin reenvío de tráfico.

Pruebas: lotes, campos obligatorios, tipos, fechas, privacidad de logs y CORS
para JSON/Beacon. Se ejecutan con almacenes temporales y sin Supabase.

## Fase 2 — servicio e identidad

`track(eventType, properties): void` es la única función de captura. Las funciones
de ciclo de vida/contexto no son otros puntos de tracking. El servicio se inicia
desde el observador del layout y usa exclusivamente
`NEXT_PUBLIC_TELEMETRY_ENDPOINT`: vacío desactiva la captura.

La cola vive en memoria y conserva un snapshot al capturar. Envía hasta 20
eventos por petición al alcanzar 20 o a los 10 segundos del primero pendiente;
los siguientes eventos no aplazan el plazo. Tres intentos totales, esperas de
1 y 2 segundos, timeout de 5 segundos y descarte final. No reintenta operaciones
de negocio. Límites: 16 KiB/evento, 500 eventos o 1 MiB, priorizando errores.

Al ocultar la página o en `pagehide`, Beacon usa Blob JSON y lotes de hasta
48 KiB; si no acepta, se intenta `fetch keepalive`. No se duplica una cola ya
vaciada ni se reenvía el lote normal en curso. El cierre es mejor esfuerzo:
puede perderse una petición en curso y no hay confirmación durable.

`GET /telemetry/context` exige la sesión existente y devuelve solo `userId`,
`keyVersion` y `schemaVersion`. La clave privada `TELEMETRY_HMAC_KEY_P1` produce
HMAC-SHA256 de `user:<uuid>`, separado de JWT; no llega al navegador. Sin clave,
503 en este endpoint y captura anónima, sin cerrar la sesión de la aplicación.
El cliente HTTP conserva su comportamiento habitual salvo para esta consulta
opcional, que usa `redirectOnUnauthorized: false`.

Sesión analítica por pestaña: UUID y último uso en `sessionStorage`, con respaldo
en memoria; renovación a los 30 minutos de inactividad y al login, limpieza al
logout. El seudónimo permanece en memoria y nunca se rellenan eventos anónimos
retrospectivamente. Los contratos mínimos del cliente se derivan del esquema
aprobado; rechazan claves extra y valores fuera de catálogo antes de encolar.

Para desarrollo fuera de Docker, configurar el endpoint en
`uis/backoffice/.env.local`; en Docker, usar `/_nexova-api/telemetry/events`.

## Fase 3 — disparadores implementados

Los diez tipos del navegador pasan por `track()` del servicio. Los doce tipos
del servidor pasan por `telemetry_capture.track()` y el mismo receptor interno,
sin peticiones HTTP a sí mismo. La autoridad del navegador es siempre
`client_observed`; los productores internos usan `server`. El stub público no
autentica esa declaración y no debe usarse como fuente contable.

| Evento | Prioridad del plan | Punto de captura |
| --- | --- | --- |
| `inbound_order_created` | Obligatorio | Transacción de entrada: prepara dimensiones y costes bajo bloqueo; publica después de commit. |
| `outbound_order_created` | Obligatorio | Transacción de salida confirmada, con el stock validado. |
| `stock_threshold_triggered` | Obligatorio | Misma transacción: `stock_before >= threshold` y `stock_after < threshold`; las lecturas no disparan. |
| `kit_cost_variance_detected` | Obligatorio | Entrada confirmada; referencia ponderada de 90 días, mínimo tres antecedentes comparables y variación absoluta estrictamente mayor que 10%. |
| `direct_stock_edit_rejected` | Obligatorio | `TelemetryRequestMiddleware`: raíz JSON con `stock`, `current_stock` o `currentStock`, ruta conocida de inventario y respuesta 422/405. |
| `inventory_metadata_missing` | Oportunidad | Productor de inventario: datos de enriquecimiento o referencia insuficientes, sin emitir un obligatorio incompleto. |
| `login_succeeded` | Oportunidad | Router de autenticación, tras verificar credenciales. |
| `login_failed` | Oportunidad | Router de autenticación, credenciales rechazadas. |
| `session_expired` | Oportunidad | Dependencia central de seguridad, access token con firma válida y expiración comprobada. |
| `session_invalidated` | Oportunidad | Dependencia de seguridad, contraseña cambiada o cuenta inactiva/eliminada. |
| `access_rejected` | Oportunidad | Middleware, respuesta 401/403 en rutas conocidas de inventario. |
| `incident_analysis_completed` | Oportunidad | Router de incidencias, después de guardar el resultado del análisis; solo conteos y duración. |
| `page_viewed` | Oportunidad | `TelemetryObserver`, cambio de ruta mostrada; espera `RequireAuth` en rutas protegidas y omite alias con redirección. |
| `page_performance_recorded` | Oportunidad | `useReportWebVitals` y Navigation Timing del observador. |
| `frontend_error_captured` | Oportunidad | Observador central de `error` y `unhandledrejection`. |
| `session_logged_out` | Oportunidad | `auth-api.logout`, solo cierre explícito con token presente. |
| `client_request_completed` | Oportunidad | Cliente HTTP central y login; omite las rutas de telemetría. |
| `filter_applied` | Oportunidad | Catálogo de productos, cambio de oficina después de recibir resultados correctos. |
| `flow_started` | Oportunidad | Hook común de formularios de entrada/salida, primera interacción. |
| `flow_submitted` | Oportunidad | Hook común, envío que supera la validación local. |
| `flow_completed` | Oportunidad | Hook común, respuesta correcta de creación. |
| `inventory_validation_failed` | Oportunidad | Hook común, validación local rechazada; códigos controlados y dimensiones disponibles. |

### Correlación, privacidad y garantías

Cada petición del cliente central lleva `X-Request-ID`, `X-Nexova-App` y, si
existe, `X-Telemetry-Session-ID`. La API valida UUID y devuelve el identificador
de petición. Un envío de formulario comparte ese identificador entre el intento,
la llamada HTTP y la confirmación; un reintento conserva el flujo y obtiene otro
`attempt_id`. No hay una variable global de «última respuesta» para correlacionar
peticiones concurrentes. Otros eventos reciben un identificador propio.

Los contratos del cliente se derivan del JSON aprobado. Las pruebas validan
eventos reales de ambos productores contra ese JSON, incluidos nombres, campos
permitidos y autoridad. No se envían emails, nombres, UUID de usuario original,
proveedor escrito en el formulario, contenido CSV, mensajes ni stacks de errores.
Las rutas dinámicas usan plantillas, sin query strings.

Los errores usan códigos controlados y SHA-256 de código/plantilla/versión. La
primera aparición se emite inmediatamente y las repeticiones se cuentan en una
ventana de 60 segundos, sin volver a contar la primera. Esta huella agrupa
categorías amplias; no identifica la excepción original. Si el navegador no
dispone de la capacidad necesaria, se omite esa medición.

Se registran LCP, INP y CLS cuando Next los notifica, y `load` cuando Navigation
Timing lo permite. Se vinculan a la primera página del documento: no se atribuye
un Web Vital de carga a cada navegación SPA. No hay mediciones sintéticas de
rendimiento ni eventos FCP/TTFB ajenos al contrato.

Las invalidaciones/expiraciones se deduplican en memoria durante 30 minutos por
sesión y motivo (respaldo mediante hash interno del token), con un máximo de
1.024 claves por proceso. No constituye deduplicación distribuida del colector.
La inspección de stock solo analiza un JSON de hasta 16 KiB, con campos en la
raíz; no cambia rutas, permisos ni respuestas. Sin consulta adicional para
resolver producto, envía las dimensiones nulas admitidas por el contrato y
`resolution_reason: product_unknown`. Un 401/403 genera rechazo de acceso.

### Suposiciones y diferencias respecto a la petición inicial

- Tres intentos **totales**, con esperas de 1 y 2 segundos, según la decisión
  acordada; no tres reintentos adicionales.
- El lote de captura usa 10 segundos/20 eventos. Las ventanas analíticas de
  15 minutos del plan pertenecen al procesamiento posterior.
- El contrato vigente permite `login_failed.reason_code: invalid_credentials`.
  El fallo de red se registra en `client_request_completed` con `network_error`;
  una expiración verificada usa `session_expired` con `token_expired`. No se
  agregan variantes al esquema para acomodar la redacción inicial.
- La identidad es un HMAC emitido por el servidor, no el identificador personal
  de la sesión. Durante la consulta opcional de identidad puede haber eventos
  anónimos; no se reescriben después.
- Alcance: backoffice y API central. El cliente del playground de candidatos,
  website y application no se instrumentan aquí. Los eventos de candidatos
  requieren un puente de identidad del sujeto antes de capturarse sin PII.
- Sin persistencia, outbox, pipeline, tablas nuevas, migraciones ni cambios de
  stock directo desde la captura. La carga DEMO autorizada crea órdenes de negocio
  separadas y se documenta en [demo-data.md](./demo-data.md). El stub acepta el envelope, pero todavía no aplica allowlists por tipo
  ni verifica productores. No hay entrega exactamente una vez.

## Verificación local

### Docker ya configurado

Desde la raíz, los archivos privados existentes deben contener la conexión de
Supabase y los secretos de autenticación. `services/api/.env` contiene además
`TELEMETRY_HMAC_KEY_P1` (clave aleatoria privada, independiente de JWT); `.env`
de raíz usa `NEXT_PUBLIC_TELEMETRY_ENDPOINT=/_nexova-api/telemetry/events`.
No sobrescribir esos archivos con los ejemplos ni ejecutar seeds.

```powershell
docker compose up -d api ui
# Si se han cambiado variables de entorno, recrear para recargarlas:
docker compose up -d --no-deps --force-recreate api ui
docker compose logs -f api
```

Abrir `http://localhost:3001/login`, entrar con una cuenta existente y abrir
DevTools → Network → Preserve log. Filtrar por `telemetry/events`, navegar al
catálogo y cambiar oficina. Esperar hasta 10 segundos o reunir 20 eventos.
Debe verse un POST a `/_nexova-api/telemetry/events`, cuerpo `{events:[...]}` y
respuesta `200 {"received": N}`. La consola de la API muestra
`telemetry_batch received=N event_types=...`, sin propiedades.

Inspeccionar los ocho campos del envelope; `userId` será `p1_` más 64 caracteres
hexadecimales o null, nunca un email o UUID original. `/telemetry/context` debe
devolver 200 tras login; su fallo opcional no cierra la sesión. Comprobar rutas
normalizadas y ausencia de contenido del formulario. Al pasar la pestaña a
segundo plano, lo pendiente se envía con Beacon (si el navegador lo acepta).

La navegación y los filtros son suficientes para esta comprobación sobre datos
reales. Las pruebas de creación, invalidación de cuentas, rechazo de stock y CSV
se realizan con fixtures aisladas; no crear movimientos para probar telemetría
en Supabase real. La captura visual de Network queda para adjuntar en el PR.

### Sin Docker

Usar `services/api/.env` existente con la clave HMAC privada. En
`uis/backoffice/.env.local`, configurar:

```dotenv
NEXT_PUBLIC_INCIDENTS_API_URL=http://localhost:8000
NEXT_PUBLIC_TELEMETRY_ENDPOINT=http://localhost:8000/telemetry/events
```

En dos terminales desde la raíz:

```powershell
cd services/api
uv sync
uv run uvicorn main:app --reload --port 8000
```

```powershell
cd uis/backoffice
npm ci
npm run dev -- --port 3001
```

Reiniciar Next si se cambia una variable `NEXT_PUBLIC_*`. Repetir la comprobación
en Network; ahora el POST va directamente a `localhost:8000/telemetry/events`.
CORS incluye localhost/127.0.0.1 en 3000 y 3001, permite JSON y expone
`X-Request-ID`.

### Resultados de esta entrega (02/11/2026)

- API: 476 passed / 1 skipped, dotenv y conexiones remotas desactivados,
  almacenes temporales. La omisión es concurrencia PostgreSQL aislada.
- Backoffice: 176 pruebas / 19 suites; tipos, lint, build y revisión de textos
  correctos. Sin dependencias nuevas; la API no tiene linter ni type-checker
  independientes configurados.
- La prueba de contrato del servidor requiere Node y el Ajv del tooling del
  backoffice (`npm ci` en esa carpeta); no añade dependencias Python.
- Contratos: `node scripts/validate-telemetry.cjs`, 9.450 comprobaciones correctas.
- Docker: login y puente HMAC 200, correlación de petición conservada; POST por
  proxy con dos eventos sintéticos → 200/received 2, lote vacío → 200/received 0.
  Lecturas reales: 6 productos, 7 órdenes; filtros 4 Valencia / 2 Miami; archivo
  de usuarios idéntico. Sin escrituras de negocio, seeds ni migraciones.

Verificación inicial anterior al dataset. Después, por autorización expresa, se
crearon seis productos `[DEMO]` y veinte entradas: totales 12 activos, 24 entradas
y 3 salidas. Firmas de todas las filas originales y del fichero de usuarios
idénticas. Backup de `public` restaurado correctamente en PostgreSQL aislado antes
de cargar. La repetición del seed creó cero filas. Se observaron 20 eventos de
entrada y dos anomalías de coste en los logs del receptor. Los cinco tipos
obligatorios se verifican conjuntamente con rutas reales sobre SQLite aislado.

## Metadatos y alcance de los cinco obligatorios

Los cinco productores están implementados. `TELEMETRY_INVENTORY_METADATA_PATH`
apunta a un registro privado de metadatos de demostración, con programas
controlados, clasificación por producto, mínimo/versionado, costes históricos
por entrada y cotizaciones explícitamente sintéticas. No se infiere ninguna
clasificación de los seis activos originales. Un proveedor libre no registrado
no recibe un ID inventado.

Los costes DEMO provienen de la cotización configurada para ese producto,
oficina y etiqueta exacta `DEMO TELEMETRIA - PROVEEDOR 01`; no son precios reales.
El seed conserva los veinte snapshots de costes en el registro. Para operaciones
posteriores, la API conserva hasta 10.000 snapshots en memoria; si al reiniciar
falta historial completo, registra el diagnóstico y omite la anomalía. Esto
evita reconstruir precios pasados con cotizaciones nuevas.

La captura se prepara bajo el bloqueo del activo, no usa cachés de listados y
solo se publica después del commit. Un rollback no emite creación ni alerta.
La multiplicación y comparación de costes usan enteros exactos; ±10% no dispara,
0 puede ser un coste DEMO explícito y una referencia cero no genera anomalía.
Se excluyen otros productos, oficinas, proveedores y monedas.

La entrega de captura sigue siendo de mejor esfuerzo, sin outbox durable. El
registro privado no almacena eventos y no sustituye las futuras tablas de datos
reales de negocio. Para sustituir la demostración habrá que conectar los
metadatos reales aprobados conservando estos contratos y disparadores. Fuera del
dataset, una dimensión ausente continúa generando `inventory_metadata_missing`.
