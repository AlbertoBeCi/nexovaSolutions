# Datos sinteticos de demostracion de telemetria

**Procedencia: `synthetic_demo`. Fecha: 02/11/2026.** Estos datos se crearon por
autorización expresa para trabajar con la captura. No son compras, programas,
proveedores, costes ni entregas reales de Nexova. No utilizarlos como evidencia
comercial ni agregarlos como datos de producción. El entorno sigue siendo
`development`; no se añade una propiedad de procedencia ajena al contrato.

## Qué se creó en Supabase

Seis productos nuevos, con nombre `[DEMO]` y SKU `DEMO-TEL-*`, y **20 órdenes de
entrada** de dos unidades cada una. No se crearon salidas. Los seis activos,
cuatro entradas y tres salidas anteriores permanecen idénticos; sus firmas y las
del archivo de usuarios se verificaron antes/después.

| Asset.id | SKU | Oficina | Categoría analítica | Programa sintético | IDs de entrada | Costes unitarios, en céntimos |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | `DEMO-TEL-001` | Valencia | `training_kit` | `demo-ventas-b2b` | 5, 6, 7, 8 | 1000, 1000, 1000, 1200 EUR |
| 8 | `DEMO-TEL-002` | Miami | `training_kit` | `demo-ventas-b2b` | 9, 10, 11, 12 | 1000, 1000, 1000, 1200 USD |
| 9 | `DEMO-TEL-003` | Valencia | `certification` | `demo-liderazgo` | 13, 14, 15 | 1000, 1000, 1000 EUR |
| 10 | `DEMO-TEL-004` | Miami | `certification` | `demo-liderazgo` | 16, 17, 18 | 1000, 1000, 1000 USD |
| 11 | `DEMO-TEL-005` | Valencia | `onboarding_equipment` | `demo-onboarding` | 19, 20, 21 | 1000, 1000, 1000 EUR |
| 12 | `DEMO-TEL-006` | Miami | `onboarding_equipment` | `demo-onboarding` | 22, 23, 24 | 1000, 1000, 1000 USD |

Los IDs corresponden a esta ejecución; un checkout nuevo puede asignar otros.
Proveedor de todos los ejemplos: etiqueta `DEMO TELEMETRIA - PROVEEDOR 01` e ID
`demo-supplier-01`. Los costes se inventaron exclusivamente para esta prueba,
no se dedujeron de nombres, tarifas mensuales ni precios de los activos reales.
Las categorías operativas siguen usando el enum existente; su clasificación
analítica está registrada explícitamente para cada producto DEMO.

Stock inicial tras la carga: 8/8/6/6/6/6 unidades. Umbral 6, versión 1, según el
plan aprobado. Las entradas 8 y 12 producen una variación de +20% frente a tres
entradas comparables; ambas anomalías llegaron al receptor. El seed no provoca
cruces descendentes de stock: salida y umbral se verifican con fixtures SQLite
aisladas, sin crear salidas adicionales en Supabase.

## Archivos privados y respaldo

Estos archivos están bajo `services/api/data/`, ignorado por Git:

- `telemetry-inventory-demo.json`: programas, clasificación, umbrales,
  cotizaciones DEMO y snapshots de coste de las veinte entradas. Es metadato de
  negocio; no contiene ni persiste eventos de telemetría.
- `telemetry-demo-manifest.json`: `dataset: telemetry-demo-v1`,
  `provenance: synthetic_demo`, IDs creados, referencia al backup y estado completo.
- `telemetry-demo-before.json`: identificadores y firmas del inventario original.
- `backups/before-telemetry-demo-20261102T223703Z.dump` y su manifiesto JSON:
  backup de `public`, verificado mediante restauración en PostgreSQL 18.6 aislado
  antes de escribir. El manifiesto registra SHA-256 y conteos previos 6/4/3.

La API lee `TELEMETRY_INVENTORY_METADATA_PATH=data/telemetry-inventory-demo.json`
desde su `.env` privado; la ruta relativa funciona desde `services/api` tanto
en host como en Docker. No publicar el backup ni los archivos privados.

## Repetir la carga

Desde la raíz, usando el Python ya instalado de la API:

```powershell
# Por defecto: muestra 6 productos/20 entradas y no escribe ni inicia sesión.
& .\services\api\.venv\Scripts\python.exe -B scripts/seed-telemetry-demo.py

# Aplicación explícita: exige backup de las últimas 24 horas con restauración
# verificada y SHA-256 coincidente. Reemplazar la ruta por un backup actual.
& .\services\api\.venv\Scripts\python.exe -B scripts/seed-telemetry-demo.py `
  --apply --backup-manifest services/api/data/backups/before-telemetry-demo-20261102T223703Z.json
```

Solo se permite una URL local del API; utiliza la cuenta existente configurada,
sin mostrar credenciales ni crear usuarios. Si el manifiesto está completo,
repetir crea cero productos/entradas: comprobado en la ejecución real y en tests.
Si aparecen filas DEMO sin su manifiesto, se detiene para reconciliar una posible
respuesta perdida; no reintenta una escritura de resultado incierto ni borra filas.

La carga cambia la cotización DEMO antes de cada entrada y conserva su snapshot
después. Para futuras pruebas manuales de entrada, seleccionar uno de los
productos `[DEMO]` y usar la etiqueta exacta del proveedor DEMO. Esto registra el
coste sintético de su cotización actual; **no representa un coste real**.

## Cuando lleguen datos reales

Conservar esta procedencia y los IDs. No renombrar los registros DEMO para hacerlos
pasar por datos reales ni recalcular su historia con precios nuevos. Preparar una
carga separada y aprobada con programas, clasificaciones, proveedor y costes
reales, y sustituir el adaptador de metadatos de demostración. No cambiar los
`event_type`, el envelope ni la URL del servicio frontend.

La eliminación o archivado de datos DEMO será una tarea explícita con backup
actualizado y verificado; este script no ofrece borrado. La persistencia durable
de eventos, outbox y reconciliación continúa reservada al proyecto de almacenamiento.
