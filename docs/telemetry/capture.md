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
desde el layout en la fase de instrumentación y usa exclusivamente
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

## Dependencias de negocio pendientes

La base real tiene `Asset`, `AssetEntry` y `AssetExit`, pero no programa,
categoría analítica, proveedor estable, costes ni mínimos versionados. Por ello
`inbound_order_created`, `outbound_order_created`, `stock_threshold_triggered`
y `kit_cost_variance_detected` no se emitirán incompletos. Requieren una tarea
de metadatos y evaluadores transaccionales; no se inventan correspondencias.
