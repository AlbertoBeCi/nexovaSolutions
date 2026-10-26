# Plan de Telemetría — Nexova

**Estado:** diseño 1.0.0 · **Fecha:** 26/10/2026 · **Rama:** feature/telemetry-design-plan.

Respuesta al RFI de gestión: el sistema puede producir información accionable sobre inventario y otras operaciones, pero algunas dimensiones del briefing requieren ampliaciones previas. Esta entrega define contratos y puntos de captura; no incorpora instrumentación, infraestructura, migraciones ni escrituras en bases de datos.

**Cobertura:** 66 eventos, 5 obligatorio y 61 oportunidad_identificada, en siete categorías. Cada ficha de §8 contiene hipótesis, decisión, productor, disponibilidad, contrato, privacidad, entrega y aceptación. Los esquemas y ejemplos están en [event-schemas.json](./event-schemas.json); el verificador reproducible está en [validate-telemetry.cjs](../../scripts/validate-telemetry.cjs).

## 1. Fuentes y respuesta al briefing

Fuentes locales: [CONTEXT.md](../../CONTEXT.md), [AGENTS.md](../../AGENTS.md), banco de memoria, [modelo de inventario](../../services/api/inventory_models.py), [contratos HTTP](../../services/api/inventory_schemas.py), [router de inventario](../../services/api/routes/inventory.py), [seguridad](../../services/api/security.py), routers y clientes de las otras secciones, [constantes de incidencias](../../packages/shared/nexova_shared/incident_constants.py) y [TalentForm](../../uis/website/src/app/_components/talent-form.tsx). Referencia específica: briefing adjunto “BRIEFING — Nexova / Proyectos de Telemetría (Plan · Captura · Almacenamiento · Reporte)”, leído completo. Sus requisitos esenciales quedan incorporados aquí para no depender del adjunto temporal. CONTEXT.md sigue siendo fuente de verdad; el briefing amplía este hito sin modificarlo.

Nexova gestiona material de formación/certificación para Elena (L&D) y kits de incorporación para Patricia (RRHH), incluidos equipos de soporte de Roberto. Laura utilizará el reporte ejecutivo semanal. Product identifica material; InboundOrder recibe lotes; OutboundOrder representa entregas. Oficinas: valencia/miami. programme es el programa o área del material. Categorías exactas: training_kit, certification y onboarding_equipment.

Los cinco obligatorios son inbound_order_created, outbound_order_created, stock_threshold_triggered, direct_stock_edit_rejected y kit_cost_variance_detected. Permiten, respectivamente, planificar producción/compras según demanda esperada, anticipar reposición por consumo, ajustar mínimos o acelerar producción, reforzar capacitación/permisos y renegociar con proveedores. Elena, Patricia y Laura son destinatarias de decisiones, no datos a incluir en properties.

| Requisito | Estado comprobado | Adaptación y decisión |
| --- | --- | --- |
| Product / InboundOrder / OutboundOrder | Asset / AssetEntry / AssetExit en SQLModel y PostgreSQL/Supabase | Correspondencia analítica, conservando clases y tablas. |
| Tres categorías del briefing | hardware, peripherals, office_supplies, training_materials | Clasificación analítica revisada por producto; no traducir taxonomías automáticamente. |
| Programa | Sin programme_id | Registro versionado de programas y relación por activo; Elena/Operaciones. |
| Costo de entrada y proveedor comparable | supplier libre; sin costo unitario | supplier_id opaco aprobado y costo futuro por entrada; no usar tarifas mensuales del directorio. |
| Mínimo configurable | UI: 0 agotado, 1–5 bajo, >5 disponible | Mínimo inicial 6 por activo, alerta stock < 6. |
| Stock trazable a usuario | Saldo derivado y movimientos con UUID estable | Mantener entradas menos salidas; nunca escribir saldo directamente. |
| Oficina / moneda | Activos y órdenes pueden tener oficinas distintas | Valencia→valencia/EUR y Miami→miami/USD, sin convertir. |
| Toda la aplicación | Tres interfaces, API central y gestor de incidencias | Cubrir negocio, auth, navegación, errores y rendimiento con autoridad explícita. |
| Futuro dashboard académico | No existe fuente de matrículas/finalización | Kits entregados no prueban matrícula ni curso completado; integración posterior. |

### 1.1. Prerrequisitos de instrumentación

| Dato | Fuente/formato futuro | Responsable y habilitación |
| --- | --- | --- |
| product_id | Entero Asset.id, sin UUID inventado | Tecnología conserva identificador. |
| Orden | Par (order_type, order_id); las tablas pueden compartir número | Tecnología no deduplica solo por id. |
| product_category | Enum exacto del briefing por activo | Elena/Operaciones revisa todas las clasificaciones. |
| programme_id | Slug controlado, hasta 80 caracteres, registro efectivo por fecha/versión | Elena asigna programa o área real, sin programa ficticio unknown. |
| supplier_id | ID opaco respaldado por correspondencia aprobada | Operaciones; no inferir de nombre ni vincular sin prueba al directorio. |
| unit_cost_minor | Entero no negativo de céntimos de EUR/USD por entrada | Operaciones captura costo real; Tecnología amplía API/formulario/BD en otra tarea. |
| threshold / threshold_version | Entero positivo y versión por activo; inicial 6 | Operaciones configura y Tecnología conserva historial. |
| Actor | UUID autenticado TinyDB transformado mediante HMAC servidor | Tecnología; no usar email ni doc_id como identidad analítica. |

La ampliación posterior tendrá sus pruebas de API/formulario y migraciones propias. Aquí no se cambian contratos HTTP. Metadatos efectivos por fecha se incluyen como snapshot del evento; una reclasificación no reescribe el pasado sin reproceso explícito versionado.

office es la oficina de la orden para movimientos/costos; asset_office conserva la del activo. Stock y umbrales usan Asset.office: hoy no existe saldo por (activo, oficina). Conservar discrepancias, sin corregirlas silenciosamente ni inventar traslados. No construir balances por oficina a partir de órdenes discrepantes.

Completar categoría, programa, proveedor y costo es prerrequisito de las métricas que los necesitan. No usar cero como costo desconocido. Los obligatorios exigen dimensiones completas salvo edición directa rechazada, cuyo producto puede no existir. Diagnósticos adicionales de validación/metadatos admiten null explicado. Ninguna ausencia se sustituye por categoría o programa inventado.

## 2. Flujo y puntos de captura

~~~mermaid
flowchart TD
  A[Acceso protegido] --> B{Autenticación válida}
  B -->|No| C[Rechazo o expiración comprobada]
  B -->|Sí| D[Catálogo y filtros]
  D --> E[Inicio real de formulario]
  E --> F[Producto y consulta de stock]
  F --> G{Validación cliente}
  G -->|Falla| H[Códigos de validación]
  G -->|Pasa| I[Envío con correlación]
  I --> J{Auth y reglas servidor}
  J -->|Stock directo comprobado| K[Rechazar y registrar]
  J -->|Error de dominio| L[Rechazo seguro]
  J -->|Orden válida| M[Bloqueo de activo]
  M --> N[Preparar orden, umbral, costo y outbox]
  N --> O{Commit}
  O -->|Falla| P[Rollback sin eventos publicables]
  O -->|Éxito| Q[Entrega asíncrona]
  O -->|Éxito| R[Respuesta y confirmación visible]
  E --> S[Cancelación o abandono inferido]
~~~

Orden y eventos derivados se preparan dentro de la misma transacción, bajo bloqueo del activo. Solo se publican tras commit; no evaluar el cruce contra un saldo posterior de otra transacción.

| Punto | Productor / referencia | Disparo y autoridad | Correlación / errores |
| --- | --- | --- | --- |
| 1. Acceso protegido | RequireAuth y rutas del backoffice | page_viewed al mostrar destino; el guard no prueba login | page_view_id; alias no duplica vista. |
| 2. Autenticación | security.py y clientes auth | Login/rechazo; expiración solo comprobada internamente | requestId; 401 genérico no implica expiración. |
| 3. Catálogo/filtros | products-page.tsx, use-inventory-products.ts, GET /inventory/products | filter_applied cuando resultados se estabilizan | requestId/filter_id; error no genera resultados ficticios. |
| 4. Inicio de formulario | inbound-order-form.tsx / outbound-order-form.tsx | flow_started en primera interacción, no render | flow_id; cancelación/reinicio explícitos. |
| 5. Producto/stock | use-product-stock.ts, get_product | Medidas de petición de cliente y servidor | requestId; saldo de UI orientativo, no fuente de alerta. |
| 6. Validación local | handleSubmit de formularios | inventory_validation_failed al fallar validación | Una observación por intento/capa, sin valores personales. |
| 7. Envío | src/services/inventory-api.ts y lib/api-client.ts | flow_submitted tras validar | requestId por petición, attempt_id por envío; sin reintentar órdenes automáticamente. |
| 8. Reglas servidor | StrictSchema, get_current_user, create_outbound_order | request_validation_failed o outbound_order_rejected | No emitir creación si no hay commit. |
| 9. Escritura directa | Handler futuro de rechazo de inventario | Clave de stock y método de escritura comprobados | No atribuir intención solo por 404/405/422; ver §4. |
| 10. Persistencia | create_inbound_order/create_outbound_order | Evento principal desde confirmación, actor verificado | Orden+outbox atómicos; (tipo,id), eventId estable. |
| 11. Umbral/costo | Evaluador futuro dentro de transacción | Cruces/agotamiento/recuperación y anomalía comparable | Mismo requestId causante; eventId distinto por evento. |
| 12. Resultado | Formularios/correlador futuro | Confirmación visible, cancelación o abandono | Cliente observado separado de orden persistida; revisar finalización tardía. |

Componentes de inventario bajo uis/backoffice/src/app/inventario, rutas canónicas /backoffice/inventory/.... Alias /inventario solo cuenta en el destino. §8 detalla productores de las demás secciones.

## 3. Event Envelope y diccionario común

| Campo | Tipo / obligatoriedad | Semántica |
| --- | --- | --- |
| eventId | UUID obligatorio | Generar una vez; conservar en reentregas. |
| timestamp | ISO 8601 date-time UTC Z obligatorio | Instante del hecho, no de recepción. |
| sessionId | UUID o null; clave obligatoria | Sesión analítica aleatoria, no JWT; null sin sesión. |
| userId | p1_ + HMAC hex 64 caracteres o null; clave obligatoria | Actor verificado seudónimo; nunca email ni UUID de usuario crudo. |
| event_type | Constante snake_case obligatoria | Entidad_acción; entidades compuestas coherentes con nombres obligatorios. |
| schemaVersion | Constante 1.0.0 obligatoria | Cambio incompatible requiere nuevo contrato/versionado. |
| requestId | UUID obligatorio | Correlación de petición; generar para operación sin HTTP. |
| properties | Objeto cerrado obligatorio | Solo claves de su ficha; no volcados de modelos. |

Propiedades comunes: source (productor lógico permitido por ficha), environment (development/test/production), actor_type (user/anonymous/system), authority (server/client_observed/derived) y key_version (p1/null). user exige userId verificado; anonymous/system exige userId=null. Actor es quien causa el hecho; source es quien lo observa. Los agregados usan system; solicitudes individuales usan user/anonymous según identidad comprobada. p1 se exige si existe userId o identificador personal de sujeto.

Fuente api/incident_api exige authority=server; website/backoffice/application exige client_observed; telemetry_worker exige derived. Procedencia no equivale a autorización automática: el colector futuro autentica productores, verifica sesión y enriquece identidad. Las tablas §8 incluyen toda la allowlist común y específica.

### 3.1. Correlación e identidad

Cliente genera X-Request-ID por petición; servidor acepta solo UUID válido o genera otro y devuelve el efectivo en respuesta. Proxy Next lo propaga, CORS lo expondrá donde corresponda y logs saneados lo comparten. No aceptar cabeceras arbitrarias para evitar inyección. Terceros conservan correlación local; no enviar cabeceras sin comprobar compatibilidad.

flow_id identifica recorrido y attempt_id envío explícito. Instrumentación posterior podrá propagar X-Flow-ID/X-Attempt-ID validados a metadatos de ingreso; no añadirlos a eventos cuya allowlist no los declare. Unión primaria frontend–backend: requestId. userId nunca se acepta como identidad afirmada por navegador.

Sesión por pestaña en sessionStorage: renovar a 30 min de inactividad, cambio de identidad y logout; no derivar de token, email o IP. Un flow_id puede atravesar reautenticación sin atribuir acciones anónimas a otro usuario. Logout encola observación autenticada antes de eliminar token; sin verificación, anonymous/userId=null. Logout actual no revoca selectivamente JWT.

Identidad: p1_ + hex(HMAC-SHA256(clave_telemetría_p1, namespace + ID estable)). Namespace user usa UUID de usuario; candidate/note usan IDs externos y namespaces distintos. Clave solo en servidor y separada de SECRET_KEY/JWT. Es seudonimización, no anonimización. Rotación necesita prefijo y esquema nuevos; unión entre versiones solo mediante correspondencia protegida durante la retención autorizada.

Puente futuro de ingesta verifica sesión Nexova y transforma IDs de Tracker; navegador no conoce HMAC. Los eventos de candidatos son observaciones parciales de respuestas cliente, sin garantía de auditoría completa. Gestor de incidencias sin auth: anonymous/userId=null; branch no identifica al actor.

### 3.2. Contratos JSON

JSON Schema Draft-07: definitions y oneOf de 66 referencias; ocho campos cerrados de envelope y payloads con required explícito y additionalProperties=false. Arrays tipados y acotados. x-telemetry/x-required/x-sensitivity son anotaciones documentales, no reglas de negocio. Referencias locales; el $id https://nexova.example/schemas/telemetry/events-1.0.0.json es lógico y no implica servicio desplegado.

Fuente primaria: [Draft-07](https://json-schema.org/draft-07) y [objetos/additionalProperties](https://json-schema.org/understanding-json-schema/reference/object). Cada objeto cerrado declara todas sus claves en el mismo nivel; no se extiende un objeto cerrado con claves fuera de su declaración. No se usa unevaluatedProperties de versiones posteriores.

El esquema valida forma, tipos, enums, límites, oficina–moneda, identidad estructural y autoridad. Histórico de costos, cruces, autenticación, deduplicación y saneamiento real requieren controles semánticos. Un slug con forma válida no prueba que su valor pertenezca al registro controlado.

## 4. Reglas de inventario e indicadores

### 4.1. Stock y rechazos

Stock = sum(AssetEntry.quantity) − sum(AssetExit.quantity), por activo. Evaluar bajo bloqueo transaccional existente, sin caché de productos (TTL 10 s) ni de órdenes (30 s). No escribir stock directamente en producción, seed ni reproceso de telemetría.

Mínimo inicial 6: 6→5 dispara stock_threshold_triggered; 5→4 no repite; 4→6 emite stock_recovered y rearma; 6→0 produce cruce y stock_depleted. quantity de alertas es stock_after. Lecturas, arranque con saldo bajo o cambios de configuración no equivalen a caídas por una orden. Una salida fallida no activa alertas.

Edición directa: inspeccionar solo POST/PUT/PATCH de rutas de inventario reconocidas y JSON de hasta 16 KiB; reconocer current_stock/currentStock/stock en raíz. No recorrer campos libres ni guardar cuerpo. Emitir después de rechazo confirmado sin alterar status HTTP. 405 cuenta solo con ruta+método+clave que prueben intención. Cuerpo inválido/grande: rechazo genérico sin afirmar intención. 401 previo: access_rejected. No crear endpoint editable.

Los cinco obligatorios incluyen office, product_id, product_category, programme_id, quantity y currency. En rechazo directo quantity=0; attempted_stock opcional solo entero seguro no negativo. Las otras dimensiones admiten null con resolution_reason=product_unknown/metadata_missing; resolved exige dimensiones completas. Órdenes/alertas/costo no admiten dimensiones null. Nombres de destinatarios, assigned_to y creator_name están excluidos.

### 4.2. Variación de costo

Referencia: media ponderada de entradas anteriores comparables en [timestamp−90 días, timestamp): mismo producto, supplier_id, office y currency; mínimo 3 entradas; excluir la actual. baseline_total_cost_minor y baseline_total_quantity positivos. Costo actual cero real puede producir −100%; cero nunca sustituye un dato ausente.

referencia = baseline_total_cost_minor / baseline_total_quantity

variación = 100 × (unit_cost_minor × baseline_total_quantity / baseline_total_cost_minor − 1)

Disparar si abs(unit_cost_minor × baseline_total_quantity − baseline_total_cost_minor) × 100 > baseline_total_cost_minor × 10. Usar enteros de precisión arbitraria/decimal exacto; redondear solo para mostrar. Guardar totales de referencia y variance_percent para explicar cálculo. Exactamente ±10% no dispara. Otras divisas/proveedores/productos/oficinas no entran en referencia.

Evaluar entradas confirmadas observables al adquirir bloqueo del activo; capturar timestamp/cutoff en ese punto. Evitar empates asignando orden determinista por commit/id dentro del activo; excluir la actual y operaciones aún no confirmadas. Los totales guardados explican el histórico sin recalcular con futuros precios. Falta de referencia válida genera inventory_metadata_missing; nunca una anomalía falsa ni rollback de una orden válida por ausencia de analítica.

### 4.3. Indicadores

Usar eventId único tras deduplicar y solo environment=production en negocio. Reconciliar órdenes por (tipo,id). Mostrar cobertura de eventos enriquecidos respecto de hechos persistidos conocidos; sin denominador confiable, cobertura no disponible, nunca 100%.

| Indicador / destinatario | Población, fórmula y dimensiones | Tiempo / límites |
| --- | --- | --- |
| Órdenes diarias — Operaciones/Elena | COUNT de cada creado y SUM(quantity), por office/programme_id/product_id/categoría | Día local de orden; órdenes y unidades son distintos. |
| Costos — Elena/Laura | SUM(total_cost_minor); costo medio ponderado = suma costo/suma unidades si >0 | Separar currency/office/programa; no sumar EUR+USD. |
| Consumo — Elena | SUM(quantity) de salidas y participación sobre unidades de la misma oficina/período | No equivale a matrículas, finalización o personas únicas. |
| Errores por producto — Operaciones | COUNT inventory_validation_failed/outbound_order_rejected por capa/código | Tasa por intentos únicos solo con identidad de intento; no sumar capas como pedidos distintos. |
| Edición directa — Patricia | COUNT direct_stock_edit_rejected por office/producto/resolución | Bucket no atribuible si office=null; oficina del usuario no se infiere. |
| Stock bajo — Operaciones | COUNT stock_threshold_triggered; duración hasta siguiente stock_recovered por producto/versión | No contar stock_depleted o lecturas como episodios adicionales; abiertos sin duración final. |
| Agotamientos — Operaciones | COUNT stock_depleted por activo/programa | Oficina del activo; sin saldos ficticios por oficina de orden. |
| Anomalías de costo — Elena/Laura | COUNT kit_cost_variance_detected / entradas con referencia suficiente | Informar histórico insuficiente y cobertura por separado. |
| Login fallido — Tecnología | COUNT login_failed; tasa fallidos/(fallidos+succeeded) por aplicación | Día UTC; intentos, no personas; sin detección por cuenta/IP. |
| Secciones — Producto | COUNT page_view_id únicos por source/ruta; sesiones distintas donde no null | UTC; no prueba lectura del contenido. |
| Abandono — Producto | Flujos elegibles sin éxito/cancelación tras 30 min / flujos iniciados elegibles | Cohorte de inicio/flow_type; revisar tardíos y separar cancelación explícita. |
| Rendimiento — Tecnología | p50/p95/p99 de duraciones; requests 5xx/requests servidor; hits/(hits+misses) | Separar cliente/servidor, campo/sintético y servicio; histogramas producen aproximaciones por bucket. |
| Incidencias — Operaciones | Altas/transiciones por branch/categoría/origin; duraciones con historia completa | No convertir remote a oficina ni atribuir usuario sin auth. |

Valencia usa Europe/Madrid; Miami, America/New_York. Global sin oficina usa UTC. Día calculado con zona IANA y horario estacional; ui_language es independiente de office.

## 5. Entrega, frecuencia y fiabilidad

Stream: disponibilidad objetivo ≤60 s para actuar ante bloqueo/alerta. Batch: lotes cada 15 min para decisiones de tendencia. Ambos asíncronos: no bloquear request esperando broker. Cada ficha fija modalidad y urgencia. Reconciliación es batch diario 06:00 UTC, excepción explícita a la cadencia de 15 min.

Arquitectura futura: productor → saneamiento/envelope → outbox SQL o cola cliente acotada → ingreso validado → eventos deduplicados → agregados/alertas → reportes. No se despliega proveedor en esta entrega. Interfaz mínima futura: lote de eventos conformes, aceptación/rechazo por eventId y confirmación durable. Endpoint/despliegue pertenecen a fase de captura.

SQL: orden, evento principal y alertas derivadas se guardan atómicamente; publicar tras commit. Worker entrega al menos una vez y conserva eventId. Rollback elimina orden y eventos; fallo de entrega posterior no revierte orden. Falta de enriquecimiento conserva referencia segura a la operación y reintenta enriquecimiento; reconciliación explica pendientes.

TinyDB/Tracker no comparten transacción SQL. TinyDB: emitir tras escritura confirmada con spool seguro, explicando ventana de pérdida antes de spool. Tracker: observación cliente parcial; sin soporte externo no prometer reconciliación autoritativa de operaciones hechas por otros clientes.

Reintentos de transporte: 1,2,4,8,16,32,60,60,60,60 segundos más jitter 0–20%; después cola de fallo saneada y alerta. Schema/privacidad/versión no se reintentan sin corregir productor. Reentrega no crea orden nueva. No reintentar automáticamente POST de negocio: hoy no hay idempotencia garantizada; respuesta perdida obliga consultar historial.

Límites iniciales: evento 16 KiB UTF-8; lote 100 eventos o 512 KiB, dividir al primer límite. Cola cliente en memoria: 500 eventos o 1 MiB, priorizando seguridad/errores y contabilizando descartes de navegación. No persistir tokens/eventos personales en navegador. Cierre de pestaña puede perder observaciones; sendBeacon es mejor esfuerzo, no garantía. Obligatorios nacen en servidor.

No muestrear obligatorios ni rechazos de seguridad. Búsqueda/filtros automáticos: debounce 500 ms; botones explícitos cuentan una vez al completar. Caché/BD: ventanas de 60 s por fuente/instancia con histogramas no acumulativos y conteos disjuntos. Instancia se añade como metadato de ingreso autenticado, no texto libre cliente. Errores: primera ocurrencia inmediata, siguientes en ventanas de 60 s con conteos disjuntos, primera/última fecha y huella; sin perder volumen.

Rendimiento ordinario inicialmente sin muestreo; revisar volumen antes de una política nueva versionada. Percentiles desde muestras o histogramas con límites conocidos, nunca promedio de p95/medias. CLS adimensional; LCP/INP/load y HTTP en ms.

Ingreso añade received_at UTC/ingestion_id fuera del envelope. Deduplicar por (environment,eventId) durante toda retención de detalle; mismo ID con payload distinto es conflicto rechazado. Recalcular agregados de eventos tardíos; día anterior provisional a 06:00 UTC, revisar 7 días diariamente y corregir fechas anteriores dentro de retención señalando revisión.

Abandono agrupa por environment/flow_id, espera 30 min desde último progreso/envío y excluye éxito/cancelación. flow_abandonment_detected provisional se anula en proyección si llega éxito posterior; preservar original para auditoría. Cancelación explícita no es abandono. No depender de unload ni solo cambio de ruta.

Alertas iniciales: cada cruce/agotamiento/anomalía genera señal a Operaciones, agrupando notificaciones del mismo episodio sin suprimir eventos. Tecnología revisa rechazos directos, errores nuevos y fallos de entrega; escalar oldest_age_seconds>60 durante 5 min en stream o backlog batch>30 min. Login: aviso con ≥20 fallos/5 min y tasa>20% sobre ≥50 intentos. Son umbrales operativos revisables, no reglas de bloqueo.

Excluir ingesta/reintentos de telemetría de eventos ordinarios HTTP para evitar recursión. Si falla un diagnóstico del pipeline, contador local fuera de banda y alerta de infraestructura; no emitir errores infinitos sobre sí mismos. No importar logs crudos de recuperación.

## 6. Privacidad, riesgos y exclusiones

Seleccionar campos explícitamente; nunca clonar ORM, respuestas, cuerpos, excepciones, logs ni CSV. Códigos de eventos son identificadores técnicos; UI y documentación siguen en español.

| Datos | Tratamiento previo | Acceso / retención propuesta |
| --- | --- | --- |
| Actor/candidatos/notas | HMAC servidor con namespace; sin identificadores personales crudos | Detalle restringido: 90 días obligatorios/seguridad y 30 días resto. |
| Material/programas/cantidades | Identificadores registrados; sin nombres libres | Operaciones; detalle según evento. |
| Costos/tarifas | Enteros en moneda de oficina; confidencial comercial | Elena/Laura y Operaciones autorizadas. |
| Navegación/errores | Plantillas, códigos, longitudes por bucket y huella segura | Tecnología/Producto, 30 días. |
| Agregados | Eliminar userId/sessionId/flow_id y IDs personales; grupos <5 actores no visibles en informes de personas | Gestión, 13 meses. |

Seguridad: login fallido, sesión expirada/invalidada, rechazos, limitador, cambios administrativos y fallos de contraseñas. Uso ordinario de cuenta/sesión y rendimiento: 30 días. Purga diaria elimina detalle vencido y correspondencias asociadas; backups siguen calendario de expiración. Acceso detallado auditado y separado de reportes; sin rankings individuales.

Excluir nombres de candidatos/clientes/consultores/operadores y proveedores personas físicas; email/teléfono/dirección, CV/LinkedIn, texto de notas, assigned_to/creator_name; contraseñas/hashes/pwd_fp/JWT/reset_link/tokens; cookies/headers/IP/user-agent íntegro; búsquedas, títulos/descripciones de incidencias, SQL/DSN/trazas; filas y nombres de CSV. Checkbox de datos del formulario no es autorización automática de analítica: definir política aplicable antes de activar captura pública.

Saneamiento por códigos y registros permitidos; regex no basta. Huella = hash de tipo+plantilla segura+versión, nunca mensaje crudo. Validación semántica comprueba pertenencia al registro y procedencia: un secreto alfanumérico puede pasar patrón slug y debe rechazarse igualmente.

| Descartado / riesgo | Razón y alternativa |
| --- | --- |
| Replay, capturas, teclas y ratón | PII/costo; medir pasos y acciones significativas. |
| Bodies/headers íntegros | Credenciales/PII; códigos y plantillas bastan. |
| Texto buscado/notas | Riesgo personal; buckets, conteos y claves permitidas. |
| Matrículas/finalización inferidas de kits | Sin equivalencia ni fuente; integración académica futura. |
| Conversión de moneda | Prohibida en briefing; importes por currency. |
| Mapear categorías/proveedores por heurísticas | No equivalentes; revisión explícita y cobertura. |
| Cualquier 401 como expiración | Mezcla causas; clasificación interna comprobada. |
| Productividad individual/fingerprint dispositivo | Fuera de finalidad; agregados y acceso restringido. |
| Broker/warehouse nuevo o muestreo anticipado | Sin volumen medido no hay elección justificada; contrato lógico portable. |
| Error de telemetría sobre cada error propio | Recursión; contador fuera de banda. |
| Prometer exactamente una vez | Transporte al menos una vez + dedup; orden duplicada real es otro problema. |
| Seeds/pruebas contra Supabase real | Diseño aislado sin DB; destructivas futuras requieren backup verificado según AGENTS. |

## 7. Verificación y aceptación

Desde raíz: node scripts/validate-telemetry.cjs. Requiere Node y Ajv Draft-07 ya instalado en uis/backoffice/node_modules mediante tooling existente; no instala ni modifica dependencias. Si falta, seguir instalación habitual de esa app conservando lockfile. No inicia aplicaciones, accede a red ni bases de datos.

Valida metaschema, 66 contratos/fichas, cinco obligatorios, siete categorías, formatos activos, ejemplos, claves extra, tipos, enums, oficina–moneda, fuente/autoridad e identidad. Compara tablas, metadata y ejemplos Markdown/JSON. Fixtures semánticos demuestran cálculos y límites; no prueban transacciones ni un sanitizador desplegado.

### 7.1. Escenario sintético futuro

Ocho productos sin PII: 101/102 training_kit/ventas-b2b; 103/104 certification/liderazgo-basico; 105/106 onboarding_equipment/soporte-onboarding; 107 training_kit/liderazgo-basico; 108 certification/ventas-b2b. Impares Valencia/EUR, pares Miami/USD. Clasificaciones de prueba explícitas, no traducción automática de categorías actuales. Proveedores sup-01/sup-02; mínimo 6.

15 entradas: E1–E8 reciben 10 unidades de cada activo; E9/E10 añaden 10 a 101/sup-01 a 1000 céntimos; E11 añade 10 a 101/sup-01 a 1200 después de antecedentes E1/E9/E10 a 1000 (variación +20%); E12–E15 añaden 10 a 102/103/104/105. Dentro de 90 días, sin empates.

15 salidas: X1=(101,35), X2=(102,15), X3=(103,15), X4=(104,15), X5=(105,15), X6=(106,5), X7=(107,5), X8=(108,5); X9–X15 consumen una unidad de 101–107 respectivamente. Hay ocho cruces iniciales, saldo nunca negativo, ambas oficinas y tres programas/categorías. Todo movimiento trazable a usuario sintético. Documentado, sin ejecutar seed en esta entrega.

### 7.2. Casos para la fase de captura

| Caso | Resultado exigido | Estado aquí |
| --- | --- | --- |
| Rollback orden/outbox | Ninguna orden ni evento publicable | Diseñado; integración futura. |
| Reentrega / conflicto | Un eventId contado; mismo ID/payload distinto rechazado | Contrato/fixture; transporte pendiente. |
| Salidas concurrentes | Saldo correcto y un cruce por episodio | Diseñado; PostgreSQL aislado futuro. |
| 6→5, 5→4, 4→6, 6→0 | Cruce, silencio, recuperación, cruce+agotamiento | Fixture aritmético; emisión pendiente. |
| Exactamente ±10%, >10%, cero o <3 referencias | Solo supera 10% con referencia válida | Fixture exacto; integración pendiente. |
| Producto/proveedor/oficina/moneda o fecha no comparable | Excluir de referencia | Regla; evaluador futuro. |
| Rechazo directo conocido/desconocido | Dimensiones completas o null explicado, sin tocar stock | Contratos; detector pendiente. |
| 401 expirado/invalidado/genérico | Causas y eventos distintos | Diseño; clasificación futura. |
| Finalización tardía | Corrige abandono en proyección | Diseño; correlador futuro. |
| Commit con respuesta perdida | Evento servidor cuenta; cliente consulta historial antes de repetir | Diseño; integración futura. |
| Día y horario estacional | Zona IANA correcta por oficina | Fixture zona; agregador futuro. |
| Secreto en string de forma válida | Rechazar por registro/procedencia | Fixture semántico; sanitizador real pendiente. |

### 7.3. Los 23 checks

Diseñado = especificado; validación documental = contrato/revisión; instrumentado = fase posterior. Los 13 checks de elaboración y 10 de evaluación se trazan debajo. El script no sustituye revisión humana de utilidad y dominio.

| Check | Evidencia | Diseñado | Validación documental | Instrumentado |
| --- | --- | --- | --- | --- |
| 1. Métricas obligatorias | §1/§4/§8 y cinco definitions exactas | Sí | Briefing + verificador | Pendiente |
| 2. Flujo inventario | Diagrama y 12 puntos §2 | Sí | Router/formularios revisados | Pendiente |
| 3. Otras secciones | Siete categorías §8 | Sí | Conteo y productores | Pendiente |
| 4. Hipótesis/decisión | Frase individual y x-telemetry | Sí | Comparación automática | Pendiente |
| 5. Clasificación | 5 obligatorio / 61 oportunidad_identificada | Sí | Conteo exacto | Pendiente |
| 6. Envelope | Ocho campos §3 | Sí | Required y negativos | Pendiente |
| 7. Obligatorios + ≥8 extras / ≥3 categorías | 66 contratos / 7 categorías | Sí | Conteo exacto | Pendiente |
| 8. Allowlists | Tablas §8, objetos cerrados | Sí | Inyección rechazada | Pendiente |
| 9. Tipos/obligatoriedad/PII | §8 y §6 | Sí | Contratos y revisión | Pendiente |
| 10. Exportación válida | JSON Draft-07 | Sí | Metaschema y ejemplos | Pendiente |
| 11. Stream/batch | §5 y urgencia por ficha | Sí | Metadata y revisión | Pendiente |
| 12. Throttle/debounce | §5 y frecuencia por ficha | Sí | Ventanas/excepciones | Pendiente |
| 13. Riesgos/exclusiones | §6 | Sí | Revisión razonada | Pendiente |
| 14. Obligatorios correctos | §1→§4→§8→JSON→indicadores | Sí | Nombres y dimensiones | Pendiente |
| 15. Amplitud técnica/negocio | Siete categorías §8 | Sí | Conteos/revisión | Pendiente |
| 16. Finalidad por evento | Hipótesis y decisión §8 | Sí | Texto exacto + revisión de mérito | Pendiente |
| 17. Envelope consistente | §3, versión 1.0.0 | Sí | Ejemplos/ausencias rechazadas | Pendiente |
| 18. Solo claves permitidas | Objetos cerrados/arrays tipados | Sí | Negativos recursivos | Pendiente |
| 19. Coherencia MD/JSON | Tablas/metadata/ejemplos §8 | Sí | Comparación exacta | Pendiente |
| 20. Urgencia justificada | Fichas §8 | Sí | Metadata/revisión | Pendiente |
| 21. PII tratada | §3.1/§6/§8 | Sí | Forma/registro de prueba; sanitizador pendiente | Pendiente |
| 22. Descartes razonados | §6 | Sí | Revisión crítica | Pendiente |
| 23. Precisión implementable | Disparo/productor/contrato/entrega/dedup/aceptación §8 | Sí | Completitud y revisión | Pendiente |

## 8. Catálogo y diccionario completo

Restricción JSON contiene contrato exacto del campo: tipo, enum, límites y null. Obligatorio significa presencia de clave, distinto de admitir null. Cada tabla incluye propiedades comunes/específicas; no se permite ninguna otra. Ejemplos sintéticos. Reglas §4/§5/§6 se aplican además de las semánticas individuales.

| Evento | Categoría | Clasificación | Entrega |
| --- | --- | --- | --- |
| [inbound_order_created](#inbound_order_created) | inventario | obligatorio | stream |
| [outbound_order_created](#outbound_order_created) | inventario | obligatorio | stream |
| [stock_threshold_triggered](#stock_threshold_triggered) | inventario | obligatorio | stream |
| [direct_stock_edit_rejected](#direct_stock_edit_rejected) | inventario | obligatorio | stream |
| [kit_cost_variance_detected](#kit_cost_variance_detected) | inventario | obligatorio | stream |
| [product_created](#product_created) | inventario | oportunidad_identificada | batch |
| [inventory_validation_failed](#inventory_validation_failed) | inventario | oportunidad_identificada | batch |
| [outbound_order_rejected](#outbound_order_rejected) | inventario | oportunidad_identificada | stream |
| [stock_recovered](#stock_recovered) | inventario | oportunidad_identificada | stream |
| [stock_depleted](#stock_depleted) | inventario | oportunidad_identificada | stream |
| [inventory_metadata_missing](#inventory_metadata_missing) | inventario | oportunidad_identificada | stream |
| [login_succeeded](#login_succeeded) | autenticacion | oportunidad_identificada | batch |
| [login_failed](#login_failed) | autenticacion | oportunidad_identificada | stream |
| [session_expired](#session_expired) | autenticacion | oportunidad_identificada | stream |
| [session_invalidated](#session_invalidated) | autenticacion | oportunidad_identificada | stream |
| [session_logged_out](#session_logged_out) | autenticacion | oportunidad_identificada | batch |
| [access_rejected](#access_rejected) | autenticacion | oportunidad_identificada | stream |
| [rate_limit_triggered](#rate_limit_triggered) | autenticacion | oportunidad_identificada | stream |
| [account_created](#account_created) | autenticacion | oportunidad_identificada | batch |
| [account_updated](#account_updated) | autenticacion | oportunidad_identificada | stream |
| [account_deleted](#account_deleted) | autenticacion | oportunidad_identificada | stream |
| [profile_updated](#profile_updated) | autenticacion | oportunidad_identificada | batch |
| [password_reset_requested](#password_reset_requested) | autenticacion | oportunidad_identificada | batch |
| [password_reset_completed](#password_reset_completed) | autenticacion | oportunidad_identificada | batch |
| [password_change_completed](#password_change_completed) | autenticacion | oportunidad_identificada | batch |
| [password_operation_failed](#password_operation_failed) | autenticacion | oportunidad_identificada | stream |
| [notification_delivery_completed](#notification_delivery_completed) | autenticacion | oportunidad_identificada | stream |
| [page_viewed](#page_viewed) | navegacion | oportunidad_identificada | batch |
| [navigation_failed](#navigation_failed) | navegacion | oportunidad_identificada | stream |
| [search_completed](#search_completed) | navegacion | oportunidad_identificada | batch |
| [filter_applied](#filter_applied) | navegacion | oportunidad_identificada | batch |
| [flow_started](#flow_started) | navegacion | oportunidad_identificada | batch |
| [flow_step_completed](#flow_step_completed) | navegacion | oportunidad_identificada | batch |
| [flow_submitted](#flow_submitted) | navegacion | oportunidad_identificada | batch |
| [flow_completed](#flow_completed) | navegacion | oportunidad_identificada | batch |
| [flow_cancelled](#flow_cancelled) | navegacion | oportunidad_identificada | batch |
| [flow_abandonment_detected](#flow_abandonment_detected) | navegacion | oportunidad_identificada | batch |
| [api_request_completed](#api_request_completed) | rendimiento | oportunidad_identificada | batch |
| [client_request_completed](#client_request_completed) | rendimiento | oportunidad_identificada | batch |
| [page_performance_recorded](#page_performance_recorded) | rendimiento | oportunidad_identificada | batch |
| [cache_lookup_completed](#cache_lookup_completed) | rendimiento | oportunidad_identificada | batch |
| [cache_invalidated](#cache_invalidated) | rendimiento | oportunidad_identificada | batch |
| [database_operation_completed](#database_operation_completed) | rendimiento | oportunidad_identificada | batch |
| [dependency_request_completed](#dependency_request_completed) | rendimiento | oportunidad_identificada | batch |
| [frontend_error_captured](#frontend_error_captured) | errores | oportunidad_identificada | stream |
| [backend_error_captured](#backend_error_captured) | errores | oportunidad_identificada | stream |
| [request_validation_failed](#request_validation_failed) | errores | oportunidad_identificada | stream |
| [candidate_created](#candidate_created) | negocio | oportunidad_identificada | batch |
| [candidate_updated](#candidate_updated) | negocio | oportunidad_identificada | batch |
| [candidate_status_changed](#candidate_status_changed) | negocio | oportunidad_identificada | batch |
| [candidate_stage_changed](#candidate_stage_changed) | negocio | oportunidad_identificada | batch |
| [candidate_note_created](#candidate_note_created) | negocio | oportunidad_identificada | batch |
| [candidate_note_deleted](#candidate_note_deleted) | negocio | oportunidad_identificada | batch |
| [supplier_created](#supplier_created) | negocio | oportunidad_identificada | batch |
| [supplier_rate_changed](#supplier_rate_changed) | negocio | oportunidad_identificada | batch |
| [supplier_status_changed](#supplier_status_changed) | negocio | oportunidad_identificada | batch |
| [supplier_deleted](#supplier_deleted) | negocio | oportunidad_identificada | batch |
| [incident_created](#incident_created) | negocio | oportunidad_identificada | batch |
| [incident_status_changed](#incident_status_changed) | negocio | oportunidad_identificada | batch |
| [incident_analysis_completed](#incident_analysis_completed) | negocio | oportunidad_identificada | batch |
| [talent_form_validated](#talent_form_validated) | negocio | oportunidad_identificada | batch |
| [telemetry_batch_processed](#telemetry_batch_processed) | telemetria | oportunidad_identificada | stream |
| [telemetry_event_rejected](#telemetry_event_rejected) | telemetria | oportunidad_identificada | stream |
| [telemetry_delivery_failed](#telemetry_delivery_failed) | telemetria | oportunidad_identificada | stream |
| [telemetry_queue_observed](#telemetry_queue_observed) | telemetria | oportunidad_identificada | stream |
| [telemetry_reconciliation_completed](#telemetry_reconciliation_completed) | telemetria | oportunidad_identificada | batch |

<a id="inbound_order_created"></a>

### inbound_order_created

Capturamos `inbound_order_created` porque necesitamos saber cuánto material se produce o compra, para qué programa y con qué costo, lo que nos permite tomar la decisión de planificar la producción de material según la demanda esperada de matrículas (Elena).

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | obligatorio |
| Responsable | Elena (L&D) |
| Disparador | Después de confirmar la transacción de AssetEntry; el evento se guarda en outbox dentro de esa misma transacción. |
| Productor / referencia | services/api/routes/inventory.py: create_inbound_order |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores. |
| Entrega | stream |
| Urgencia / decisión temporal | Conocer entradas confirmadas en ≤60 s permite actualizar abastecimiento y rearmar alertas sin esperar al informe diario. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | Un evento por (inbound, order_id); eventId persistido con outbox. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** total_cost_minor = quantity * unit_cost_minor; usar enteros seguros o decimal exacto al multiplicar. office es la oficina de la entrada; asset_office conserva la del activo.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `product_id` | Sí | operativo | Asset.id del producto. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"type":"string","enum":["training_kit","certification","onboarding_equipment"]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `quantity` | Sí | operativo | Unidades recibidas; debe ser mayor que cero. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `order_id` | Sí | operativo | AssetEntry.id; combinar con order_type. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_type` | Sí | operativo | Tipo de orden. | `{"type":"string","enum":["inbound"]}` |
| `asset_office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `supplier_id` | Sí | operativo | Identificador opaco del proveedor en registro controlado. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `unit_cost_minor` | Sí | confidencial_comercial | Costo de una unidad en céntimos de EUR o USD. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `total_cost_minor` | Sí | confidencial_comercial | quantity × unit_cost_minor en la moneda de office. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000001",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "inbound_order_created",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "office": "valencia",
    "product_id": 101,
    "product_category": "training_kit",
    "programme_id": "ventas-b2b",
    "quantity": 10,
    "currency": "EUR",
    "order_id": 201,
    "order_type": "inbound",
    "asset_office": "valencia",
    "supplier_id": "sup-01",
    "unit_cost_minor": 1200,
    "total_cost_minor": 12000
  }
}
~~~

<a id="outbound_order_created"></a>

### outbound_order_created

Capturamos `outbound_order_created` porque necesitamos saber qué programas consumen más material y a qué ritmo, lo que nos permite tomar la decisión de anticipar reposiciones antes de una ola de matrículas (Elena).

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | obligatorio |
| Responsable | Elena (L&D) |
| Disparador | Después de confirmar AssetExit, con stock validado bajo bloqueo del activo. |
| Productor / referencia | services/api/routes/inventory.py: create_outbound_order |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores. |
| Entrega | stream |
| Urgencia / decisión temporal | El consumo confirmado alimenta reposición y detección de escasez en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | Un evento por (outbound, order_id); eventId persistido con outbox. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `product_id` | Sí | operativo | Asset.id del producto. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"type":"string","enum":["training_kit","certification","onboarding_equipment"]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `quantity` | Sí | operativo | Unidades entregadas. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `order_id` | Sí | operativo | AssetExit.id; combinar con order_type. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_type` | Sí | operativo | Tipo de orden. | `{"type":"string","enum":["outbound"]}` |
| `asset_office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `exit_type` | Sí | operativo | Tipo existente de salida. | `{"type":"string","enum":["allocation","consumption"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000002",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "outbound_order_created",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "office": "valencia",
    "product_id": 101,
    "product_category": "training_kit",
    "programme_id": "ventas-b2b",
    "quantity": 2,
    "currency": "EUR",
    "order_id": 301,
    "order_type": "outbound",
    "asset_office": "valencia",
    "exit_type": "consumption"
  }
}
~~~

<a id="stock_threshold_triggered"></a>

### stock_threshold_triggered

Capturamos `stock_threshold_triggered` porque necesitamos saber con qué frecuencia un programa se queda sin material disponible, lo que nos permite tomar la decisión de ajustar el mínimo o acelerar la reimpresión/reproducción.

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | obligatorio |
| Responsable | Operaciones / Elena (L&D) |
| Disparador | Una salida confirmada cumple stock_before >= threshold y stock_after < threshold; solo una vez por entrada en estado bajo. |
| Productor / referencia | Evaluador futuro dentro de services/api/routes/inventory.py: create_outbound_order |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores. |
| Entrega | stream |
| Urgencia / decisión temporal | Operaciones debe reponer antes del siguiente consumo; disponibilidad ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | Clave de episodio (product_id, threshold_version, orden de cruce); eventId de outbox. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** quantity = stock_after. office es Asset.office, porque el saldo actual es por activo. No emitir por lectura, cache hit, cambio de configuración ni arranque con stock bajo.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `product_id` | Sí | operativo | Asset.id del producto. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"type":"string","enum":["training_kit","certification","onboarding_equipment"]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `quantity` | Sí | operativo | Unidades restantes, iguales a stock_after. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `stock_before` | Sí | operativo | Stock real anterior al movimiento. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `stock_after` | Sí | operativo | Stock real posterior al movimiento; igual a quantity. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `threshold` | Sí | operativo | Mínimo vigente, exclusivo; inicial 6. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `threshold_version` | Sí | operativo | Versión de configuración del mínimo. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_id` | Sí | operativo | Identificador de la orden causante. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_type` | Sí | operativo | Salida causante del cruce. | `{"type":"string","enum":["outbound"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000003",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "stock_threshold_triggered",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "office": "valencia",
    "product_id": 101,
    "product_category": "training_kit",
    "programme_id": "ventas-b2b",
    "quantity": 5,
    "currency": "EUR",
    "stock_before": 6,
    "stock_after": 5,
    "threshold": 6,
    "threshold_version": 1,
    "order_id": 201,
    "order_type": "outbound"
  }
}
~~~

<a id="direct_stock_edit_rejected"></a>

### direct_stock_edit_rejected

Capturamos `direct_stock_edit_rejected` porque necesitamos saber si el personal intenta saltarse el control de trazabilidad del material, lo que nos permite tomar la decisión de reforzar capacitación o permisos en la oficina con mayor incidencia (Patricia).

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | obligatorio |
| Responsable | Patricia (RRHH) |
| Disparador | Una escritura a una ruta de inventario fue rechazada y contiene una clave explícita de stock reconocida; un 404/405/422 aislado no demuestra el intento. |
| Productor / referencia | Handler futuro de validación/405 en services/api/main.py limitado a rutas de inventory |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Detector futuro de escrituras rechazadas y resolución segura de producto/metadatos; nunca habilitar escritura directa. |
| Entrega | stream |
| Urgencia / decisión temporal | Un bypass intentado exige revisión de seguridad o asistencia en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** quantity = 0. Con resolution_reason=resolved las dimensiones no son null. Nulos únicamente cuando no se pueden resolver: no reemplazar por datos ficticios. 401 previo a inspección segura produce access_rejected; no afirmar una intención no comprobada.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"anyOf":[{"type":"string","enum":["valencia","miami"]},{"type":"null"}]}` |
| `product_id` | Sí | operativo | Asset.id del producto. | `{"anyOf":[{"type":"integer","minimum":1,"maximum":9007199254740991},{"type":"null"}]}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"anyOf":[{"type":"string","enum":["training_kit","certification","onboarding_equipment"]},{"type":"null"}]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"anyOf":[{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"},{"type":"null"}]}` |
| `quantity` | Sí | operativo | No hubo movimiento. | `{"type":"integer","const":0}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"anyOf":[{"type":"string","enum":["EUR","USD"]},{"type":"null"}]}` |
| `method` | Sí | operativo | Método HTTP. | `{"type":"string","enum":["GET","POST","PUT","PATCH","DELETE","OPTIONS"]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `forbidden_field` | Sí | operativo | Única clave prohibida reconocida; no se copia su valor. | `{"type":"string","enum":["current_stock","currentStock","stock"]}` |
| `reason_code` | Sí | operativo | Causa del rechazo. | `{"type":"string","enum":["stock_write_forbidden"]}` |
| `resolution_reason` | Sí | operativo | Explica dimensiones no resolubles. | `{"type":"string","enum":["resolved","product_unknown","metadata_missing"]}` |
| `attempted_stock` | No | operativo | Valor numérico intentado solo si es entero seguro; nunca texto. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000004",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "direct_stock_edit_rejected",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "office": null,
    "product_id": null,
    "product_category": null,
    "programme_id": null,
    "quantity": 0,
    "currency": null,
    "method": "POST",
    "route_template": "/inventory/orders/outbound",
    "forbidden_field": "current_stock",
    "reason_code": "stock_write_forbidden",
    "resolution_reason": "product_unknown",
    "attempted_stock": 12
  }
}
~~~

<a id="kit_cost_variance_detected"></a>

### kit_cost_variance_detected

Capturamos `kit_cost_variance_detected` porque necesitamos saber cuándo un proveedor de material cambia precios de forma anómala, lo que nos permite tomar la decisión de alertar a Elena y Laura para renegociar o buscar proveedor alterno.

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | obligatorio |
| Responsable | Elena (L&D) / Laura |
| Disparador | Entrada confirmada con al menos 3 antecedentes comparables en 90 días y abs(variación) > 10, calculada sin redondear. |
| Productor / referencia | Evaluador futuro dentro de services/api/routes/inventory.py: create_inbound_order |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores. |
| Entrega | stream |
| Urgencia / decisión temporal | Alertar en ≤60 s permite revisar una compra anómala antes de repetirla. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Ventana [timestamp-90 días, timestamp); excluir orden actual, cambios posteriores y otras monedas/proveedores/productos/oficinas. Comparar mediante racionales exactos: abs(costo_actual*unidades_ref-costo_ref)*100 > costo_ref*10. Baseline cero o <3 entradas no produce anomalía; registrar inventory_metadata_missing con motivo de referencia.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `product_id` | Sí | operativo | Asset.id del producto. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"type":"string","enum":["training_kit","certification","onboarding_equipment"]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `quantity` | Sí | operativo | Unidades de la entrada evaluada. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `order_id` | Sí | operativo | Entrada evaluada. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_type` | Sí | operativo | Tipo de orden. | `{"type":"string","enum":["inbound"]}` |
| `asset_office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `supplier_id` | Sí | operativo | Proveedor estable comparable. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `unit_cost_minor` | Sí | confidencial_comercial | Costo unitario de la entrada actual. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `baseline_total_cost_minor` | Sí | confidencial_comercial | Suma de costos de las entradas anteriores comparables. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `baseline_total_quantity` | Sí | operativo | Suma de unidades anteriores comparables. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `baseline_order_count` | Sí | operativo | Número de entradas anteriores comparables. | `{"type":"integer","minimum":3,"maximum":9007199254740991}` |
| `window_days` | Sí | operativo | Ventana histórica fija. | `{"type":"integer","const":90}` |
| `threshold_percent` | Sí | operativo | Se dispara al superar estrictamente este valor absoluto. | `{"type":"number","const":10}` |
| `variance_percent` | Sí | operativo | 100 × (unit_cost_minor × baseline_total_quantity / baseline_total_cost_minor − 1). | `{"type":"number","minimum":-100,"maximum":1000000000000}` |
| `baseline_cutoff_at` | Sí | operativo | Inicio temporal de la evaluación; excluye entrada actual y posteriores. | `{"type":"string","format":"date-time","pattern":"Z$"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000005",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "kit_cost_variance_detected",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "office": "valencia",
    "product_id": 101,
    "product_category": "training_kit",
    "programme_id": "ventas-b2b",
    "quantity": 10,
    "currency": "EUR",
    "order_id": 202,
    "order_type": "inbound",
    "asset_office": "valencia",
    "supplier_id": "sup-01",
    "unit_cost_minor": 1200,
    "baseline_total_cost_minor": 30000,
    "baseline_total_quantity": 30,
    "baseline_order_count": 3,
    "window_days": 90,
    "threshold_percent": 10,
    "variance_percent": 20,
    "baseline_cutoff_at": "2026-10-26T09:00:00.000Z"
  }
}
~~~

<a id="product_created"></a>

### product_created

Capturamos `product_created` porque necesitamos saber qué programas amplían su catálogo de material, lo que nos permite tomar la decisión de revisar altas y preparar abastecimiento.

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | oportunidad_identificada |
| Responsable | Operaciones / Elena (L&D) |
| Disparador | Asset confirmado tras POST /inventory/products. |
| Productor / referencia | services/api/routes/inventory.py: create_product |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores. |
| Entrega | batch |
| Urgencia / decisión temporal | La revisión de altas se realiza por lote cada 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `product_id` | Sí | operativo | Asset.id del producto. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"type":"string","enum":["training_kit","certification","onboarding_equipment"]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `quantity` | Sí | operativo | Alta sin movimiento. | `{"type":"integer","const":0}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000006",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "product_created",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "office": "valencia",
    "product_id": 101,
    "product_category": "training_kit",
    "programme_id": "ventas-b2b",
    "quantity": 0,
    "currency": "EUR"
  }
}
~~~

<a id="inventory_validation_failed"></a>

### inventory_validation_failed

Capturamos `inventory_validation_failed` porque necesitamos saber qué campos y productos acumulan errores al preparar órdenes, lo que nos permite tomar la decisión de corregir formularios y capacitación.

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | oportunidad_identificada |
| Responsable | Operaciones / Elena (L&D) |
| Disparador | Validación fallida al enviar o salir de un campo modificado; no registrar cada pulsación. |
| Productor / referencia | uis/backoffice/src/app/inventario/_components/{inbound,outbound}-order-form.tsx: handleSubmit; validación de services/api/inventory_schemas.py |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La corrección de formularios se prioriza por tendencia; lote de 15 min. |
| Frecuencia / control de volumen | Una observación por intento/capa y conjunto de errores; no por tecla. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Separar stage=client y server; no sumar ambas capas como órdenes fallidas únicas. Diagnóstico: las seis claves de inventario están presentes; dimensiones no resolubles pueden ser null con motivo explícito. quantity=0 no significa una orden de cero unidades.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed","server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `product_id` | Sí | operativo | Producto seleccionado y resoluble; null si falta. | `{"anyOf":[{"type":"integer","minimum":1,"maximum":9007199254740991},{"type":"null"}]}` |
| `order_type` | Sí | operativo | Tipo que desambigua el identificador de orden. | `{"type":"string","enum":["inbound","outbound"]}` |
| `stage` | Sí | operativo | Capa que detecta el fallo. | `{"type":"string","enum":["client","server"]}` |
| `field_codes` | Sí | operativo | Campos inválidos; sin valores. | `{"type":"array","minItems":0,"maxItems":20,"uniqueItems":true,"items":{"type":"string","enum":["product_id","quantity","supplier","office","exit_type","assigned_to","unknown"]}}` |
| `reason_code` | Sí | operativo | Error normalizado. | `{"type":"string","enum":["required","invalid_type","out_of_range","invalid_enum","assignment_mismatch","other"]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"anyOf":[{"type":"string","enum":["valencia","miami"]},{"type":"null"}]}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"anyOf":[{"type":"string","enum":["training_kit","certification","onboarding_equipment"]},{"type":"null"}]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"anyOf":[{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"},{"type":"null"}]}` |
| `quantity` | Sí | operativo | No hubo movimiento emitido por este diagnóstico. | `{"type":"integer","const":0}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"anyOf":[{"type":"string","enum":["EUR","USD"]},{"type":"null"}]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000007",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "inventory_validation_failed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "product_id": null,
    "order_type": "inbound",
    "stage": "client",
    "field_codes": [
      "product_id"
    ],
    "reason_code": "required",
    "office": null,
    "product_category": null,
    "programme_id": null,
    "quantity": 0,
    "currency": null
  }
}
~~~

<a id="outbound_order_rejected"></a>

### outbound_order_rejected

Capturamos `outbound_order_rejected` porque necesitamos saber cuánta demanda no puede atenderse y por qué, lo que nos permite tomar la decisión de priorizar reposición o resolver problemas de catálogo.

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | oportunidad_identificada |
| Responsable | Operaciones / Elena (L&D) |
| Disparador | Backend rechaza una salida por stock insuficiente o producto inexistente. |
| Productor / referencia | services/api/routes/inventory.py: create_outbound_order |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Demanda bloqueada requiere respuesta de operaciones en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Diagnóstico: las seis claves de inventario están presentes; dimensiones no resolubles pueden ser null con motivo explícito. quantity=0 no significa una orden de cero unidades.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `product_id` | Sí | operativo | Producto solicitado; null si no es verificable. | `{"anyOf":[{"type":"integer","minimum":1,"maximum":9007199254740991},{"type":"null"}]}` |
| `requested_quantity` | Sí | operativo | Unidades solicitadas válidas. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `available_quantity` | Sí | operativo | Saldo confirmado; null si producto no existe. | `{"anyOf":[{"type":"integer","minimum":0,"maximum":9007199254740991},{"type":"null"}]}` |
| `reason_code` | Sí | operativo | Motivo comprobado. | `{"type":"string","enum":["insufficient_stock","product_not_found"]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"anyOf":[{"type":"string","enum":["valencia","miami"]},{"type":"null"}]}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"anyOf":[{"type":"string","enum":["training_kit","certification","onboarding_equipment"]},{"type":"null"}]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"anyOf":[{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"},{"type":"null"}]}` |
| `quantity` | Sí | operativo | No hubo movimiento emitido por este diagnóstico. | `{"type":"integer","const":0}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"anyOf":[{"type":"string","enum":["EUR","USD"]},{"type":"null"}]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000008",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "outbound_order_rejected",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "product_id": null,
    "requested_quantity": 3,
    "available_quantity": null,
    "reason_code": "insufficient_stock",
    "office": null,
    "product_category": null,
    "programme_id": null,
    "quantity": 0,
    "currency": null
  }
}
~~~

<a id="stock_recovered"></a>

### stock_recovered

Capturamos `stock_recovered` porque necesitamos saber cuánto tarda el material en salir del estado bajo, lo que nos permite tomar la decisión de evaluar la eficacia de reposición.

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | oportunidad_identificada |
| Responsable | Operaciones / Elena (L&D) |
| Disparador | Entrada confirmada pasa de stock_before < threshold a stock_after >= threshold. |
| Productor / referencia | Evaluador futuro dentro de services/api/routes/inventory.py: create_inbound_order |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite cerrar el episodio de escasez y retirar acciones pendientes en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** quantity=stock_after; office=Asset.office. Rearma el próximo stock_threshold_triggered.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `product_id` | Sí | operativo | Asset.id del producto. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"type":"string","enum":["training_kit","certification","onboarding_equipment"]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `quantity` | Sí | operativo | Unidades restantes, iguales al stock posterior. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `stock_before` | Sí | operativo | Saldo anterior bajo. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `stock_after` | Sí | operativo | Saldo recuperado. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `threshold` | Sí | operativo | Mínimo vigente, exclusivo; inicial 6. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `threshold_version` | Sí | operativo | Versión de configuración del mínimo. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_id` | Sí | operativo | Identificador de la orden causante. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_type` | Sí | operativo | Entrada causante. | `{"type":"string","enum":["inbound"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000009",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "stock_recovered",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "office": "valencia",
    "product_id": 101,
    "product_category": "training_kit",
    "programme_id": "ventas-b2b",
    "quantity": 6,
    "currency": "EUR",
    "stock_before": 4,
    "stock_after": 6,
    "threshold": 6,
    "threshold_version": 1,
    "order_id": 201,
    "order_type": "inbound"
  }
}
~~~

<a id="stock_depleted"></a>

### stock_depleted

Capturamos `stock_depleted` porque necesitamos saber qué productos se agotan por completo, lo que nos permite tomar la decisión de priorizar reposición urgente.

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | oportunidad_identificada |
| Responsable | Operaciones / Elena (L&D) |
| Disparador | Salida confirmada pasa de stock_before > 0 a stock_after = 0. |
| Productor / referencia | Evaluador futuro dentro de services/api/routes/inventory.py: create_outbound_order |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores. |
| Entrega | stream |
| Urgencia / decisión temporal | El siguiente pedido no podrá servirse; disponibilidad ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Puede coexistir con stock_threshold_triggered; no son dos episodios de stock bajo.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"type":"string","enum":["valencia","miami"]}` |
| `product_id` | Sí | operativo | Asset.id del producto. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"type":"string","enum":["training_kit","certification","onboarding_equipment"]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `quantity` | Sí | operativo | Unidades restantes. | `{"type":"integer","const":0}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `stock_before` | Sí | operativo | Saldo anterior positivo. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `stock_after` | Sí | operativo | Saldo agotado. | `{"type":"integer","const":0}` |
| `threshold` | Sí | operativo | Mínimo vigente, exclusivo; inicial 6. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `threshold_version` | Sí | operativo | Versión de configuración del mínimo. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_id` | Sí | operativo | Identificador de la orden causante. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `order_type` | Sí | operativo | Salida causante. | `{"type":"string","enum":["outbound"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000010",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "stock_depleted",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "office": "valencia",
    "product_id": 101,
    "product_category": "training_kit",
    "programme_id": "ventas-b2b",
    "quantity": 0,
    "currency": "EUR",
    "stock_before": 2,
    "stock_after": 0,
    "threshold": 6,
    "threshold_version": 1,
    "order_id": 201,
    "order_type": "outbound"
  }
}
~~~

<a id="inventory_metadata_missing"></a>

### inventory_metadata_missing

Capturamos `inventory_metadata_missing` porque necesitamos saber qué movimientos carecen de dimensiones o referencia para medirlos, lo que nos permite tomar la decisión de asignar correcciones al catálogo y explicar cobertura de indicadores.

| Aspecto | Definición |
| --- | --- |
| Categoría | inventario |
| Clasificación | oportunidad_identificada |
| Responsable | Operaciones / Elena (L&D) |
| Disparador | Falta un dato de enriquecimiento o referencia al preparar un evento obligatorio; no emitir un obligatorio incompleto. |
| Productor / referencia | Enriquecedor futuro de inventario y control de cobertura del outbox |
| Disponibilidad | Requiere enriquecedor futuro y control de cobertura. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Detectar pérdida de cobertura en ≤60 s evita informes silenciosamente incompletos. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** En inventario SQL la falta de enriquecimiento no revierte una orden válida: conservar referencia segura y reintentar enriquecimiento antes de expirar; reconciliar pendientes. Diagnóstico: las seis claves de inventario están presentes; dimensiones no resolubles pueden ser null con motivo explícito. quantity=0 no significa una orden de cero unidades.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `product_id` | Sí | operativo | Activo resoluble. | `{"anyOf":[{"type":"integer","minimum":1,"maximum":9007199254740991},{"type":"null"}]}` |
| `order_id` | Sí | operativo | Orden confirmada cuando existe. | `{"anyOf":[{"type":"integer","minimum":1,"maximum":9007199254740991},{"type":"null"}]}` |
| `order_type` | Sí | operativo | Tipo que desambigua el identificador de orden. | `{"anyOf":[{"type":"string","enum":["inbound","outbound"]},{"type":"null"}]}` |
| `missing_fields` | Sí | operativo | Dependencias ausentes. | `{"type":"array","minItems":0,"maxItems":20,"uniqueItems":true,"items":{"type":"string","enum":["product_category","programme_id","supplier_id","unit_cost_minor","threshold","baseline"]}}` |
| `reason_code` | Sí | operativo | Causa de falta de cobertura. | `{"type":"string","enum":["metadata_missing","insufficient_history","zero_baseline"]}` |
| `affected_event` | Sí | operativo | Métrica que no puede construirse todavía. | `{"type":"string","enum":["inbound_order_created","outbound_order_created","stock_threshold_triggered","direct_stock_edit_rejected","kit_cost_variance_detected"]}` |
| `office` | Sí | operativo | Oficina analítica del hecho. | `{"anyOf":[{"type":"string","enum":["valencia","miami"]},{"type":"null"}]}` |
| `product_category` | Sí | operativo | Clasificación analítica explícita del producto. | `{"anyOf":[{"type":"string","enum":["training_kit","certification","onboarding_equipment"]},{"type":"null"}]}` |
| `programme_id` | Sí | operativo | Identificador del programa en el registro controlado. | `{"anyOf":[{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"},{"type":"null"}]}` |
| `quantity` | Sí | operativo | No hubo movimiento emitido por este diagnóstico. | `{"type":"integer","const":0}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"anyOf":[{"type":"string","enum":["EUR","USD"]},{"type":"null"}]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000011",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "inventory_metadata_missing",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "product_id": null,
    "order_id": null,
    "order_type": null,
    "missing_fields": [
      "baseline"
    ],
    "reason_code": "metadata_missing",
    "affected_event": "kit_cost_variance_detected",
    "office": null,
    "product_category": null,
    "programme_id": null,
    "quantity": 0,
    "currency": null
  }
}
~~~

<a id="login_succeeded"></a>

### login_succeeded

Capturamos `login_succeeded` porque necesitamos saber cuántos accesos válidos hay y en qué aplicación, lo que nos permite tomar la decisión de dimensionar soporte y comparar acceso con uso posterior.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Credenciales verificadas y token emitido; no por GET /auth/me. |
| Productor / referencia | services/api/routes/auth.py: login |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | El volumen de acceso se revisa por tendencia; lote de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `app` | Sí | operativo | Aplicación que inicia login. | `{"type":"string","enum":["backoffice","application"]}` |
| `route_template` | Sí | operativo | Ruta funcional de autenticación. | `{"type":"string","enum":["/auth/login"]}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000012",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "login_succeeded",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "app": "backoffice",
    "route_template": "/auth/login",
    "duration_ms": 125
  }
}
~~~

<a id="login_failed"></a>

### login_failed

Capturamos `login_failed` porque necesitamos saber cuántos intentos fallidos ocurren y se concentran en el tiempo, lo que nos permite tomar la decisión de investigar abuso o problemas de acceso.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | POST /auth/login termina en rechazo comprobado. |
| Productor / referencia | services/api/routes/auth.py: login |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Un aumento puede indicar abuso; detectar y revisar en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** userId=null incluso si existe una cuenta: no revelar su existencia. Sin email, IP ni hash de email.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Este productor no dispone de actor verificable para este evento. | `{"type":"string","const":"anonymous"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `app` | Sí | operativo | Aplicación que inicia login. | `{"type":"string","enum":["backoffice","application"]}` |
| `route_template` | Sí | operativo | Ruta funcional de autenticación. | `{"type":"string","enum":["/auth/login"]}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |
| `reason_code` | Sí | operativo | Motivo público indistinguible para evitar enumeración. | `{"type":"string","enum":["invalid_credentials"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000013",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "login_failed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "app": "backoffice",
    "route_template": "/auth/login",
    "duration_ms": 125,
    "reason_code": "invalid_credentials"
  }
}
~~~

<a id="session_expired"></a>

### session_expired

Capturamos `session_expired` porque necesitamos saber cuántos flujos se interrumpen por expiración confirmada, lo que nos permite tomar la decisión de ajustar experiencia de reautenticación.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Servidor confirma firma válida y exp vencido; no inferir solo desde 401. |
| Productor / referencia | services/api/security.py: get_current_user / decode_access_token (clasificación futura) |
| Disponibilidad | Requiere distinguir causas internamente en security.py sin cambiar el mensaje público. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** userId=null si no puede verificarse contra el registro; no confiar en sub de token sin verificación. Un evento por sesión/causa observada, no por cada request concurrente.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `reason_code` | Sí | operativo | Expiración verificada. | `{"type":"string","enum":["token_expired"]}` |
| `session_age_seconds` | No | operativo | Edad conocida de sesión; opcional si no se conoce. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000014",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "session_expired",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "route_template": "/inventory/orders/outbound",
    "reason_code": "token_expired",
    "session_age_seconds": 3600
  }
}
~~~

<a id="session_invalidated"></a>

### session_invalidated

Capturamos `session_invalidated` porque necesitamos saber qué sesiones dejan de ser válidas tras cambios de cuenta o contraseña, lo que nos permite tomar la decisión de explicar interrupciones y revisar soporte de sesiones.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Token verificable falla contra estado vigente: huella de contraseña, cuenta inactiva o eliminada. |
| Productor / referencia | services/api/security.py: get_current_user / password_fingerprint |
| Disponibilidad | Requiere clasificación interna de causas en security.py. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No exponer la causa al cliente ni extraer identidad de JWT no verificable.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `reason_code` | Sí | operativo | Causa interna comprobada. | `{"type":"string","enum":["password_changed","account_inactive","account_deleted"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000015",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "session_invalidated",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "route_template": "/inventory/orders/outbound",
    "reason_code": "password_changed"
  }
}
~~~

<a id="session_logged_out"></a>

### session_logged_out

Capturamos `session_logged_out` porque necesitamos saber cuántas sesiones se cierran voluntariamente, lo que nos permite tomar la decisión de distinguir cierre normal de pérdida de acceso.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Acción explícita de cerrar sesión elimina el token local. |
| Productor / referencia | uis/backoffice/src/lib/auth-api.ts y uis/application/lib/auth-api.ts: logout |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | Sirve para análisis de uso; lote de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No afirmar revocación del JWT: el cierre actual es local.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `app` | Sí | operativo | Aplicación con cierre local. | `{"type":"string","enum":["backoffice","application"]}` |
| `reason_code` | Sí | operativo | Cierre solicitado. | `{"type":"string","enum":["user_requested"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000016",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "session_logged_out",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "app": "backoffice",
    "reason_code": "user_requested"
  }
}
~~~

<a id="access_rejected"></a>

### access_rejected

Capturamos `access_rejected` porque necesitamos saber qué secciones concentran rechazos de acceso, lo que nos permite tomar la decisión de revisar permisos y rutas protegidas.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Dependencia de autenticación/autorización rechaza acceso. |
| Productor / referencia | services/api/security.py: get_current_user, get_current_admin, ensure_self_or_admin |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Identidad no verificada implica userId=null. Expiración e invalidación son eventos específicos; no sumar todas las señales como usuarios distintos.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `method` | Sí | operativo | Método HTTP. | `{"type":"string","enum":["GET","POST","PUT","PATCH","DELETE","OPTIONS"]}` |
| `status_code` | Sí | operativo | HTTP del rechazo. | `{"type":"integer","enum":[401,403]}` |
| `reason_code` | Sí | operativo | Motivo seguro normalizado. | `{"type":"string","enum":["missing_credentials","invalid_credentials","forbidden","unknown"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000017",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "access_rejected",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "route_template": "/inventory/orders/outbound",
    "method": "POST",
    "status_code": 401,
    "reason_code": "missing_credentials"
  }
}
~~~

<a id="rate_limit_triggered"></a>

### rate_limit_triggered

Capturamos `rate_limit_triggered` porque necesitamos saber con qué frecuencia el limitador bloquea recuperación, lo que nos permite tomar la decisión de investigar abuso y ajustar capacidad de soporte.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | enforce_rate_limit rechaza una operación. |
| Productor / referencia | services/api/rate_limit.py: enforce_rate_limit |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No emitir IP ni identificadores derivados de ella. El limitador actual está en memoria y no se comparte entre workers.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `operation` | Sí | operativo | Operación limitada. | `{"type":"string","enum":["forgot_password","reset_password"]}` |
| `window_seconds` | Sí | operativo | Ventana vigente del limitador. | `{"type":"integer","const":900}` |
| `limit` | Sí | operativo | Límite vigente por ventana. | `{"type":"integer","const":5}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000018",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "rate_limit_triggered",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "operation": "forgot_password",
    "window_seconds": 900,
    "limit": 5
  }
}
~~~

<a id="account_created"></a>

### account_created

Capturamos `account_created` porque necesitamos saber cuántas cuentas nuevas se crean y con qué rol efectivo, lo que nos permite tomar la decisión de revisar incorporación y accesos.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | POST /users confirma alta. |
| Productor / referencia | services/api/routes/users.py: create_user |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | Revisión de incorporación por lote de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `subject_id` | Sí | seudonimo | Identificador seudónimo de la cuenta creada. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |
| `role` | Sí | operativo | Rol efectivo persistido. | `{"type":"string","enum":["user","manager","admin"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000019",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "account_created",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": "p1",
    "subject_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "role": "user"
  }
}
~~~

<a id="account_updated"></a>

### account_updated

Capturamos `account_updated` porque necesitamos saber qué frecuencia tienen los cambios de rol o estado, lo que nos permite tomar la decisión de revisar administración y privilegios.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | PUT /users/{id} confirma una modificación. |
| Productor / referencia | services/api/routes/users.py: update_user |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Los cambios de privilegios necesitan revisión rápida en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `subject_id` | Sí | seudonimo | Cuenta modificada. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |
| `changed_fields` | Sí | operativo | Campos modificados, sin sus valores personales. | `{"type":"array","minItems":0,"maxItems":20,"uniqueItems":true,"items":{"type":"string","enum":["email","role","is_active","password"]}}` |
| `role_changed` | Sí | operativo | Hubo cambio de rol. | `{"type":"boolean"}` |
| `active_changed` | Sí | operativo | Hubo cambio de estado activo. | `{"type":"boolean"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000020",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "account_updated",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "subject_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "changed_fields": [
      "email"
    ],
    "role_changed": false,
    "active_changed": false
  }
}
~~~

<a id="account_deleted"></a>

### account_deleted

Capturamos `account_deleted` porque necesitamos saber cuántas cuentas se eliminan y quién ejecuta la acción, lo que nos permite tomar la decisión de comprobar bajas y detectar borrados inesperados.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | DELETE /users/{id} confirma borrado. |
| Productor / referencia | services/api/routes/users.py: delete_user |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Las bajas afectan accesos de inmediato; detectar inconsistencias en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `subject_id` | Sí | seudonimo | Cuenta eliminada antes de perder la correspondencia. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000021",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "account_deleted",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "subject_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
~~~

<a id="profile_updated"></a>

### profile_updated

Capturamos `profile_updated` porque necesitamos saber con qué frecuencia se mantienen los perfiles, lo que nos permite tomar la decisión de mejorar la experiencia de cuenta y soporte.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | PUT /profiles/me confirma actualización. |
| Productor / referencia | services/api/routes/profiles.py: update_my_profile |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | Mejora del perfil por tendencia; lote de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `changed_fields` | Sí | operativo | Campos de perfil modificados, sin valores. | `{"type":"array","minItems":0,"maxItems":20,"uniqueItems":true,"items":{"type":"string","enum":["name","phone","address"]}}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000022",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "profile_updated",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "changed_fields": [
      "name"
    ]
  }
}
~~~

<a id="password_reset_requested"></a>

### password_reset_requested

Capturamos `password_reset_requested` porque necesitamos saber cuántas solicitudes de recuperación se presentan, lo que nos permite tomar la decisión de estimar carga de recuperación y mejorar ayuda.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Endpoint acepta solicitud sin revelar si la cuenta existe. |
| Productor / referencia | services/api/routes/auth.py: forgot_password |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La carga de soporte se revisa por lote; abuso queda en rate_limit_triggered. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `operation` | Sí | operativo | Operación. | `{"type":"string","enum":["forgot_password"]}` |
| `accepted` | Sí | operativo | Solicitud aceptada; no implica envío ni existencia de cuenta. | `{"type":"boolean","const":true}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000023",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "password_reset_requested",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "operation": "forgot_password",
    "accepted": true
  }
}
~~~

<a id="password_reset_completed"></a>

### password_reset_completed

Capturamos `password_reset_completed` porque necesitamos saber qué proporción del flujo de recuperación llega a una contraseña nueva, lo que nos permite tomar la decisión de corregir fricción y orientar soporte.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Token de reset válido y cambio de hash confirmado. |
| Productor / referencia | services/api/routes/auth.py: reset_password |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La eficacia del flujo se revisa en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Atribución solo si servidor resuelve identidad verificable; no capturar token ni pwd_fp.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `operation` | Sí | operativo | Operación. | `{"type":"string","enum":["reset_password"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000024",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "password_reset_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "operation": "reset_password"
  }
}
~~~

<a id="password_change_completed"></a>

### password_change_completed

Capturamos `password_change_completed` porque necesitamos saber si el cambio autenticado de contraseña termina correctamente, lo que nos permite tomar la decisión de mejorar el flujo y soporte de reautenticación.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Cambio de hash confirmado y token nuevo emitido. |
| Productor / referencia | services/api/routes/auth.py: change_password |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | Análisis del recorrido por lote de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `operation` | Sí | operativo | Operación. | `{"type":"string","enum":["change_password"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000025",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "password_change_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "operation": "change_password"
  }
}
~~~

<a id="password_operation_failed"></a>

### password_operation_failed

Capturamos `password_operation_failed` porque necesitamos saber qué causas bloquean reset o cambio de contraseña, lo que nos permite tomar la decisión de corregir ayuda, validaciones o investigar intentos inválidos.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | Operación rechazada por causa normalizada. |
| Productor / referencia | services/api/routes/auth.py: reset_password / change_password |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Repetición de fallos puede indicar abuso o bloqueo; revisión en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `operation` | Sí | operativo | Operación. | `{"type":"string","enum":["reset_password","change_password"]}` |
| `reason_code` | Sí | operativo | Causa permitida. | `{"type":"string","enum":["invalid_reset_token","invalid_current_password","same_password","weak_password","other"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000026",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "password_operation_failed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "operation": "reset_password",
    "reason_code": "invalid_reset_token"
  }
}
~~~

<a id="notification_delivery_completed"></a>

### notification_delivery_completed

Capturamos `notification_delivery_completed` porque necesitamos saber si el proveedor acepta o rechaza notificaciones de recuperación, lo que nos permite tomar la decisión de resolver fallos de entrega sin exponer destinatarios.

| Aspecto | Definición |
| --- | --- |
| Categoría | autenticacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología / Patricia (RRHH) |
| Disparador | mailer.py obtiene resultado de envío; nunca interpretar aceptación como lectura. |
| Productor / referencia | services/api/mailer.py: send_password_reset_email |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Un fallo deja al usuario sin recuperación; detección en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** userId=null; excluir email, reset_link y token, también en desarrollo. No exportar logs crudos existentes: pueden contener email o token.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Observación de proceso sin usuario. | `{"type":"string","const":"system"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `notification_type` | Sí | operativo | Tipo de notificación. | `{"type":"string","enum":["password_reset"]}` |
| `provider` | Sí | operativo | Canal implementado o fallback. | `{"type":"string","enum":["resend","development_log","unconfigured"]}` |
| `outcome` | Sí | operativo | Resultado de la solicitud de entrega. | `{"type":"string","enum":["accepted","failed","skipped"]}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000027",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "notification_delivery_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "system",
    "authority": "server",
    "key_version": null,
    "notification_type": "password_reset",
    "provider": "resend",
    "outcome": "accepted",
    "duration_ms": 125
  }
}
~~~

<a id="page_viewed"></a>

### page_viewed

Capturamos `page_viewed` porque necesitamos saber qué secciones visitan más los operadores y visitantes, lo que nos permite tomar la decisión de priorizar navegación y mantenimiento.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Ruta canónica visible tras navegación efectiva, una vez por page_view_id. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Una vez por vista; excluir renders repetidos y alias intermedios. |
| Deduplicación | eventId y page_view_id; alias /inventario se cuenta en su destino canónico. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `page_view_id` | Sí | operativo | Instancia de vista. | `{"type":"string","format":"uuid"}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `ui_language` | Sí | operativo | Idioma de interfaz independiente de oficina. | `{"type":"string","enum":["es","en"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000028",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "page_viewed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "page_view_id": "10000000-0000-4000-8000-000000000001",
    "route_template": "/inventory/orders/outbound",
    "ui_language": "es"
  }
}
~~~

<a id="navigation_failed"></a>

### navigation_failed

Capturamos `navigation_failed` porque necesitamos saber qué rutas no llegan a mostrarse, lo que nos permite tomar la decisión de reparar enlaces y carga de secciones.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Error del router o del límite de carga impide mostrar destino. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | La sección queda inaccesible; detección operativa en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `page_view_id` | Sí | operativo | Intento de vista. | `{"type":"string","format":"uuid"}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `reason_code` | Sí | operativo | Causa normalizada. | `{"type":"string","enum":["route_not_found","load_failed","redirect_loop","unknown"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000029",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "navigation_failed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "page_view_id": "10000000-0000-4000-8000-000000000001",
    "route_template": "/inventory/orders/outbound",
    "reason_code": "route_not_found"
  }
}
~~~

<a id="search_completed"></a>

### search_completed

Capturamos `search_completed` porque necesitamos saber qué proporción de búsquedas devuelve cero resultados y tarda demasiado, lo que nos permite tomar la decisión de mejorar búsqueda sin capturar lo escrito.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Búsqueda estabilizada termina y presenta resultados. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Debounce 500 ms tras última edición; una vez por resultado mostrado; sin texto de búsqueda. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `query_length_bucket` | Sí | operativo | Longitud del texto, nunca su contenido. | `{"type":"string","enum":["0","1_5","6_20","21_plus"]}` |
| `result_count` | Sí | operativo | Número total de resultados. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |
| `search_id` | Sí | operativo | Identifica una búsqueda estabilizada. | `{"type":"string","format":"uuid"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000030",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "search_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "route_template": "/inventory/orders/outbound",
    "query_length_bucket": "6_20",
    "result_count": 4,
    "duration_ms": 125,
    "search_id": "10000000-0000-4000-8000-000000000001"
  }
}
~~~

<a id="filter_applied"></a>

### filter_applied

Capturamos `filter_applied` porque necesitamos saber qué filtros se usan y si encuentran resultados, lo que nos permite tomar la decisión de simplificar filtros y detectar combinaciones inútiles.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Conjunto estabilizado de filtros produce una vista. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Debounce 500 ms solo si filtra automáticamente; envío explícito se mide una vez al completar. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `filter_keys` | Sí | operativo | Nombres de filtros utilizados; no valores libres. | `{"type":"array","minItems":0,"maxItems":20,"uniqueItems":true,"items":{"type":"string","enum":["office","category","country","status","stage","branch","origin","skills","availability"]}}` |
| `result_count` | Sí | operativo | Resultados mostrados. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `filter_id` | Sí | operativo | Cambio estabilizado. | `{"type":"string","format":"uuid"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000031",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "filter_applied",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "route_template": "/inventory/orders/outbound",
    "filter_keys": [
      "office"
    ],
    "result_count": 8,
    "filter_id": "10000000-0000-4000-8000-000000000001"
  }
}
~~~

<a id="flow_started"></a>

### flow_started

Capturamos `flow_started` porque necesitamos saber cuántas personas empiezan realmente cada recorrido, lo que nos permite tomar la decisión de medir conversión desde intención activa.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Primera interacción que modifica un campo o inicia una acción; abrir el formulario no basta. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | Un inicio por flow_id; nueva instancia tras completar/cancelar o reiniciar explícitamente. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `flow_id` | Sí | operativo | Identificador del recorrido; une requests y vistas. | `{"type":"string","format":"uuid"}` |
| `flow_type` | Sí | operativo | Flujo con semántica documentada. | `{"type":"string","enum":["inbound_order","outbound_order","candidate_create","candidate_edit","supplier_create","incident_create","incident_analysis","talent_registration","login","password_reset","password_change","profile_edit"]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000032",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "flow_started",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "flow_id": "10000000-0000-4000-8000-000000000001",
    "flow_type": "inbound_order",
    "route_template": "/inventory/orders/outbound"
  }
}
~~~

<a id="flow_step_completed"></a>

### flow_step_completed

Capturamos `flow_step_completed` porque necesitamos saber qué pasos se completan y cuánto cuestan, lo que nos permite tomar la decisión de simplificar el paso con mayor fricción.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Validación del paso pasa y el usuario avanza. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | Una vez por (flow_id, step_index, avance); volver atrás no crea otra finalización del mismo avance. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `flow_id` | Sí | operativo | Identificador del recorrido; une requests y vistas. | `{"type":"string","format":"uuid"}` |
| `flow_type` | Sí | operativo | Flujo con semántica documentada. | `{"type":"string","enum":["inbound_order","outbound_order","candidate_create","candidate_edit","supplier_create","incident_create","incident_analysis","talent_registration","login","password_reset","password_change","profile_edit"]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `step_index` | Sí | operativo | Paso completado, desde 1. | `{"type":"integer","minimum":1,"maximum":10}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000033",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "flow_step_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "flow_id": "10000000-0000-4000-8000-000000000001",
    "flow_type": "inbound_order",
    "route_template": "/inventory/orders/outbound",
    "step_index": 1,
    "duration_ms": 125
  }
}
~~~

<a id="flow_submitted"></a>

### flow_submitted

Capturamos `flow_submitted` porque necesitamos saber cuántos recorridos llegan a un intento de envío válido, lo que nos permite tomar la decisión de separar fricción previa de problemas de confirmación.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Cliente supera validación y comienza solicitud o finalización local simulada. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No equivale a orden creada ni se usa como conteo autoritativo de negocio.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `flow_id` | Sí | operativo | Identificador del recorrido; une requests y vistas. | `{"type":"string","format":"uuid"}` |
| `flow_type` | Sí | operativo | Flujo con semántica documentada. | `{"type":"string","enum":["inbound_order","outbound_order","candidate_create","candidate_edit","supplier_create","incident_create","incident_analysis","talent_registration","login","password_reset","password_change","profile_edit"]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `attempt_id` | Sí | operativo | Intento; nuevo en cada envío explícito. | `{"type":"string","format":"uuid"}` |
| `submission_mode` | Sí | operativo | Naturaleza del envío. | `{"type":"string","enum":["http","local_simulation"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000034",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "flow_submitted",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "flow_id": "10000000-0000-4000-8000-000000000001",
    "flow_type": "inbound_order",
    "route_template": "/inventory/orders/outbound",
    "attempt_id": "10000000-0000-4000-8000-000000000001",
    "submission_mode": "http"
  }
}
~~~

<a id="flow_completed"></a>

### flow_completed

Capturamos `flow_completed` porque necesitamos saber cuántos recorridos muestran confirmación al usuario, lo que nos permite tomar la decisión de detectar diferencias entre persistencia y confirmación visible.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Cliente presenta éxito tras respuesta válida, o validación local del formulario público. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Un éxito HTTP observado no sustituye auditoría del backend; local_simulation no representa persistencia.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `flow_id` | Sí | operativo | Identificador del recorrido; une requests y vistas. | `{"type":"string","format":"uuid"}` |
| `flow_type` | Sí | operativo | Flujo con semántica documentada. | `{"type":"string","enum":["inbound_order","outbound_order","candidate_create","candidate_edit","supplier_create","incident_create","incident_analysis","talent_registration","login","password_reset","password_change","profile_edit"]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `attempt_id` | Sí | operativo | Mismo intento que flow_submitted. | `{"type":"string","format":"uuid"}` |
| `completion_mode` | Sí | operativo | Qué se pudo confirmar. | `{"type":"string","enum":["server_response","local_simulation"]}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000035",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "flow_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "flow_id": "10000000-0000-4000-8000-000000000001",
    "flow_type": "inbound_order",
    "route_template": "/inventory/orders/outbound",
    "attempt_id": "10000000-0000-4000-8000-000000000001",
    "completion_mode": "server_response",
    "duration_ms": 125
  }
}
~~~

<a id="flow_cancelled"></a>

### flow_cancelled

Capturamos `flow_cancelled` porque necesitamos saber qué recorridos se cancelan de forma explícita, lo que nos permite tomar la decisión de mejorar acciones y claridad de formularios.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Usuario pulsa cancelar o reiniciar después de iniciar. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `flow_id` | Sí | operativo | Identificador del recorrido; une requests y vistas. | `{"type":"string","format":"uuid"}` |
| `flow_type` | Sí | operativo | Flujo con semántica documentada. | `{"type":"string","enum":["inbound_order","outbound_order","candidate_create","candidate_edit","supplier_create","incident_create","incident_analysis","talent_registration","login","password_reset","password_change","profile_edit"]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `last_step` | Sí | operativo | Último paso alcanzado; 0 si no se completó ninguno. | `{"type":"integer","minimum":0,"maximum":10}` |
| `reason_code` | Sí | operativo | Acción observada. | `{"type":"string","enum":["cancel_button","reset_button"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000036",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "flow_cancelled",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "flow_id": "10000000-0000-4000-8000-000000000001",
    "flow_type": "inbound_order",
    "route_template": "/inventory/orders/outbound",
    "last_step": 0,
    "reason_code": "cancel_button"
  }
}
~~~

<a id="flow_abandonment_detected"></a>

### flow_abandonment_detected

Capturamos `flow_abandonment_detected` porque necesitamos saber dónde quedan recorridos sin finalizar, lo que nos permite tomar la decisión de priorizar mejoras de formularios con abandono sostenido.

| Aspecto | Definición |
| --- | --- |
| Categoría | navegacion |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Worker observa 30 min sin progreso, éxito ni cancelación; resultado provisional. |
| Productor / referencia | uis/{website,backoffice}/src/app y uis/application/app; clientes y formularios de cada aplicación |
| Disponibilidad | Requiere correlador futuro de flujos y eventos tardíos. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | Análisis de proceso, sin acción inmediata; lote de 15 min tras vencer los 30 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | Uno por flow_id/ventana de inactividad; el agregado se corrige si llega una finalización posterior. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** El denominador usa flow_started válidos por flow_id; excluir cancelados explícitos y distinguir abandono provisional/final.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["telemetry_worker"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["derived"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `flow_id` | Sí | operativo | Identificador del recorrido; une requests y vistas. | `{"type":"string","format":"uuid"}` |
| `flow_type` | Sí | operativo | Flujo con semántica documentada. | `{"type":"string","enum":["inbound_order","outbound_order","candidate_create","candidate_edit","supplier_create","incident_create","incident_analysis","talent_registration","login","password_reset","password_change","profile_edit"]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `last_step` | Sí | operativo | Último paso completado. | `{"type":"integer","minimum":0,"maximum":10}` |
| `last_activity_at` | Sí | operativo | Última actividad observada. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `inactivity_seconds` | Sí | operativo | Ventana mínima de inferencia. | `{"type":"integer","const":1800}` |
| `provisional` | Sí | operativo | Puede corregirse por finalización tardía. | `{"type":"boolean","const":true}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000037",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "flow_abandonment_detected",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "telemetry_worker",
    "environment": "test",
    "actor_type": "system",
    "authority": "derived",
    "key_version": null,
    "flow_id": "10000000-0000-4000-8000-000000000001",
    "flow_type": "inbound_order",
    "route_template": "/inventory/orders/outbound",
    "last_step": 1,
    "last_activity_at": "2026-10-26T08:30:00.000Z",
    "inactivity_seconds": 1800,
    "provisional": true
  }
}
~~~

<a id="api_request_completed"></a>

### api_request_completed

Capturamos `api_request_completed` porque necesitamos saber qué endpoints acumulan lentitud y errores HTTP, lo que nos permite tomar la decisión de priorizar optimización y capacidad.

| Aspecto | Definición |
| --- | --- |
| Categoría | rendimiento |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Finaliza la respuesta de API o su handler de fallo; incluye 5xx con medición final. |
| Productor / referencia | services/api/main.py: log_request_timing y wrapper futuro de fallo; middleware futuro del gestor |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Sin muestreo; batch cada 15 min. Las alertas rápidas utilizan backend_error_captured. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Una observación por requestId y servicio; no incluir ingestión de telemetría, health checks sintéticos ni query strings.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api","incident_api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `method` | Sí | operativo | Método HTTP. | `{"type":"string","enum":["GET","POST","PUT","PATCH","DELETE","OPTIONS"]}` |
| `status_code` | Sí | operativo | Código HTTP de la respuesta; 0 indica ausencia de respuesta en cliente. | `{"type":"integer","minimum":100,"maximum":599}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |
| `cache_state` | Sí | operativo | Estado si la ruta tiene caché. | `{"type":"string","enum":["hit","miss","not_applicable"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000038",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "api_request_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "system",
    "authority": "server",
    "key_version": null,
    "route_template": "/inventory/orders/outbound",
    "method": "POST",
    "status_code": 201,
    "duration_ms": 125,
    "cache_state": "not_applicable"
  }
}
~~~

<a id="client_request_completed"></a>

### client_request_completed

Capturamos `client_request_completed` porque necesitamos saber qué demora experimenta el navegador y cuántas peticiones no reciben respuesta, lo que nos permite tomar la decisión de distinguir red, cliente y servidor.

| Aspecto | Definición |
| --- | --- |
| Categoría | rendimiento |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Fetch de dominio termina, falla o es abortado. |
| Productor / referencia | services/api/main.py; response_cache.py; inventory_database.py; clientes HTTP de cada UI |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** duration_ms mide fetch; api_request_completed mide servidor. No sumarlos como solicitudes únicas.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `method` | Sí | operativo | Método HTTP. | `{"type":"string","enum":["GET","POST","PUT","PATCH","DELETE","OPTIONS"]}` |
| `status_code` | Sí | operativo | Código HTTP de la respuesta; 0 indica ausencia de respuesta en cliente. | `{"type":"integer","minimum":0,"maximum":599}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |
| `outcome` | Sí | operativo | Resultado observado en cliente. | `{"type":"string","enum":["response","network_error","aborted"]}` |
| `dependency` | Sí | operativo | Destino lógico permitido. | `{"type":"string","enum":["nexova_api","incident_api","tracker_api"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000039",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "client_request_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "route_template": "/inventory/orders/outbound",
    "method": "POST",
    "status_code": 201,
    "duration_ms": 125,
    "outcome": "response",
    "dependency": "nexova_api"
  }
}
~~~

<a id="page_performance_recorded"></a>

### page_performance_recorded

Capturamos `page_performance_recorded` porque necesitamos saber qué experiencia real tienen las páginas, lo que nos permite tomar la decisión de optimizar carga y respuesta de las vistas más costosas.

| Aspecto | Definición |
| --- | --- |
| Categoría | rendimiento |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Se obtiene métrica de página medida; ausencias por incompatibilidad no se sustituyen por cero. |
| Productor / referencia | services/api/main.py; response_cache.py; inventory_database.py; clientes HTTP de cada UI |
| Disponibilidad | Requiere medición de campo futura; auditorías Lighthouse existentes son sintéticas. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Una emisión final por (page_view_id, metric); no mezclar métricas de laboratorio y campo. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Para percentiles usar distribuciones o muestras individuales sin promediar percentiles.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `page_view_id` | Sí | operativo | Vista medida. | `{"type":"string","format":"uuid"}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `metric` | Sí | operativo | Métrica; unidad depende de su nombre. | `{"type":"string","enum":["LCP","INP","CLS","load"]}` |
| `value` | Sí | operativo | Milisegundos para LCP/INP/load; CLS es adimensional. | `{"type":"number","minimum":0,"maximum":1000000000000}` |
| `navigation_type` | Sí | operativo | Tipo de navegación. | `{"type":"string","enum":["navigate","reload","back_forward","spa"]}` |
| `measurement_origin` | Sí | operativo | Origen de medida. | `{"type":"string","enum":["field","synthetic"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000040",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "page_performance_recorded",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "page_view_id": "10000000-0000-4000-8000-000000000001",
    "route_template": "/inventory/orders/outbound",
    "metric": "LCP",
    "value": 1200,
    "navigation_type": "navigate",
    "measurement_origin": "field"
  }
}
~~~

<a id="cache_lookup_completed"></a>

### cache_lookup_completed

Capturamos `cache_lookup_completed` porque necesitamos saber si la caché reduce consultas y latencia por listado, lo que nos permite tomar la decisión de ajustar TTL y capacidad sin servir datos obsoletos.

| Aspecto | Definición |
| --- | --- |
| Categoría | rendimiento |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Se cierra ventana de 60 s con consultas de caché. |
| Productor / referencia | services/api/response_cache.py: get_or_create |
| Disponibilidad | response_cache.py existe; faltan contadores e histogramas. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Agrupar 60 s; no muestrear; batch 15 min. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** sample_count=hit_count+miss_count=suma(histograma). Ventanas separadas por instancia; no incluir claves con usuarios o filtros libres.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `window_start` | Sí | operativo | Inicio inclusivo UTC de ventana de 60 s. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `window_seconds` | Sí | operativo | Duración de ventana. | `{"type":"integer","const":60}` |
| `sample_count` | Sí | operativo | Observaciones incluidas. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `duration_sum_ms` | Sí | operativo | Suma de duraciones en ms. | `{"type":"number","minimum":0,"maximum":1000000000000}` |
| `duration_histogram` | Sí | operativo | Histograma de duración: cada posición cuenta un intervalo no acumulativo, límites [1,5,10,25,50,100,250,500,1000,5000,60000] ms y último intervalo >60000. | `{"type":"array","minItems":12,"maxItems":12,"items":{"type":"integer","minimum":0,"maximum":1000000000}}` |
| `cache_name` | Sí | operativo | Caché lógica. | `{"type":"string","enum":["inventory_products","inventory_orders"]}` |
| `hit_count` | Sí | operativo | Aciertos. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `miss_count` | Sí | operativo | Fallos. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000041",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "cache_lookup_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "system",
    "authority": "server",
    "key_version": null,
    "window_start": "2026-10-26T09:00:00.000Z",
    "window_seconds": 60,
    "sample_count": 1,
    "duration_sum_ms": 125,
    "duration_histogram": [
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0
    ],
    "cache_name": "inventory_products",
    "hit_count": 1,
    "miss_count": 0
  }
}
~~~

<a id="cache_invalidated"></a>

### cache_invalidated

Capturamos `cache_invalidated` porque necesitamos saber qué escrituras invalidan caché y con qué eficacia, lo que nos permite tomar la decisión de revisar coherencia y costo de invalidación.

| Aspecto | Definición |
| --- | --- |
| Categoría | rendimiento |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Escritura confirmada solicita invalidación por tag. |
| Productor / referencia | services/api/response_cache.py: invalidate |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Caché actual por proceso: no afirmar invalidación distribuida.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `cache_name` | Sí | operativo | Tag invalidado. | `{"type":"string","enum":["inventory_products","inventory_orders"]}` |
| `cause` | Sí | operativo | Escritura causante. | `{"type":"string","enum":["product_created","inbound_order_created","outbound_order_created","profile_updated","account_updated","account_deleted"]}` |
| `evicted_count` | Sí | operativo | Entradas eliminadas localmente. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000042",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "cache_invalidated",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "system",
    "authority": "server",
    "key_version": null,
    "cache_name": "inventory_products",
    "cause": "product_created",
    "evicted_count": 2
  }
}
~~~

<a id="database_operation_completed"></a>

### database_operation_completed

Capturamos `database_operation_completed` porque necesitamos saber qué familias de consulta consumen tiempo o fallan, lo que nos permite tomar la decisión de optimizar consultas e índices.

| Aspecto | Definición |
| --- | --- |
| Categoría | rendimiento |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Ventana de 60 s de operaciones ORM cierra. |
| Productor / referencia | Hooks futuros ORM en inventory_database.py y services/incident-manager-api/db.py |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Agrupar 60 s; no capturar SQL; batch 15 min. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** error_count<=sample_count; suma(histograma)=sample_count. No usar parámetros, DSN ni nombre físico con PII como dimensión.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api","incident_api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `window_start` | Sí | operativo | Inicio inclusivo UTC de ventana de 60 s. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `window_seconds` | Sí | operativo | Duración de ventana. | `{"type":"integer","const":60}` |
| `sample_count` | Sí | operativo | Observaciones incluidas. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `duration_sum_ms` | Sí | operativo | Suma de duraciones en ms. | `{"type":"number","minimum":0,"maximum":1000000000000}` |
| `duration_histogram` | Sí | operativo | Histograma de duración: cada posición cuenta un intervalo no acumulativo, límites [1,5,10,25,50,100,250,500,1000,5000,60000] ms y último intervalo >60000. | `{"type":"array","minItems":12,"maxItems":12,"items":{"type":"integer","minimum":0,"maximum":1000000000}}` |
| `operation_name` | Sí | operativo | Nombre lógico, sin SQL ni parámetros. | `{"type":"string","enum":["inventory_list_products","inventory_list_orders","inventory_get_stock","inventory_write_order","incident_read","incident_write"]}` |
| `error_count` | Sí | operativo | Operaciones fallidas en ventana. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000043",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "database_operation_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "system",
    "authority": "server",
    "key_version": null,
    "window_start": "2026-10-26T09:00:00.000Z",
    "window_seconds": 60,
    "sample_count": 1,
    "duration_sum_ms": 125,
    "duration_histogram": [
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0
    ],
    "operation_name": "inventory_list_products",
    "error_count": 0
  }
}
~~~

<a id="dependency_request_completed"></a>

### dependency_request_completed

Capturamos `dependency_request_completed` porque necesitamos saber qué dependencia externa explica fallos o demora, lo que nos permite tomar la decisión de priorizar mitigación o soporte del proveedor.

| Aspecto | Definición |
| --- | --- |
| Categoría | rendimiento |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Llamada a tercero termina con respuesta, timeout o error. |
| Productor / referencia | services/api/main.py; response_cache.py; inventory_database.py; clientes HTTP de cada UI |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** source=api implica autoridad server; backoffice solo observación cliente. No añadir headers de correlación a terceros sin confirmar que los admiten; correlación local siempre disponible.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed","server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `dependency` | Sí | operativo | Destino lógico. | `{"type":"string","enum":["tracker_api","resend"]}` |
| `operation` | Sí | operativo | Operación lógica. | `{"type":"string","enum":["list","read","create","update","delete","notify"]}` |
| `outcome` | Sí | operativo | Resultado. | `{"type":"string","enum":["success","error","timeout"]}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000044",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "dependency_request_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "system",
    "authority": "client_observed",
    "key_version": null,
    "dependency": "tracker_api",
    "operation": "list",
    "outcome": "success",
    "duration_ms": 125
  }
}
~~~

<a id="frontend_error_captured"></a>

### frontend_error_captured

Capturamos `frontend_error_captured` porque necesitamos saber qué fallos de render o promesas interrumpen la experiencia, lo que nos permite tomar la decisión de priorizar correcciones por impacto.

| Aspecto | Definición |
| --- | --- |
| Categoría | errores |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Error boundary, window.error o unhandledrejection produce una representación segura. |
| Productor / referencia | handlers de FastAPI; límites de error y clientes HTTP de cada UI |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| Frecuencia / control de volumen | Primera ocurrencia inmediata; actualizaciones cada 60 s con nuevo eventId y conteos disjuntos por huella. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Ventanas de actualización no vuelven a contar la primera ocurrencia. Huella y código no contienen mensaje, stack, URL ni contenido del usuario.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice","application","website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `error_code` | Sí | operativo | Familia sanitizada. | `{"type":"string","enum":["network","render","unhandled_rejection","unexpected_exception","timeout","unknown"]}` |
| `fingerprint` | Sí | operativo | SHA-256 de plantilla sanitizada y versión, nunca de mensaje crudo. | `{"type":"string","pattern":"^[a-f0-9]{64}$"}` |
| `first_seen_at` | Sí | operativo | Primera ocurrencia de ventana. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `last_seen_at` | Sí | operativo | Última ocurrencia de ventana. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `occurrence_count` | Sí | operativo | Número real de ocurrencias. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `sanitizer_version` | Sí | operativo | Versión de sanitización. | `{"type":"string","const":"1.0.0"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000045",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "frontend_error_captured",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "route_template": "/inventory/orders/outbound",
    "error_code": "network",
    "fingerprint": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "first_seen_at": "2026-10-26T09:00:00.000Z",
    "last_seen_at": "2026-10-26T09:00:00.000Z",
    "occurrence_count": 1,
    "sanitizer_version": "1.0.0"
  }
}
~~~

<a id="backend_error_captured"></a>

### backend_error_captured

Capturamos `backend_error_captured` porque necesitamos saber qué excepciones inesperadas afectan operaciones, lo que nos permite tomar la decisión de reparar fallos con mayor impacto.

| Aspecto | Definición |
| --- | --- |
| Categoría | errores |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Handler global captura excepción y devuelve respuesta segura. |
| Productor / referencia | handlers de FastAPI; límites de error y clientes HTTP de cada UI |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| Frecuencia / control de volumen | Primera ocurrencia inmediata; actualizaciones cada 60 s con conteos disjuntos. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No serializar exc, traceback, SQL ni logs existentes. Mantener requestId de primera ocurrencia; conteos agregados no identifican todas las requests.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api","incident_api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `error_code` | Sí | operativo | Familia sanitizada. | `{"type":"string","enum":["network","render","unhandled_rejection","unexpected_exception","timeout","unknown"]}` |
| `fingerprint` | Sí | operativo | SHA-256 de plantilla sanitizada y versión, nunca de mensaje crudo. | `{"type":"string","pattern":"^[a-f0-9]{64}$"}` |
| `first_seen_at` | Sí | operativo | Primera ocurrencia de ventana. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `last_seen_at` | Sí | operativo | Última ocurrencia de ventana. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `occurrence_count` | Sí | operativo | Número real de ocurrencias. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `sanitizer_version` | Sí | operativo | Versión de sanitización. | `{"type":"string","const":"1.0.0"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000046",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "backend_error_captured",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "system",
    "authority": "server",
    "key_version": null,
    "route_template": "/inventory/orders/outbound",
    "error_code": "network",
    "fingerprint": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "first_seen_at": "2026-10-26T09:00:00.000Z",
    "last_seen_at": "2026-10-26T09:00:00.000Z",
    "occurrence_count": 1,
    "sanitizer_version": "1.0.0"
  }
}
~~~

<a id="request_validation_failed"></a>

### request_validation_failed

Capturamos `request_validation_failed` porque necesitamos saber qué contratos HTTP reciben datos inválidos, lo que nos permite tomar la decisión de corregir clientes e identificar incompatibilidades.

| Aspecto | Definición |
| --- | --- |
| Categoría | errores |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | RequestValidationError o equivalente rechaza entrada antes de ejecutar negocio. |
| Productor / referencia | handlers de FastAPI; límites de error y clientes HTTP de cada UI |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No copiar msg, input, ctx ni loc sin allowlist. inventory_validation_failed describe el dominio; esta señal describe contrato HTTP. No sumarlas como intentos únicos.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api","incident_api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `route_template` | Sí | operativo | Plantilla de ruta permitida; sin host, query ni identificadores. | `{"type":"string","enum":["/","/login","/register","/account/profile","/account/change-password","/forgot-password","/reset-password","/talento","/candidates/new","/candidates/{id}","/candidates/{id}/edit","/incidencias","/suppliers","/incidents","/incidents/new","/incidents/summary","/backoffice/inventory/products","/backoffice/inventory/orders","/backoffice/inventory/orders/inbound","/backoffice/inventory/orders/outbound","/inventory/products","/inventory/products/{asset_id}","/inventory/orders","/inventory/orders/inbound","/inventory/orders/outbound","/auth/login","/auth/me","/auth/forgot-password","/auth/reset-password","/auth/change-password","/users","/users/{id}","/profiles/me","/suppliers/{id}","/suppliers/{id}/rate","/suppliers/{id}/status","/api/incidents","/api/incidents/analyze","/api/incidents/summary","/api/incidents/{id}","/api/incidents/{id}/status","unmatched"]}` |
| `method` | Sí | operativo | Método HTTP. | `{"type":"string","enum":["GET","POST","PUT","PATCH","DELETE","OPTIONS"]}` |
| `field_codes` | Sí | operativo | Campos permitidos normalizados; unknown para los demás. | `{"type":"array","minItems":0,"maxItems":20,"uniqueItems":true,"items":{"type":"string","enum":["quantity","asset_id","office","category","supplier","exit_type","assigned_to","email","password","status","branch","origin","unknown"]}}` |
| `reason_codes` | Sí | operativo | Tipos sin valores rechazados. | `{"type":"array","minItems":0,"maxItems":20,"uniqueItems":true,"items":{"type":"string","enum":["missing","type","range","enum","extra_forbidden","business_rule","other"]}}` |
| `error_count` | Sí | operativo | Número de issues de esta solicitud. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000047",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "request_validation_failed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "route_template": "/inventory/orders/outbound",
    "method": "POST",
    "field_codes": [
      "quantity"
    ],
    "reason_codes": [
      "missing"
    ],
    "error_count": 1
  }
}
~~~

<a id="candidate_created"></a>

### candidate_created

Capturamos `candidate_created` porque necesitamos saber cuántas altas de candidatos se observan en el backoffice, lo que nos permite tomar la decisión de evaluar carga de captación interna.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | createCandidate recibe respuesta válida con identidad externa. |
| Productor / referencia | uis/backoffice/src/services/api.ts: createCandidate, updateCandidate, updateCandidateStatusStage, addCandidateNote, deleteCandidateNote |
| Disponibilidad | Operación existente en API externa; solo se puede observar respuesta cliente, sin garantía transaccional de telemetría. |
| Dependencias | Puente servidor futuro que autentique actor y seudonimice identificadores externos; la API Tracker es ajena al backend Nexova. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | candidate_id y note_id seudonimizados; excluir nombres, email, teléfono, CV, LinkedIn, position libre y texto de notas. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Una respuesta exitosa se registra como observación cliente; no afirmar cobertura de operaciones realizadas fuera de este backoffice.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `candidate_id` | Sí | seudonimo | Identificador externo seudonimizado. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000048",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "candidate_created",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "candidate_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
~~~

<a id="candidate_updated"></a>

### candidate_updated

Capturamos `candidate_updated` porque necesitamos saber cuántas fichas requieren mantenimiento y qué campos, lo que nos permite tomar la decisión de mejorar formularios y calidad de fichas.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | updateCandidate confirma actualización observada. |
| Productor / referencia | uis/backoffice/src/services/api.ts: createCandidate, updateCandidate, updateCandidateStatusStage, addCandidateNote, deleteCandidateNote |
| Disponibilidad | Operación existente en API externa; solo se puede observar respuesta cliente, sin garantía transaccional de telemetría. |
| Dependencias | Puente servidor futuro que autentique actor y seudonimice identificadores externos; la API Tracker es ajena al backend Nexova. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | candidate_id y note_id seudonimizados; excluir nombres, email, teléfono, CV, LinkedIn, position libre y texto de notas. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Una respuesta exitosa se registra como observación cliente; no afirmar cobertura de operaciones realizadas fuera de este backoffice.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `candidate_id` | Sí | seudonimo | Candidato seudónimo. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |
| `changed_fields` | Sí | operativo | Solo nombres de campos; sin contenido. | `{"type":"array","minItems":0,"maxItems":20,"uniqueItems":true,"items":{"type":"string","enum":["name","email","phone","position","linkedin_url","resume_url","years_of_experience"]}}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000049",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "candidate_updated",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "candidate_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "changed_fields": [
      "name"
    ]
  }
}
~~~

<a id="candidate_status_changed"></a>

### candidate_status_changed

Capturamos `candidate_status_changed` porque necesitamos saber qué transiciones de estado dominan el pipeline, lo que nos permite tomar la decisión de identificar estancamientos y revisar carga de selección.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | updateCandidateStatusStage confirma cambio efectivo de status. |
| Productor / referencia | uis/backoffice/src/services/api.ts: createCandidate, updateCandidate, updateCandidateStatusStage, addCandidateNote, deleteCandidateNote |
| Disponibilidad | Operación existente en API externa; solo se puede observar respuesta cliente, sin garantía transaccional de telemetría. |
| Dependencias | Puente servidor futuro que autentique actor y seudonimice identificadores externos; la API Tracker es ajena al backend Nexova. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | candidate_id y note_id seudonimizados; excluir nombres, email, teléfono, CV, LinkedIn, position libre y texto de notas. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Una respuesta exitosa se registra como observación cliente; no afirmar cobertura de operaciones realizadas fuera de este backoffice. Emitir solo si from_status != to_status; distinguir de cambio de etapa.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `candidate_id` | Sí | seudonimo | Candidato seudónimo. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |
| `from_status` | Sí | operativo | Estado anterior observado. | `{"type":"string","enum":["received","in_progress","selected","discarded"]}` |
| `to_status` | Sí | operativo | Estado posterior observado. | `{"type":"string","enum":["received","in_progress","selected","discarded"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000050",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "candidate_status_changed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "candidate_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "from_status": "received",
    "to_status": "in_progress"
  }
}
~~~

<a id="candidate_stage_changed"></a>

### candidate_stage_changed

Capturamos `candidate_stage_changed` porque necesitamos saber en qué etapas se concentra o avanza el trabajo, lo que nos permite tomar la decisión de redistribuir revisiones y entrevistas.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | Respuesta válida confirma cambio efectivo de stage. |
| Productor / referencia | uis/backoffice/src/services/api.ts: createCandidate, updateCandidate, updateCandidateStatusStage, addCandidateNote, deleteCandidateNote |
| Disponibilidad | Operación existente en API externa; solo se puede observar respuesta cliente, sin garantía transaccional de telemetría. |
| Dependencias | Puente servidor futuro que autentique actor y seudonimice identificadores externos; la API Tracker es ajena al backend Nexova. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | candidate_id y note_id seudonimizados; excluir nombres, email, teléfono, CV, LinkedIn, position libre y texto de notas. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Una respuesta exitosa se registra como observación cliente; no afirmar cobertura de operaciones realizadas fuera de este backoffice. Emitir solo si from_stage != to_stage. No deducir duración histórica previa a instrumentación.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `candidate_id` | Sí | seudonimo | Candidato seudónimo. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |
| `from_stage` | Sí | operativo | Etapa anterior. | `{"type":"string","enum":["pending","review","personal_interview","technical_interview","offer_presented"]}` |
| `to_stage` | Sí | operativo | Etapa posterior. | `{"type":"string","enum":["pending","review","personal_interview","technical_interview","offer_presented"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000051",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "candidate_stage_changed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "candidate_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "from_stage": "pending",
    "to_stage": "review"
  }
}
~~~

<a id="candidate_note_created"></a>

### candidate_note_created

Capturamos `candidate_note_created` porque necesitamos saber si se documenta seguimiento de candidatos, lo que nos permite tomar la decisión de revisar adopción del seguimiento.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | addCandidateNote devuelve confirmación válida. |
| Productor / referencia | uis/backoffice/src/services/api.ts: createCandidate, updateCandidate, updateCandidateStatusStage, addCandidateNote, deleteCandidateNote |
| Disponibilidad | Operación existente en API externa; solo se puede observar respuesta cliente, sin garantía transaccional de telemetría. |
| Dependencias | Puente servidor futuro que autentique actor y seudonimice identificadores externos; la API Tracker es ajena al backend Nexova. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | candidate_id y note_id seudonimizados; excluir nombres, email, teléfono, CV, LinkedIn, position libre y texto de notas. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Una respuesta exitosa se registra como observación cliente; no afirmar cobertura de operaciones realizadas fuera de este backoffice.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `candidate_id` | Sí | seudonimo | Candidato seudónimo. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |
| `note_id` | Sí | seudonimo | Nota seudónima; nunca su texto. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000052",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "candidate_note_created",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "candidate_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "note_id": "p1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }
}
~~~

<a id="candidate_note_deleted"></a>

### candidate_note_deleted

Capturamos `candidate_note_deleted` porque necesitamos saber con qué frecuencia se retiran notas internas, lo que nos permite tomar la decisión de revisar errores de uso o necesidad de edición.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | deleteCandidateNote confirma borrado observado. |
| Productor / referencia | uis/backoffice/src/services/api.ts: createCandidate, updateCandidate, updateCandidateStatusStage, addCandidateNote, deleteCandidateNote |
| Disponibilidad | Operación existente en API externa; solo se puede observar respuesta cliente, sin garantía transaccional de telemetría. |
| Dependencias | Puente servidor futuro que autentique actor y seudonimice identificadores externos; la API Tracker es ajena al backend Nexova. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | candidate_id y note_id seudonimizados; excluir nombres, email, teléfono, CV, LinkedIn, position libre y texto de notas. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Una respuesta exitosa se registra como observación cliente; no afirmar cobertura de operaciones realizadas fuera de este backoffice.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["backoffice"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `candidate_id` | Sí | seudonimo | Candidato seudónimo. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |
| `note_id` | Sí | seudonimo | Nota eliminada seudónima. | `{"type":"string","pattern":"^p[1-9][0-9]*_[a-f0-9]{64}$"}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000053",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "candidate_note_deleted",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "backoffice",
    "environment": "test",
    "actor_type": "user",
    "authority": "client_observed",
    "key_version": "p1",
    "candidate_id": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "note_id": "p1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }
}
~~~

<a id="supplier_created"></a>

### supplier_created

Capturamos `supplier_created` porque necesitamos saber cuántos proveedores se incorporan y en qué país, lo que nos permite tomar la decisión de revisar cobertura de servicios.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | POST /suppliers confirma persistencia TinyDB. |
| Productor / referencia | services/api/routes/suppliers.py: create_supplier |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Spain exige EUR; USA exige USD. Esta tarifa no es costo unitario de material.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `supplier_id` | Sí | operativo | Identificador opaco del directorio; distinto del proveedor de entradas salvo relación aprobada. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `country` | Sí | operativo | País del registro, no oficina del usuario. | `{"type":"string","enum":["Spain","USA"]}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `monthly_rate_minor` | Sí | confidencial_comercial | Tarifa mensual convertida a céntimos con redondeo decimal HALF_UP. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000054",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "supplier_created",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "supplier_id": "directory-01",
    "country": "Spain",
    "currency": "EUR",
    "monthly_rate_minor": 45000
  }
}
~~~

<a id="supplier_rate_changed"></a>

### supplier_rate_changed

Capturamos `supplier_rate_changed` porque necesitamos saber qué variación tienen las tarifas mensuales de proveedores, lo que nos permite tomar la decisión de priorizar revisión de contratos.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | PATCH /suppliers/{id}/rate confirma un valor diferente. |
| Productor / referencia | services/api/routes/suppliers.py: update_supplier_rate |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No agregar monedas; emitir solo ante cambio real y tras escritura.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `supplier_id` | Sí | operativo | Identificador opaco del directorio; distinto del proveedor de entradas salvo relación aprobada. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `country` | Sí | operativo | País del registro, no oficina del usuario. | `{"type":"string","enum":["Spain","USA"]}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `old_monthly_rate_minor` | Sí | confidencial_comercial | Tarifa anterior, en céntimos. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `new_monthly_rate_minor` | Sí | confidencial_comercial | Tarifa nueva, en céntimos. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000055",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "supplier_rate_changed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "supplier_id": "directory-01",
    "country": "Spain",
    "currency": "EUR",
    "old_monthly_rate_minor": 40000,
    "new_monthly_rate_minor": 45000
  }
}
~~~

<a id="supplier_status_changed"></a>

### supplier_status_changed

Capturamos `supplier_status_changed` porque necesitamos saber cuántos proveedores se activan o suspenden, lo que nos permite tomar la decisión de revisar disponibilidad del directorio.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | PATCH /suppliers/{id}/status confirma cambio. |
| Productor / referencia | services/api/routes/suppliers.py: update_supplier_status |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** from_status != to_status.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `supplier_id` | Sí | operativo | Identificador opaco del directorio; distinto del proveedor de entradas salvo relación aprobada. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `country` | Sí | operativo | País del registro, no oficina del usuario. | `{"type":"string","enum":["Spain","USA"]}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |
| `from_status` | Sí | operativo | Estado anterior. | `{"type":"string","enum":["active","suspended"]}` |
| `to_status` | Sí | operativo | Estado posterior. | `{"type":"string","enum":["active","suspended"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000056",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "supplier_status_changed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "supplier_id": "directory-01",
    "country": "Spain",
    "currency": "EUR",
    "from_status": "active",
    "to_status": "suspended"
  }
}
~~~

<a id="supplier_deleted"></a>

### supplier_deleted

Capturamos `supplier_deleted` porque necesitamos saber qué proveedores se eliminan del directorio, lo que nos permite tomar la decisión de revisar cobertura y bajas.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | DELETE /suppliers confirma borrado. |
| Productor / referencia | services/api/routes/suppliers.py: delete_supplier |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Capturar dimensiones permitidas antes del borrado; emitir tras confirmar.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `supplier_id` | Sí | operativo | Identificador opaco del directorio; distinto del proveedor de entradas salvo relación aprobada. | `{"type":"string","minLength":1,"maxLength":80,"pattern":"^[a-z0-9][a-z0-9_.:-]*$"}` |
| `country` | Sí | operativo | País del registro, no oficina del usuario. | `{"type":"string","enum":["Spain","USA"]}` |
| `currency` | Sí | operativo | Moneda de la oficina; nunca convertida. | `{"type":"string","enum":["EUR","USD"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000057",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "supplier_deleted",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "supplier_id": "directory-01",
    "country": "Spain",
    "currency": "EUR"
  }
}
~~~

<a id="incident_created"></a>

### incident_created

Capturamos `incident_created` porque necesitamos saber qué volumen y categorías de incidencias recibe cada sede, lo que nos permite tomar la decisión de asignar capacidad de resolución.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | Commit del POST /api/incidents en incident-manager-api. |
| Productor / referencia | services/incident-manager-api/routes/incidents.py: create_incident |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** El servicio actual no autentica: userId=null; branch no identifica al actor.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["incident_api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Este productor no dispone de actor verificable para este evento. | `{"type":"string","const":"anonymous"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `incident_id` | Sí | operativo | ID de incidencia; dato de operaciones con acceso restringido. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `branch` | Sí | operativo | Sede del dominio de incidencias, independiente de office. | `{"type":"string","enum":["central","valencia_operations","miami_office","remote"]}` |
| `origin` | Sí | operativo | Origen del ticket. | `{"type":"string","enum":["customer","branch","internal"]}` |
| `incident_category` | Sí | operativo | Categoría exacta de incident_constants.CATEGORIES; sin título ni descripción. | `{"type":"string","enum":["technical_failure","process_error","client_complaint","candidate_issue","staff_issue","sla_breach","data_quality","other"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000058",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "incident_created",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "incident_api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "incident_id": 401,
    "branch": "central",
    "origin": "customer",
    "incident_category": "technical_failure"
  }
}
~~~

<a id="incident_status_changed"></a>

### incident_status_changed

Capturamos `incident_status_changed` porque necesitamos saber cómo avanzan las incidencias hacia resolución, lo que nos permite tomar la decisión de revisar tiempos y acumulación de trabajo.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | Commit de una transición válida de estado. |
| Productor / referencia | services/incident-manager-api/routes/incidents.py: update_status |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Aplicar transiciones de incident_constants; no crear estados nuevos. userId=null sin identidad verificada.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["incident_api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Este productor no dispone de actor verificable para este evento. | `{"type":"string","const":"anonymous"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `incident_id` | Sí | operativo | ID de incidencia; dato de operaciones con acceso restringido. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `branch` | Sí | operativo | Sede del dominio de incidencias, independiente de office. | `{"type":"string","enum":["central","valencia_operations","miami_office","remote"]}` |
| `origin` | Sí | operativo | Origen del ticket. | `{"type":"string","enum":["customer","branch","internal"]}` |
| `incident_category` | Sí | operativo | Categoría exacta de incident_constants.CATEGORIES; sin título ni descripción. | `{"type":"string","enum":["technical_failure","process_error","client_complaint","candidate_issue","staff_issue","sla_breach","data_quality","other"]}` |
| `from_status` | Sí | operativo | Estado anterior. | `{"type":"string","enum":["open","in_progress","resolved","discarded"]}` |
| `to_status` | Sí | operativo | Estado posterior. | `{"type":"string","enum":["open","in_progress","resolved","discarded"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000059",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "incident_status_changed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "incident_api",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "server",
    "key_version": null,
    "incident_id": 401,
    "branch": "central",
    "origin": "customer",
    "incident_category": "technical_failure",
    "from_status": "open",
    "to_status": "in_progress"
  }
}
~~~

<a id="incident_analysis_completed"></a>

### incident_analysis_completed

Capturamos `incident_analysis_completed` porque necesitamos saber cuántas filas se descartan y por qué al analizar CSV, lo que nos permite tomar la decisión de corregir fuentes antes de importar o reportar.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | POST /api/incidents/analyze termina con resumen agregado. |
| Productor / referencia | services/api/routes/incidents.py: analyze_incidents |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** total_rows=valid_rows+invalid_rows; no capturar nombre del fichero, filas, email ni contenido CSV.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["api"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["server"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `analysis_id` | Sí | operativo | Ejecución de análisis. | `{"type":"string","format":"uuid"}` |
| `total_rows` | Sí | operativo | Filas leídas. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `valid_rows` | Sí | operativo | Filas válidas. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `invalid_rows` | Sí | operativo | Filas descartadas. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000060",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": "p1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "event_type": "incident_analysis_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "api",
    "environment": "test",
    "actor_type": "user",
    "authority": "server",
    "key_version": "p1",
    "analysis_id": "10000000-0000-4000-8000-000000000001",
    "total_rows": 100,
    "valid_rows": 96,
    "invalid_rows": 4,
    "duration_ms": 125
  }
}
~~~

<a id="talent_form_validated"></a>

### talent_form_validated

Capturamos `talent_form_validated` porque necesitamos saber cuántos formularios públicos alcanzan una validación completa, lo que nos permite tomar la decisión de mejorar el recorrido de captación.

| Aspecto | Definición |
| --- | --- |
| Categoría | negocio |
| Clasificación | oportunidad_identificada |
| Responsable | Responsable del proceso |
| Disparador | TalentForm valida todos los campos y muestra éxito local. |
| Productor / referencia | uis/website/src/app/_components/talent-form.tsx: handleSubmit |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No representa matrícula, candidato persistido, email enviado ni aceptación de telemetría por el checkbox de datos.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["website"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Actor que causa el hecho; no confundir con el emisor. | `{"type":"string","enum":["user","anonymous","system"]}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["client_observed"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `flow_id` | Sí | operativo | Recorrido de registro. | `{"type":"string","format":"uuid"}` |
| `form_version` | Sí | operativo | Versión del formulario observado. | `{"type":"string","const":"1.0.0"}` |
| `step_count` | Sí | operativo | Pasos del formulario actual. | `{"type":"integer","const":3}` |
| `persistence_mode` | Sí | operativo | La aplicación actual solo simula envío. | `{"type":"string","enum":["local_simulation"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000061",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": "10000000-0000-4000-8000-000000000001",
  "userId": null,
  "event_type": "talent_form_validated",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "website",
    "environment": "test",
    "actor_type": "anonymous",
    "authority": "client_observed",
    "key_version": null,
    "flow_id": "10000000-0000-4000-8000-000000000001",
    "form_version": "1.0.0",
    "step_count": 3,
    "persistence_mode": "local_simulation"
  }
}
~~~

<a id="telemetry_batch_processed"></a>

### telemetry_batch_processed

Capturamos `telemetry_batch_processed` porque necesitamos saber si los lotes se procesan completos y en plazo, lo que nos permite tomar la decisión de reparar retrasos o rechazos del pipeline.

| Aspecto | Definición |
| --- | --- |
| Categoría | telemetria |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Finaliza procesamiento de un lote seguro. |
| Productor / referencia | pipeline futuro de ingesta, entrega y agregación; no existe hoy |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Un fallo de ingesta afecta todos los informes; detectar en ≤60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** received_count=accepted_count+rejected_count+duplicate_count; categorías disjuntas.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["telemetry_worker"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Observación de proceso sin usuario. | `{"type":"string","const":"system"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["derived"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `batch_id` | Sí | operativo | Lote. | `{"type":"string","format":"uuid"}` |
| `received_count` | Sí | operativo | Eventos recibidos. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `accepted_count` | Sí | operativo | Eventos aceptados. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `rejected_count` | Sí | operativo | Eventos inválidos. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `duplicate_count` | Sí | operativo | Reentregas eliminadas. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `duration_ms` | Sí | operativo | Duración en milisegundos con reloj monotónico. | `{"type":"number","minimum":0,"maximum":3600000}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000062",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "telemetry_batch_processed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "telemetry_worker",
    "environment": "test",
    "actor_type": "system",
    "authority": "derived",
    "key_version": null,
    "batch_id": "10000000-0000-4000-8000-000000000001",
    "received_count": 100,
    "accepted_count": 99,
    "rejected_count": 1,
    "duplicate_count": 0,
    "duration_ms": 125
  }
}
~~~

<a id="telemetry_event_rejected"></a>

### telemetry_event_rejected

Capturamos `telemetry_event_rejected` porque necesitamos saber qué esquemas o sanitizaciones impiden aceptar eventos, lo que nos permite tomar la decisión de corregir productores sin guardar payloads peligrosos.

| Aspecto | Definición |
| --- | --- |
| Categoría | telemetria |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Validador rechaza un evento; genera solo diagnóstico seguro. |
| Productor / referencia | pipeline futuro de ingesta, entrega y agregación; no existe hoy |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** No guardar payload rechazado en logs ni DLQ; solo referencia segura y código. Fallo de diagnóstico se cuenta fuera de banda; no recursión.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["telemetry_worker"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Observación de proceso sin usuario. | `{"type":"string","const":"system"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["derived"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `rejected_event_type` | Sí | operativo | Tipo conocido o unknown; nunca copiar entrada arbitraria. | `{"type":"string","enum":["inbound_order_created","outbound_order_created","stock_threshold_triggered","direct_stock_edit_rejected","kit_cost_variance_detected","product_created","inventory_validation_failed","outbound_order_rejected","stock_recovered","stock_depleted","inventory_metadata_missing","login_succeeded","login_failed","session_expired","session_invalidated","session_logged_out","access_rejected","rate_limit_triggered","account_created","account_updated","account_deleted","profile_updated","password_reset_requested","password_reset_completed","password_change_completed","password_operation_failed","notification_delivery_completed","page_viewed","navigation_failed","search_completed","filter_applied","flow_started","flow_step_completed","flow_submitted","flow_completed","flow_cancelled","flow_abandonment_detected","api_request_completed","client_request_completed","page_performance_recorded","cache_lookup_completed","cache_invalidated","database_operation_completed","dependency_request_completed","frontend_error_captured","backend_error_captured","request_validation_failed","candidate_created","candidate_updated","candidate_status_changed","candidate_stage_changed","candidate_note_created","candidate_note_deleted","supplier_created","supplier_rate_changed","supplier_status_changed","supplier_deleted","incident_created","incident_status_changed","incident_analysis_completed","talent_form_validated","telemetry_batch_processed","telemetry_event_rejected","telemetry_delivery_failed","telemetry_queue_observed","telemetry_reconciliation_completed","unknown"]}` |
| `reason_code` | Sí | operativo | Fallo normalizado. | `{"type":"string","enum":["schema","privacy","unsupported_version","unknown_type","oversize"]}` |
| `rejected_count` | Sí | operativo | Eventos rechazados en esta observación. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000063",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "telemetry_event_rejected",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "telemetry_worker",
    "environment": "test",
    "actor_type": "system",
    "authority": "derived",
    "key_version": null,
    "rejected_event_type": "inbound_order_created",
    "reason_code": "schema",
    "rejected_count": 1
  }
}
~~~

<a id="telemetry_delivery_failed"></a>

### telemetry_delivery_failed

Capturamos `telemetry_delivery_failed` porque necesitamos saber si los reintentos impiden entregar eventos confirmados, lo que nos permite tomar la decisión de restaurar canal y priorizar backlog.

| Aspecto | Definición |
| --- | --- |
| Categoría | telemetria |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Falla intento de entrega al canal. |
| Productor / referencia | pipeline futuro de ingesta, entrega y agregación; no existe hoy |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Detectar en ≤60 s evita pérdidas por agotamiento de retención. |
| Frecuencia / control de volumen | Un evento por hecho confirmado; sin muestreo, throttle ni debounce. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["telemetry_worker"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Observación de proceso sin usuario. | `{"type":"string","const":"system"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["derived"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `batch_id` | Sí | operativo | Lote con fallo. | `{"type":"string","format":"uuid"}` |
| `attempt` | Sí | operativo | Número de intento. | `{"type":"integer","minimum":1,"maximum":10}` |
| `pending_count` | Sí | operativo | Eventos pendientes. | `{"type":"integer","minimum":1,"maximum":9007199254740991}` |
| `reason_code` | Sí | operativo | Causa segura. | `{"type":"string","enum":["timeout","unavailable","unauthorized","rate_limited","other"]}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000064",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "telemetry_delivery_failed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "telemetry_worker",
    "environment": "test",
    "actor_type": "system",
    "authority": "derived",
    "key_version": null,
    "batch_id": "10000000-0000-4000-8000-000000000001",
    "attempt": 1,
    "pending_count": 10,
    "reason_code": "timeout"
  }
}
~~~

<a id="telemetry_queue_observed"></a>

### telemetry_queue_observed

Capturamos `telemetry_queue_observed` porque necesitamos saber cuántos eventos esperan y cuál es su antigüedad, lo que nos permite tomar la decisión de escalar capacidad y atender bloqueos.

| Aspecto | Definición |
| --- | --- |
| Categoría | telemetria |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Worker obtiene estado de cola cada 60 s. |
| Productor / referencia | pipeline futuro de ingesta, entrega y agregación; no existe hoy |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | stream |
| Urgencia / decisión temporal | Antigüedad creciente exige intervención antes de perder frescura. |
| Frecuencia / control de volumen | Una observación por cola/instancia cada 60 s; canal stream. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Contrato de campo y reglas comunes de §3–§6.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["telemetry_worker"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Observación de proceso sin usuario. | `{"type":"string","const":"system"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["derived"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `queue_name` | Sí | operativo | Cola lógica. | `{"type":"string","enum":["inventory_outbox","analytics_batch","retry"]}` |
| `pending_count` | Sí | operativo | Eventos pendientes. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `oldest_age_seconds` | Sí | operativo | Edad del más antiguo; 0 si vacía. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `dead_letter_count` | Sí | operativo | Eventos saneados agotados de reintentos. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000065",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "telemetry_queue_observed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "telemetry_worker",
    "environment": "test",
    "actor_type": "system",
    "authority": "derived",
    "key_version": null,
    "queue_name": "inventory_outbox",
    "pending_count": 10,
    "oldest_age_seconds": 30,
    "dead_letter_count": 0
  }
}
~~~

<a id="telemetry_reconciliation_completed"></a>

### telemetry_reconciliation_completed

Capturamos `telemetry_reconciliation_completed` porque necesitamos saber si movimientos persistidos y eventos únicos coinciden, lo que nos permite tomar la decisión de reemitir faltantes y advertir cobertura incompleta.

| Aspecto | Definición |
| --- | --- |
| Categoría | telemetria |
| Clasificación | oportunidad_identificada |
| Responsable | Tecnología |
| Disparador | Termina reconciliación diaria por tipo de orden y ventana. |
| Productor / referencia | pipeline futuro de ingesta, entrega y agregación; no existe hoy |
| Disponibilidad | Punto funcional existente; instrumentación y transporte pendientes. |
| Dependencias | Envelope, saneamiento y canal de entrega futuro. |
| Entrega | batch |
| Urgencia / decisión temporal | El control diario detecta pérdidas históricas; disponibilidad al terminar la ejecución, sin necesidad de stream. |
| Frecuencia / control de volumen | Diaria a las 06:00 UTC sobre día UTC anterior; reprocesar últimos 7 días. |
| Deduplicación | eventId estable en reentregas; el productor emite una vez por hecho. |
| PII / saneamiento | Identidad del actor seudonimizada en servidor; no incluir textos libres ni cuerpos de solicitud. |
| Aceptación | Al cumplirse el disparador documentado, emitir una vez con el contrato y autoridad de esta ficha; sin ese disparador no emitir. El ejemplo de esta ficha debe validar y la inyección de claves, cambios de versión y ausencia de campos obligatorios deben rechazarse. Aplicar además los casos de §7.2 y las reglas semánticas indicadas. |

**Reglas semánticas adicionales:** Comparar conjuntos por (order_type,order_id), no solo sus totales. No cambiar órdenes ni reconstruir costos/dimensiones históricos sin versión verificable.

| Propiedad permitida | Obligatorio | Sensibilidad | Descripción / unidad | Restricción JSON |
| --- | --- | --- | --- | --- |
| `source` | Sí | operativo | Productor lógico autorizado. | `{"type":"string","enum":["telemetry_worker"]}` |
| `environment` | Sí | operativo | Entorno; separar producción de pruebas. | `{"type":"string","enum":["development","test","production"]}` |
| `actor_type` | Sí | operativo | Observación de proceso sin usuario. | `{"type":"string","const":"system"}` |
| `authority` | Sí | operativo | Autoridad de la observación según productor. | `{"type":"string","enum":["derived"]}` |
| `key_version` | Sí | operativo | Versión de HMAC; p1 si existe identificador personal seudónimo, null en caso contrario. | `{"anyOf":[{"type":"string","const":"p1"},{"type":"null"}]}` |
| `window_start` | Sí | operativo | Inicio inclusivo UTC. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `window_end` | Sí | operativo | Fin exclusivo UTC. | `{"type":"string","format":"date-time","pattern":"Z$"}` |
| `order_type` | Sí | operativo | Tipo que desambigua el identificador de orden. | `{"type":"string","enum":["inbound","outbound"]}` |
| `persisted_count` | Sí | operativo | Órdenes persistidas en la ventana. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `event_count` | Sí | operativo | Eventos únicos de órdenes creadas. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `missing_count` | Sí | operativo | Órdenes sin evento válido. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |
| `orphan_count` | Sí | operativo | Eventos sin orden correspondiente. | `{"type":"integer","minimum":0,"maximum":9007199254740991}` |

**Ejemplo completo:**

~~~json
{
  "eventId": "10000000-0000-4000-8000-000000000066",
  "timestamp": "2026-10-26T09:00:00.000Z",
  "sessionId": null,
  "userId": null,
  "event_type": "telemetry_reconciliation_completed",
  "schemaVersion": "1.0.0",
  "requestId": "10000000-0000-4000-8000-000000000001",
  "properties": {
    "source": "telemetry_worker",
    "environment": "test",
    "actor_type": "system",
    "authority": "derived",
    "key_version": null,
    "window_start": "2026-10-25T00:00:00.000Z",
    "window_end": "2026-10-26T00:00:00.000Z",
    "order_type": "inbound",
    "persisted_count": 15,
    "event_count": 15,
    "missing_count": 0,
    "orphan_count": 0
  }
}
~~~

## 9. Entrega y resultado de revisión

Rama feature/telemetry-design-plan creada antes de modificar archivos desde origin/main y verificada contra main actualizada. Entrega principal: telemetry-plan.md y event-schemas.json. Soporte reproducible: scripts/validate-telemetry.cjs, registro de pruebas y memoria. No se modifican interfaces, API, dependencias ni datos.

Commit previsto: docs: define plan y esquemas de telemetria. PR contra main con título exacto: docs: telemetry design plan.

Descripción del PR: 66 eventos (5 obligatorios/61 oportunidades), siete categorías (inventario, autenticación/cuentas, navegación/flujos, rendimiento, errores, otros procesos de negocio y operación de telemetría), resultado del verificador y decisión más difícil: adaptar el inventario existente al briefing sin inventar datos ni perder trazabilidad. Merge solo tras aprobación del PR y comprobaciones requeridas satisfechas; no afirmar despliegue de instrumentación con este cambio documental.

### Resultado de validación de esta entrega

Ejecutado el 26/10/2026 con Node y Ajv 6.15.0: PASS, 66 contratos/fichas, 5 obligatorios, 61 oportunidades y siete categorías; 9.450 comprobaciones documentales/de contrato correctas. Incluye comparación de categorías del gestor con su fuente real, límites aritméticos, ejemplos anónimos/procesos y control semántico sintético de registro. Sin acceso a DB/red, sin pytest/Jest/build de aplicación porque no se modifica aplicación. La instrumentación y sus pruebas de integración siguen pendientes.
