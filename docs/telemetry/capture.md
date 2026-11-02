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

## Dependencias de negocio pendientes

La base real tiene `Asset`, `AssetEntry` y `AssetExit`, pero no programa,
categoría analítica, proveedor estable, costes ni mínimos versionados. Por ello
`inbound_order_created`, `outbound_order_created`, `stock_threshold_triggered`
y `kit_cost_variance_detected` no se emitirán incompletos. Requieren una tarea
de metadatos y evaluadores transaccionales; no se inventan correspondencias.
