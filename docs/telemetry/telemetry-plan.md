# Plan de Telemetría — Nexova

**Estado:** diseño 1.0.0 · **Fecha:** 26/10/2026 · **Rama de revisión:** feature/telemetry-plan-compact (diseño inicial: feature/telemetry-design-plan).

Respuesta al RFI de gestión: el sistema puede producir información accionable sobre inventario y otras operaciones, pero algunas dimensiones del briefing requieren ampliaciones previas. Esta entrega define contratos y puntos de captura; no incorpora instrumentación, infraestructura, migraciones ni escrituras en bases de datos.

**Cobertura:** 66 eventos, 5 obligatorio y 61 oportunidad_identificada, en siete categorías. Cada ficha combina el catálogo compacto de §8 con su definición JSON, que conserva productor, disponibilidad, contrato, privacidad, entrega y aceptación completos. Los esquemas y ejemplos están en [event-schemas.json](./event-schemas.json); el verificador reproducible está en [validate-telemetry.cjs](../../scripts/validate-telemetry.cjs).

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

Fuente api/incident_api exige authority=server; website/backoffice/application exige client_observed; telemetry_worker exige derived. Procedencia no equivale a autorización automática: el colector futuro autentica productores, verifica sesión y enriquece identidad. §8.4 enumera las allowlists específicas; se unen a estas propiedades comunes. Las restricciones completas y condiciones permanecen en cada definición JSON.

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

Valida metaschema, 66 contratos/fichas, cinco obligatorios, siete categorías, formatos activos, ejemplos, claves extra, tipos, enums, oficina–moneda, fuente/autoridad e identidad. Compara catálogo, hipótesis/decisiones, disparadores, entrega, allowlists tipadas y referencias Markdown/JSON; valida metadata completa y ejemplos directamente en el JSON, sin duplicarlos. Fixtures semánticos demuestran cálculos y límites; no prueban transacciones ni un sanitizador desplegado.

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
| 8. Allowlists | §3 + §8.4 + properties JSON, objetos cerrados | Sí | Inyección rechazada | Pendiente |
| 9. Tipos/obligatoriedad/PII | §8.4 + properties/required/x-sensitivity JSON y §6 | Sí | Contratos y revisión | Pendiente |
| 10. Exportación válida | JSON Draft-07 | Sí | Metaschema y ejemplos | Pendiente |
| 11. Stream/batch | §5 y urgencia por ficha | Sí | Metadata y revisión | Pendiente |
| 12. Throttle/debounce | §5 y frecuencia por ficha | Sí | Ventanas/excepciones | Pendiente |
| 13. Riesgos/exclusiones | §6 | Sí | Revisión razonada | Pendiente |
| 14. Obligatorios correctos | §1→§4→§8→JSON→indicadores | Sí | Nombres y dimensiones | Pendiente |
| 15. Amplitud técnica/negocio | Siete categorías §8 | Sí | Conteos/revisión | Pendiente |
| 16. Finalidad por evento | Hipótesis y decisión §8 | Sí | Texto exacto + revisión de mérito | Pendiente |
| 17. Envelope consistente | §3, versión 1.0.0 | Sí | Ejemplos/ausencias rechazadas | Pendiente |
| 18. Solo claves permitidas | Objetos cerrados/arrays tipados | Sí | Negativos recursivos | Pendiente |
| 19. Coherencia MD/JSON | Catálogo/allowlists §8; fichas/ejemplos JSON | Sí | Comparación exacta | Pendiente |
| 20. Urgencia justificada | Fichas §8 | Sí | Metadata/revisión | Pendiente |
| 21. PII tratada | §3.1/§6/§8 | Sí | Forma/registro de prueba; sanitizador pendiente | Pendiente |
| 22. Descartes razonados | §6 | Sí | Revisión crítica | Pendiente |
| 23. Precisión implementable | Disparo/productor/contrato/entrega/dedup/aceptación §8 | Sí | Completitud y revisión | Pendiente |

## 8. Catálogo compacto y contratos

Cada ficha se compone de la fila de este catálogo y su definición homónima en [event-schemas.json](./event-schemas.json). El JSON conserva **sin cambios los 66 contratos y ejemplos completos**: properties/required definen tipos, obligatoriedad, null, enums, rangos, unidades, descripciones y sensibilidad; x-telemetry contiene hipótesis, decisión, responsable, disparador, productor, disponibilidad, dependencias, entrega/urgencia, frecuencia, deduplicación, privacidad, reglas semánticas y aceptación. El enlace de cada evento identifica su definición mediante JSON Pointer (#/definitions/event_type).

La frase de justificación se lee en cada fila de §8.2: **“Capturamos [evento] porque necesitamos saber [hipótesis], lo que nos permite tomar la decisión de [decisión]”.** Las dos columnas completan esa frase sin repetir el prefijo 66 veces. §8.3 concreta disparo/urgencia; §8.4 enumera toda la allowlist específica. Las reglas comunes se documentan una vez en §3–§7 y se aplican a cada ficha.

### 8.1. Los cinco eventos obligatorios

Todos incluyen las seis dimensiones mínimas del briefing y las propiedades comunes de §3; ver semántica de cantidad, moneda y null en §4. Toda métrica se cuenta desde el hecho confirmado correspondiente, nunca desde el clic de envío. Los cinco se entregan como stream ≤60 s, sin muestreo ni debounce.

#### `inbound_order_created`

**Finalidad:** necesitamos saber cuánto material se produce o compra, para qué programa y con qué costo para planificar la producción de material según la demanda esperada de matrículas (Elena). **Responsable:** Elena (L&D).

**Disparo:** Después de confirmar la transacción de AssetEntry; el evento se guarda en outbox dentro de esa misma transacción. **Productor:** `services/api/routes/inventory.py: create_inbound_order`.

**Urgencia:** Conocer entradas confirmadas en ≤60 s permite actualizar abastecimiento y rearmar alertas sin esperar al informe diario. **Deduplicación:** Un evento por (inbound, order_id); eventId persistido con outbox.

**Reglas específicas:** total_cost_minor = quantity * unit_cost_minor; usar enteros seguros o decimal exacto al multiplicar. office es la oficina de la entrada; asset_office conserva la del activo.

**Contrato completo, propiedades y ejemplo:** [contrato y ficha](./event-schemas.json#/definitions/inbound_order_created). Dependencias: Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores.

#### `outbound_order_created`

**Finalidad:** necesitamos saber qué programas consumen más material y a qué ritmo para anticipar reposiciones antes de una ola de matrículas (Elena). **Responsable:** Elena (L&D).

**Disparo:** Después de confirmar AssetExit, con stock validado bajo bloqueo del activo. **Productor:** `services/api/routes/inventory.py: create_outbound_order`.

**Urgencia:** El consumo confirmado alimenta reposición y detección de escasez en ≤60 s. **Deduplicación:** Un evento por (outbound, order_id); eventId persistido con outbox.

**Reglas específicas:** Reglas comunes de órdenes y privacidad de §3–§6; excluir destinatario personal.

**Contrato completo, propiedades y ejemplo:** [contrato y ficha](./event-schemas.json#/definitions/outbound_order_created). Dependencias: Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores.

#### `stock_threshold_triggered`

**Finalidad:** necesitamos saber con qué frecuencia un programa se queda sin material disponible para ajustar el mínimo o acelerar la reimpresión/reproducción. **Responsable:** Operaciones / Elena (L&D).

**Disparo:** Una salida confirmada cumple stock_before >= threshold y stock_after < threshold; solo una vez por entrada en estado bajo. **Productor:** `Evaluador futuro dentro de services/api/routes/inventory.py: create_outbound_order`.

**Urgencia:** Operaciones debe reponer antes del siguiente consumo; disponibilidad ≤60 s. **Deduplicación:** Clave de episodio (product_id, threshold_version, orden de cruce); eventId de outbox.

**Reglas específicas:** quantity = stock_after. office es Asset.office, porque el saldo actual es por activo. No emitir por lectura, cache hit, cambio de configuración ni arranque con stock bajo.

**Contrato completo, propiedades y ejemplo:** [contrato y ficha](./event-schemas.json#/definitions/stock_threshold_triggered). Dependencias: Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores.

#### `direct_stock_edit_rejected`

**Finalidad:** necesitamos saber si el personal intenta saltarse el control de trazabilidad del material para reforzar capacitación o permisos en la oficina con mayor incidencia (Patricia). **Responsable:** Patricia (RRHH).

**Disparo:** Una escritura a una ruta de inventario fue rechazada y contiene una clave explícita de stock reconocida; un 404/405/422 aislado no demuestra el intento. **Productor:** `Handler futuro de validación/405 en services/api/main.py limitado a rutas de inventory`.

**Urgencia:** Un bypass intentado exige revisión de seguridad o asistencia en ≤60 s. **Deduplicación:** eventId estable en reentregas; el productor emite una vez por hecho.

**Reglas específicas:** quantity = 0. Con resolution_reason=resolved las dimensiones no son null. Nulos únicamente cuando no se pueden resolver: no reemplazar por datos ficticios. 401 previo a inspección segura produce access_rejected; no afirmar una intención no comprobada.

**Contrato completo, propiedades y ejemplo:** [contrato y ficha](./event-schemas.json#/definitions/direct_stock_edit_rejected). Dependencias: Detector futuro de escrituras rechazadas y resolución segura de producto/metadatos; nunca habilitar escritura directa.

#### `kit_cost_variance_detected`

**Finalidad:** necesitamos saber cuándo un proveedor de material cambia precios de forma anómala para alertar a Elena y Laura para renegociar o buscar proveedor alterno. **Responsable:** Elena (L&D) / Laura.

**Disparo:** Entrada confirmada con al menos 3 antecedentes comparables en 90 días y abs(variación) > 10, calculada sin redondear. **Productor:** `Evaluador futuro dentro de services/api/routes/inventory.py: create_inbound_order`.

**Urgencia:** Alertar en ≤60 s permite revisar una compra anómala antes de repetirla. **Deduplicación:** eventId estable en reentregas; el productor emite una vez por hecho.

**Reglas específicas:** Ventana [timestamp-90 días, timestamp); excluir orden actual, cambios posteriores y otras monedas/proveedores/productos/oficinas. Comparar mediante racionales exactos: abs(costo_actual*unidades_ref-costo_ref)*100 > costo_ref*10. Baseline cero o <3 entradas no produce anomalía; registrar inventory_metadata_missing con motivo de referencia.

**Contrato completo, propiedades y ejemplo:** [contrato y ficha](./event-schemas.json#/definitions/kit_cost_variance_detected). Dependencias: Clasificación analítica por producto, programme_id, configuración versionada de mínimos, UUID de actor y outbox SQL futuros. Para entradas: supplier_id estable y costos en unidades menores.

### 8.2. Hipótesis y decisión de los 66 eventos

Clasificación: los cinco de §8.1 son **obligatorio**; todas las demás filas son **oportunidad_identificada**. El encabezado de cada tabla determina su categoría. Cada evento aparece una vez por tabla y enlaza su ficha completa.

#### Inventario

| Evento / ficha | Necesitamos saber… | Para decidir… |
| --- | --- | --- |
| [inbound_order_created](./event-schemas.json#/definitions/inbound_order_created) | cuánto material se produce o compra, para qué programa y con qué costo | planificar la producción de material según la demanda esperada de matrículas (Elena) |
| [outbound_order_created](./event-schemas.json#/definitions/outbound_order_created) | qué programas consumen más material y a qué ritmo | anticipar reposiciones antes de una ola de matrículas (Elena) |
| [stock_threshold_triggered](./event-schemas.json#/definitions/stock_threshold_triggered) | con qué frecuencia un programa se queda sin material disponible | ajustar el mínimo o acelerar la reimpresión/reproducción |
| [direct_stock_edit_rejected](./event-schemas.json#/definitions/direct_stock_edit_rejected) | si el personal intenta saltarse el control de trazabilidad del material | reforzar capacitación o permisos en la oficina con mayor incidencia (Patricia) |
| [kit_cost_variance_detected](./event-schemas.json#/definitions/kit_cost_variance_detected) | cuándo un proveedor de material cambia precios de forma anómala | alertar a Elena y Laura para renegociar o buscar proveedor alterno |
| [product_created](./event-schemas.json#/definitions/product_created) | qué programas amplían su catálogo de material | revisar altas y preparar abastecimiento |
| [inventory_validation_failed](./event-schemas.json#/definitions/inventory_validation_failed) | qué campos y productos acumulan errores al preparar órdenes | corregir formularios y capacitación |
| [outbound_order_rejected](./event-schemas.json#/definitions/outbound_order_rejected) | cuánta demanda no puede atenderse y por qué | priorizar reposición o resolver problemas de catálogo |
| [stock_recovered](./event-schemas.json#/definitions/stock_recovered) | cuánto tarda el material en salir del estado bajo | evaluar la eficacia de reposición |
| [stock_depleted](./event-schemas.json#/definitions/stock_depleted) | qué productos se agotan por completo | priorizar reposición urgente |
| [inventory_metadata_missing](./event-schemas.json#/definitions/inventory_metadata_missing) | qué movimientos carecen de dimensiones o referencia para medirlos | asignar correcciones al catálogo y explicar cobertura de indicadores |

#### Autenticación y cuentas

| Evento / ficha | Necesitamos saber… | Para decidir… |
| --- | --- | --- |
| [login_succeeded](./event-schemas.json#/definitions/login_succeeded) | cuántos accesos válidos hay y en qué aplicación | dimensionar soporte y comparar acceso con uso posterior |
| [login_failed](./event-schemas.json#/definitions/login_failed) | cuántos intentos fallidos ocurren y se concentran en el tiempo | investigar abuso o problemas de acceso |
| [session_expired](./event-schemas.json#/definitions/session_expired) | cuántos flujos se interrumpen por expiración confirmada | ajustar experiencia de reautenticación |
| [session_invalidated](./event-schemas.json#/definitions/session_invalidated) | qué sesiones dejan de ser válidas tras cambios de cuenta o contraseña | explicar interrupciones y revisar soporte de sesiones |
| [session_logged_out](./event-schemas.json#/definitions/session_logged_out) | cuántas sesiones se cierran voluntariamente | distinguir cierre normal de pérdida de acceso |
| [access_rejected](./event-schemas.json#/definitions/access_rejected) | qué secciones concentran rechazos de acceso | revisar permisos y rutas protegidas |
| [rate_limit_triggered](./event-schemas.json#/definitions/rate_limit_triggered) | con qué frecuencia el limitador bloquea recuperación | investigar abuso y ajustar capacidad de soporte |
| [account_created](./event-schemas.json#/definitions/account_created) | cuántas cuentas nuevas se crean y con qué rol efectivo | revisar incorporación y accesos |
| [account_updated](./event-schemas.json#/definitions/account_updated) | qué frecuencia tienen los cambios de rol o estado | revisar administración y privilegios |
| [account_deleted](./event-schemas.json#/definitions/account_deleted) | cuántas cuentas se eliminan y quién ejecuta la acción | comprobar bajas y detectar borrados inesperados |
| [profile_updated](./event-schemas.json#/definitions/profile_updated) | con qué frecuencia se mantienen los perfiles | mejorar la experiencia de cuenta y soporte |
| [password_reset_requested](./event-schemas.json#/definitions/password_reset_requested) | cuántas solicitudes de recuperación se presentan | estimar carga de recuperación y mejorar ayuda |
| [password_reset_completed](./event-schemas.json#/definitions/password_reset_completed) | qué proporción del flujo de recuperación llega a una contraseña nueva | corregir fricción y orientar soporte |
| [password_change_completed](./event-schemas.json#/definitions/password_change_completed) | si el cambio autenticado de contraseña termina correctamente | mejorar el flujo y soporte de reautenticación |
| [password_operation_failed](./event-schemas.json#/definitions/password_operation_failed) | qué causas bloquean reset o cambio de contraseña | corregir ayuda, validaciones o investigar intentos inválidos |
| [notification_delivery_completed](./event-schemas.json#/definitions/notification_delivery_completed) | si el proveedor acepta o rechaza notificaciones de recuperación | resolver fallos de entrega sin exponer destinatarios |

#### Navegación y flujos

| Evento / ficha | Necesitamos saber… | Para decidir… |
| --- | --- | --- |
| [page_viewed](./event-schemas.json#/definitions/page_viewed) | qué secciones visitan más los operadores y visitantes | priorizar navegación y mantenimiento |
| [navigation_failed](./event-schemas.json#/definitions/navigation_failed) | qué rutas no llegan a mostrarse | reparar enlaces y carga de secciones |
| [search_completed](./event-schemas.json#/definitions/search_completed) | qué proporción de búsquedas devuelve cero resultados y tarda demasiado | mejorar búsqueda sin capturar lo escrito |
| [filter_applied](./event-schemas.json#/definitions/filter_applied) | qué filtros se usan y si encuentran resultados | simplificar filtros y detectar combinaciones inútiles |
| [flow_started](./event-schemas.json#/definitions/flow_started) | cuántas personas empiezan realmente cada recorrido | medir conversión desde intención activa |
| [flow_step_completed](./event-schemas.json#/definitions/flow_step_completed) | qué pasos se completan y cuánto cuestan | simplificar el paso con mayor fricción |
| [flow_submitted](./event-schemas.json#/definitions/flow_submitted) | cuántos recorridos llegan a un intento de envío válido | separar fricción previa de problemas de confirmación |
| [flow_completed](./event-schemas.json#/definitions/flow_completed) | cuántos recorridos muestran confirmación al usuario | detectar diferencias entre persistencia y confirmación visible |
| [flow_cancelled](./event-schemas.json#/definitions/flow_cancelled) | qué recorridos se cancelan de forma explícita | mejorar acciones y claridad de formularios |
| [flow_abandonment_detected](./event-schemas.json#/definitions/flow_abandonment_detected) | dónde quedan recorridos sin finalizar | priorizar mejoras de formularios con abandono sostenido |

#### Rendimiento

| Evento / ficha | Necesitamos saber… | Para decidir… |
| --- | --- | --- |
| [api_request_completed](./event-schemas.json#/definitions/api_request_completed) | qué endpoints acumulan lentitud y errores HTTP | priorizar optimización y capacidad |
| [client_request_completed](./event-schemas.json#/definitions/client_request_completed) | qué demora experimenta el navegador y cuántas peticiones no reciben respuesta | distinguir red, cliente y servidor |
| [page_performance_recorded](./event-schemas.json#/definitions/page_performance_recorded) | qué experiencia real tienen las páginas | optimizar carga y respuesta de las vistas más costosas |
| [cache_lookup_completed](./event-schemas.json#/definitions/cache_lookup_completed) | si la caché reduce consultas y latencia por listado | ajustar TTL y capacidad sin servir datos obsoletos |
| [cache_invalidated](./event-schemas.json#/definitions/cache_invalidated) | qué escrituras invalidan caché y con qué eficacia | revisar coherencia y costo de invalidación |
| [database_operation_completed](./event-schemas.json#/definitions/database_operation_completed) | qué familias de consulta consumen tiempo o fallan | optimizar consultas e índices |
| [dependency_request_completed](./event-schemas.json#/definitions/dependency_request_completed) | qué dependencia externa explica fallos o demora | priorizar mitigación o soporte del proveedor |

#### Errores

| Evento / ficha | Necesitamos saber… | Para decidir… |
| --- | --- | --- |
| [frontend_error_captured](./event-schemas.json#/definitions/frontend_error_captured) | qué fallos de render o promesas interrumpen la experiencia | priorizar correcciones por impacto |
| [backend_error_captured](./event-schemas.json#/definitions/backend_error_captured) | qué excepciones inesperadas afectan operaciones | reparar fallos con mayor impacto |
| [request_validation_failed](./event-schemas.json#/definitions/request_validation_failed) | qué contratos HTTP reciben datos inválidos | corregir clientes e identificar incompatibilidades |

#### Otros procesos de negocio

| Evento / ficha | Necesitamos saber… | Para decidir… |
| --- | --- | --- |
| [candidate_created](./event-schemas.json#/definitions/candidate_created) | cuántas altas de candidatos se observan en el backoffice | evaluar carga de captación interna |
| [candidate_updated](./event-schemas.json#/definitions/candidate_updated) | cuántas fichas requieren mantenimiento y qué campos | mejorar formularios y calidad de fichas |
| [candidate_status_changed](./event-schemas.json#/definitions/candidate_status_changed) | qué transiciones de estado dominan el pipeline | identificar estancamientos y revisar carga de selección |
| [candidate_stage_changed](./event-schemas.json#/definitions/candidate_stage_changed) | en qué etapas se concentra o avanza el trabajo | redistribuir revisiones y entrevistas |
| [candidate_note_created](./event-schemas.json#/definitions/candidate_note_created) | si se documenta seguimiento de candidatos | revisar adopción del seguimiento |
| [candidate_note_deleted](./event-schemas.json#/definitions/candidate_note_deleted) | con qué frecuencia se retiran notas internas | revisar errores de uso o necesidad de edición |
| [supplier_created](./event-schemas.json#/definitions/supplier_created) | cuántos proveedores se incorporan y en qué país | revisar cobertura de servicios |
| [supplier_rate_changed](./event-schemas.json#/definitions/supplier_rate_changed) | qué variación tienen las tarifas mensuales de proveedores | priorizar revisión de contratos |
| [supplier_status_changed](./event-schemas.json#/definitions/supplier_status_changed) | cuántos proveedores se activan o suspenden | revisar disponibilidad del directorio |
| [supplier_deleted](./event-schemas.json#/definitions/supplier_deleted) | qué proveedores se eliminan del directorio | revisar cobertura y bajas |
| [incident_created](./event-schemas.json#/definitions/incident_created) | qué volumen y categorías de incidencias recibe cada sede | asignar capacidad de resolución |
| [incident_status_changed](./event-schemas.json#/definitions/incident_status_changed) | cómo avanzan las incidencias hacia resolución | revisar tiempos y acumulación de trabajo |
| [incident_analysis_completed](./event-schemas.json#/definitions/incident_analysis_completed) | cuántas filas se descartan y por qué al analizar CSV | corregir fuentes antes de importar o reportar |
| [talent_form_validated](./event-schemas.json#/definitions/talent_form_validated) | cuántos formularios públicos alcanzan una validación completa | mejorar el recorrido de captación |

#### Operación de telemetría

| Evento / ficha | Necesitamos saber… | Para decidir… |
| --- | --- | --- |
| [telemetry_batch_processed](./event-schemas.json#/definitions/telemetry_batch_processed) | si los lotes se procesan completos y en plazo | reparar retrasos o rechazos del pipeline |
| [telemetry_event_rejected](./event-schemas.json#/definitions/telemetry_event_rejected) | qué esquemas o sanitizaciones impiden aceptar eventos | corregir productores sin guardar payloads peligrosos |
| [telemetry_delivery_failed](./event-schemas.json#/definitions/telemetry_delivery_failed) | si los reintentos impiden entregar eventos confirmados | restaurar canal y priorizar backlog |
| [telemetry_queue_observed](./event-schemas.json#/definitions/telemetry_queue_observed) | cuántos eventos esperan y cuál es su antigüedad | escalar capacidad y atender bloqueos |
| [telemetry_reconciliation_completed](./event-schemas.json#/definitions/telemetry_reconciliation_completed) | si movimientos persistidos y eventos únicos coinciden | reemitir faltantes y advertir cobertura incompleta |

### 8.3. Disparador y entrega por evento

El productor/función exacto, disponibilidad, dependencias, autoridad y excepciones se consultan en la ficha JSON enlazada en §8.2. Un punto funcional existente sigue pendiente de instrumentación: ningún evento se presenta como capturado hoy. Stream tiene objetivo ≤60 s; batch ordinario, 15 min; reconciliación es diaria. No hay elección técnica sin una razón operativa.

| Evento | Disparador | Entrega y justificación |
| --- | --- | --- |
| `inbound_order_created` | Después de confirmar la transacción de AssetEntry; el evento se guarda en outbox dentro de esa misma transacción. | stream — Conocer entradas confirmadas en ≤60 s permite actualizar abastecimiento y rearmar alertas sin esperar al informe diario. |
| `outbound_order_created` | Después de confirmar AssetExit, con stock validado bajo bloqueo del activo. | stream — El consumo confirmado alimenta reposición y detección de escasez en ≤60 s. |
| `stock_threshold_triggered` | Una salida confirmada cumple stock_before >= threshold y stock_after < threshold; solo una vez por entrada en estado bajo. | stream — Operaciones debe reponer antes del siguiente consumo; disponibilidad ≤60 s. |
| `direct_stock_edit_rejected` | Una escritura a una ruta de inventario fue rechazada y contiene una clave explícita de stock reconocida; un 404/405/422 aislado no demuestra el intento. | stream — Un bypass intentado exige revisión de seguridad o asistencia en ≤60 s. |
| `kit_cost_variance_detected` | Entrada confirmada con al menos 3 antecedentes comparables en 90 días y abs(variación) > 10, calculada sin redondear. | stream — Alertar en ≤60 s permite revisar una compra anómala antes de repetirla. |
| `product_created` | Asset confirmado tras POST /inventory/products. | batch — La revisión de altas se realiza por lote cada 15 min. |
| `inventory_validation_failed` | Validación fallida al enviar o salir de un campo modificado; no registrar cada pulsación. | batch — La corrección de formularios se prioriza por tendencia; lote de 15 min. |
| `outbound_order_rejected` | Backend rechaza una salida por stock insuficiente o producto inexistente. | stream — Demanda bloqueada requiere respuesta de operaciones en ≤60 s. |
| `stock_recovered` | Entrada confirmada pasa de stock_before < threshold a stock_after >= threshold. | stream — Permite cerrar el episodio de escasez y retirar acciones pendientes en ≤60 s. |
| `stock_depleted` | Salida confirmada pasa de stock_before > 0 a stock_after = 0. | stream — El siguiente pedido no podrá servirse; disponibilidad ≤60 s. |
| `inventory_metadata_missing` | Falta un dato de enriquecimiento o referencia al preparar un evento obligatorio; no emitir un obligatorio incompleto. | stream — Detectar pérdida de cobertura en ≤60 s evita informes silenciosamente incompletos. |
| `login_succeeded` | Credenciales verificadas y token emitido; no por GET /auth/me. | batch — El volumen de acceso se revisa por tendencia; lote de 15 min. |
| `login_failed` | POST /auth/login termina en rechazo comprobado. | stream — Un aumento puede indicar abuso; detectar y revisar en ≤60 s. |
| `session_expired` | Servidor confirma firma válida y exp vencido; no inferir solo desde 401. | stream — Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| `session_invalidated` | Token verificable falla contra estado vigente: huella de contraseña, cuenta inactiva o eliminada. | stream — Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| `session_logged_out` | Acción explícita de cerrar sesión elimina el token local. | batch — Sirve para análisis de uso; lote de 15 min. |
| `access_rejected` | Dependencia de autenticación/autorización rechaza acceso. | stream — Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| `rate_limit_triggered` | enforce_rate_limit rechaza una operación. | stream — Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| `account_created` | POST /users confirma alta. | batch — Revisión de incorporación por lote de 15 min. |
| `account_updated` | PUT /users/{id} confirma una modificación. | stream — Los cambios de privilegios necesitan revisión rápida en ≤60 s. |
| `account_deleted` | DELETE /users/{id} confirma borrado. | stream — Las bajas afectan accesos de inmediato; detectar inconsistencias en ≤60 s. |
| `profile_updated` | PUT /profiles/me confirma actualización. | batch — Mejora del perfil por tendencia; lote de 15 min. |
| `password_reset_requested` | Endpoint acepta solicitud sin revelar si la cuenta existe. | batch — La carga de soporte se revisa por lote; abuso queda en rate_limit_triggered. |
| `password_reset_completed` | Token de reset válido y cambio de hash confirmado. | batch — La eficacia del flujo se revisa en lotes de 15 min. |
| `password_change_completed` | Cambio de hash confirmado y token nuevo emitido. | batch — Análisis del recorrido por lote de 15 min. |
| `password_operation_failed` | Operación rechazada por causa normalizada. | stream — Repetición de fallos puede indicar abuso o bloqueo; revisión en ≤60 s. |
| `notification_delivery_completed` | mailer.py obtiene resultado de envío; nunca interpretar aceptación como lectura. | stream — Un fallo deja al usuario sin recuperación; detección en ≤60 s. |
| `page_viewed` | Ruta canónica visible tras navegación efectiva, una vez por page_view_id. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `navigation_failed` | Error del router o del límite de carga impide mostrar destino. | stream — La sección queda inaccesible; detección operativa en ≤60 s. |
| `search_completed` | Búsqueda estabilizada termina y presenta resultados. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `filter_applied` | Conjunto estabilizado de filtros produce una vista. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `flow_started` | Primera interacción que modifica un campo o inicia una acción; abrir el formulario no basta. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `flow_step_completed` | Validación del paso pasa y el usuario avanza. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `flow_submitted` | Cliente supera validación y comienza solicitud o finalización local simulada. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `flow_completed` | Cliente presenta éxito tras respuesta válida, o validación local del formulario público. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `flow_cancelled` | Usuario pulsa cancelar o reiniciar después de iniciar. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `flow_abandonment_detected` | Worker observa 30 min sin progreso, éxito ni cancelación; resultado provisional. | batch — Análisis de proceso, sin acción inmediata; lote de 15 min tras vencer los 30 min. |
| `api_request_completed` | Finaliza la respuesta de API o su handler de fallo; incluye 5xx con medición final. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `client_request_completed` | Fetch de dominio termina, falla o es abortado. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `page_performance_recorded` | Se obtiene métrica de página medida; ausencias por incompatibilidad no se sustituyen por cero. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `cache_lookup_completed` | Se cierra ventana de 60 s con consultas de caché. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `cache_invalidated` | Escritura confirmada solicita invalidación por tag. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `database_operation_completed` | Ventana de 60 s de operaciones ORM cierra. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `dependency_request_completed` | Llamada a tercero termina con respuesta, timeout o error. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `frontend_error_captured` | Error boundary, window.error o unhandledrejection produce una representación segura. | stream — Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| `backend_error_captured` | Handler global captura excepción y devuelve respuesta segura. | stream — Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| `request_validation_failed` | RequestValidationError o equivalente rechaza entrada antes de ejecutar negocio. | stream — Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| `candidate_created` | createCandidate recibe respuesta válida con identidad externa. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `candidate_updated` | updateCandidate confirma actualización observada. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `candidate_status_changed` | updateCandidateStatusStage confirma cambio efectivo de status. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `candidate_stage_changed` | Respuesta válida confirma cambio efectivo de stage. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `candidate_note_created` | addCandidateNote devuelve confirmación válida. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `candidate_note_deleted` | deleteCandidateNote confirma borrado observado. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `supplier_created` | POST /suppliers confirma persistencia TinyDB. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `supplier_rate_changed` | PATCH /suppliers/{id}/rate confirma un valor diferente. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `supplier_status_changed` | PATCH /suppliers/{id}/status confirma cambio. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `supplier_deleted` | DELETE /suppliers confirma borrado. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `incident_created` | Commit del POST /api/incidents en incident-manager-api. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `incident_status_changed` | Commit de una transición válida de estado. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `incident_analysis_completed` | POST /api/incidents/analyze termina con resumen agregado. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `talent_form_validated` | TalentForm valida todos los campos y muestra éxito local. | batch — La decisión se toma por tendencia o revisión de proceso; basta disponibilidad en lotes de 15 min. |
| `telemetry_batch_processed` | Finaliza procesamiento de un lote seguro. | stream — Un fallo de ingesta afecta todos los informes; detectar en ≤60 s. |
| `telemetry_event_rejected` | Validador rechaza un evento; genera solo diagnóstico seguro. | stream — Permite investigar o actuar ante fallos/bloqueos con disponibilidad objetivo de 60 s. |
| `telemetry_delivery_failed` | Falla intento de entrega al canal. | stream — Detectar en ≤60 s evita pérdidas por agotamiento de retención. |
| `telemetry_queue_observed` | Worker obtiene estado de cola cada 60 s. | stream — Antigüedad creciente exige intervención antes de perder frescura. |
| `telemetry_reconciliation_completed` | Termina reconciliación diaria por tipo de orden y ventana. | batch — El control diario detecta pérdidas históricas; disponibilidad al terminar la ejecución, sin necesidad de stream. |

### 8.4. Allowlist específica de cada evento

La allowlist completa es la unión de **source, environment, actor_type, authority, key_version** (comunes de §3, obligatorias) y la fila específica de abajo; ninguna otra clave se admite. Notación: nombre:tipo es obligatorio; nombre?:tipo es opcional; /null admite null sin permitir omitir la clave; array<T> tiene elementos de tipo T. uuid/date-time son strings con formato. Constantes, enums, límites, unidades, descripción y sensibilidad están en properties de la definición JSON correspondiente. Las condiciones de identidad/fuente/oficina–moneda también son parte del contrato.

| Evento | Propiedades específicas permitidas (nombre:tipo) |
| --- | --- |
| `inbound_order_created` | office:string; product_id:integer; product_category:string; programme_id:string; quantity:integer; currency:string; order_id:integer; order_type:string; asset_office:string; supplier_id:string; unit_cost_minor:integer; total_cost_minor:integer |
| `outbound_order_created` | office:string; product_id:integer; product_category:string; programme_id:string; quantity:integer; currency:string; order_id:integer; order_type:string; asset_office:string; exit_type:string |
| `stock_threshold_triggered` | office:string; product_id:integer; product_category:string; programme_id:string; quantity:integer; currency:string; stock_before:integer; stock_after:integer; threshold:integer; threshold_version:integer; order_id:integer; order_type:string |
| `direct_stock_edit_rejected` | office:string/null; product_id:integer/null; product_category:string/null; programme_id:string/null; quantity:integer; currency:string/null; method:string; route_template:string; forbidden_field:string; reason_code:string; resolution_reason:string; attempted_stock?:integer |
| `kit_cost_variance_detected` | office:string; product_id:integer; product_category:string; programme_id:string; quantity:integer; currency:string; order_id:integer; order_type:string; asset_office:string; supplier_id:string; unit_cost_minor:integer; baseline_total_cost_minor:integer; baseline_total_quantity:integer; baseline_order_count:integer; window_days:integer; threshold_percent:number; variance_percent:number; baseline_cutoff_at:date-time |
| `product_created` | office:string; product_id:integer; product_category:string; programme_id:string; quantity:integer; currency:string |
| `inventory_validation_failed` | product_id:integer/null; order_type:string; stage:string; field_codes:array<string>; reason_code:string; office:string/null; product_category:string/null; programme_id:string/null; quantity:integer; currency:string/null |
| `outbound_order_rejected` | product_id:integer/null; requested_quantity:integer; available_quantity:integer/null; reason_code:string; office:string/null; product_category:string/null; programme_id:string/null; quantity:integer; currency:string/null |
| `stock_recovered` | office:string; product_id:integer; product_category:string; programme_id:string; quantity:integer; currency:string; stock_before:integer; stock_after:integer; threshold:integer; threshold_version:integer; order_id:integer; order_type:string |
| `stock_depleted` | office:string; product_id:integer; product_category:string; programme_id:string; quantity:integer; currency:string; stock_before:integer; stock_after:integer; threshold:integer; threshold_version:integer; order_id:integer; order_type:string |
| `inventory_metadata_missing` | product_id:integer/null; order_id:integer/null; order_type:string/null; missing_fields:array<string>; reason_code:string; affected_event:string; office:string/null; product_category:string/null; programme_id:string/null; quantity:integer; currency:string/null |
| `login_succeeded` | app:string; route_template:string; duration_ms:number |
| `login_failed` | app:string; route_template:string; duration_ms:number; reason_code:string |
| `session_expired` | route_template:string; reason_code:string; session_age_seconds?:integer |
| `session_invalidated` | route_template:string; reason_code:string |
| `session_logged_out` | app:string; reason_code:string |
| `access_rejected` | route_template:string; method:string; status_code:integer; reason_code:string |
| `rate_limit_triggered` | operation:string; window_seconds:integer; limit:integer |
| `account_created` | subject_id:string; role:string |
| `account_updated` | subject_id:string; changed_fields:array<string>; role_changed:boolean; active_changed:boolean |
| `account_deleted` | subject_id:string |
| `profile_updated` | changed_fields:array<string> |
| `password_reset_requested` | operation:string; accepted:boolean |
| `password_reset_completed` | operation:string |
| `password_change_completed` | operation:string |
| `password_operation_failed` | operation:string; reason_code:string |
| `notification_delivery_completed` | notification_type:string; provider:string; outcome:string; duration_ms:number |
| `page_viewed` | page_view_id:uuid; route_template:string; ui_language:string |
| `navigation_failed` | page_view_id:uuid; route_template:string; reason_code:string |
| `search_completed` | route_template:string; query_length_bucket:string; result_count:integer; duration_ms:number; search_id:uuid |
| `filter_applied` | route_template:string; filter_keys:array<string>; result_count:integer; filter_id:uuid |
| `flow_started` | flow_id:uuid; flow_type:string; route_template:string |
| `flow_step_completed` | flow_id:uuid; flow_type:string; route_template:string; step_index:integer; duration_ms:number |
| `flow_submitted` | flow_id:uuid; flow_type:string; route_template:string; attempt_id:uuid; submission_mode:string |
| `flow_completed` | flow_id:uuid; flow_type:string; route_template:string; attempt_id:uuid; completion_mode:string; duration_ms:number |
| `flow_cancelled` | flow_id:uuid; flow_type:string; route_template:string; last_step:integer; reason_code:string |
| `flow_abandonment_detected` | flow_id:uuid; flow_type:string; route_template:string; last_step:integer; last_activity_at:date-time; inactivity_seconds:integer; provisional:boolean |
| `api_request_completed` | route_template:string; method:string; status_code:integer; duration_ms:number; cache_state:string |
| `client_request_completed` | route_template:string; method:string; status_code:integer; duration_ms:number; outcome:string; dependency:string |
| `page_performance_recorded` | page_view_id:uuid; route_template:string; metric:string; value:number; navigation_type:string; measurement_origin:string |
| `cache_lookup_completed` | window_start:date-time; window_seconds:integer; sample_count:integer; duration_sum_ms:number; duration_histogram:array<integer>; cache_name:string; hit_count:integer; miss_count:integer |
| `cache_invalidated` | cache_name:string; cause:string; evicted_count:integer |
| `database_operation_completed` | window_start:date-time; window_seconds:integer; sample_count:integer; duration_sum_ms:number; duration_histogram:array<integer>; operation_name:string; error_count:integer |
| `dependency_request_completed` | dependency:string; operation:string; outcome:string; duration_ms:number |
| `frontend_error_captured` | route_template:string; error_code:string; fingerprint:string; first_seen_at:date-time; last_seen_at:date-time; occurrence_count:integer; sanitizer_version:string |
| `backend_error_captured` | route_template:string; error_code:string; fingerprint:string; first_seen_at:date-time; last_seen_at:date-time; occurrence_count:integer; sanitizer_version:string |
| `request_validation_failed` | route_template:string; method:string; field_codes:array<string>; reason_codes:array<string>; error_count:integer |
| `candidate_created` | candidate_id:string |
| `candidate_updated` | candidate_id:string; changed_fields:array<string> |
| `candidate_status_changed` | candidate_id:string; from_status:string; to_status:string |
| `candidate_stage_changed` | candidate_id:string; from_stage:string; to_stage:string |
| `candidate_note_created` | candidate_id:string; note_id:string |
| `candidate_note_deleted` | candidate_id:string; note_id:string |
| `supplier_created` | supplier_id:string; country:string; currency:string; monthly_rate_minor:integer |
| `supplier_rate_changed` | supplier_id:string; country:string; currency:string; old_monthly_rate_minor:integer; new_monthly_rate_minor:integer |
| `supplier_status_changed` | supplier_id:string; country:string; currency:string; from_status:string; to_status:string |
| `supplier_deleted` | supplier_id:string; country:string; currency:string |
| `incident_created` | incident_id:integer; branch:string; origin:string; incident_category:string |
| `incident_status_changed` | incident_id:integer; branch:string; origin:string; incident_category:string; from_status:string; to_status:string |
| `incident_analysis_completed` | analysis_id:uuid; total_rows:integer; valid_rows:integer; invalid_rows:integer; duration_ms:number |
| `talent_form_validated` | flow_id:uuid; form_version:string; step_count:integer; persistence_mode:string |
| `telemetry_batch_processed` | batch_id:uuid; received_count:integer; accepted_count:integer; rejected_count:integer; duplicate_count:integer; duration_ms:number |
| `telemetry_event_rejected` | rejected_event_type:string; reason_code:string; rejected_count:integer |
| `telemetry_delivery_failed` | batch_id:uuid; attempt:integer; pending_count:integer; reason_code:string |
| `telemetry_queue_observed` | queue_name:string; pending_count:integer; oldest_age_seconds:integer; dead_letter_count:integer |
| `telemetry_reconciliation_completed` | window_start:date-time; window_end:date-time; order_type:string; persisted_count:integer; event_count:integer; missing_count:integer; orphan_count:integer |

### 8.5. Implementación, privacidad y aceptación sin repetición

Para instrumentar cualquier fila: abrir su definición JSON de §8.2; usar x-telemetry.producer y trigger; resolver availability/dependencies; construir únicamente las propiedades declaradas; aplicar semanticRules y privacy antes de emitir; seguir frequency/deduplication/delivery. Los campos x-sensitivity identifican seudónimos o datos comerciales por propiedad. La aceptación común exige una emisión por disparador válido, ninguna sin disparador, ejemplo válido y rechazo de claves extra, versiones o required ausentes; §7.2 añade casos de integración futuros. El verificador comprueba que esos apartados no desaparecen de ninguna de las 66 fichas.

Excepciones que el implementador debe respetar:

- Seguridad: login fallido no identifica cuenta; 401 requiere causa comprobada; logout local no revoca JWT; limitador actual no se comparte entre workers.
- Candidatos/notas: respuesta de Tracker observada en cliente, con IDs seudonimizados por puente servidor futuro; sin contenido personal ni auditoría transaccional garantizada.
- Incidencias: categorías y transiciones exactas de incident_constants; servicio actual sin autenticación, userId=null. Formulario público: solo validación local simulada, sin candidato persistido.
- Navegación: alias/render no duplican vistas; búsquedas no guardan texto; cancelación explícita se separa de abandono provisional y finalizaciones tardías.
- Rendimiento/errores: ventanas, unidades e histogramas de §5; no sumar cliente/servidor como solicitudes distintas ni importar logs/SQL/trazas crudos.
- Inventario: stock transaccional por activo, snapshots de metadatos y costos; sin enriquecimiento válido conservar referencia y medir cobertura, sin inventar dimensiones.
- Pipeline: ingesta fuera de sus propios eventos HTTP, rechazos seguros sin payload, diagnóstico fuera de banda ante fallo de autoobservación.

## 9. Entrega y resultado de revisión

El diseño inicial se creó en feature/telemetry-design-plan y quedó integrado mediante PR #28. Esta revisión se entrega en feature/telemetry-plan-compact, desde main actualizada. Entrega principal: telemetry-plan.md y event-schemas.json. Soporte reproducible: scripts/validate-telemetry.cjs, registro de pruebas y memoria. No se modifican interfaces, API, dependencias ni datos.

Entrega inicial: commit 43c39a3 y [PR #28: docs: telemetry design plan](https://github.com/AlbertoBeCi/nexovaSolutions/pull/28). Esta revisión editorial conserva los contratos y todos los requisitos aprobados.

Descripción del PR: 66 eventos (5 obligatorios/61 oportunidades), siete categorías (inventario, autenticación/cuentas, navegación/flujos, rendimiento, errores, otros procesos de negocio y operación de telemetría), resultado del verificador y decisión más difícil: adaptar el inventario existente al briefing sin inventar datos ni perder trazabilidad. Merge solo tras aprobación del PR y comprobaciones requeridas satisfechas; no afirmar despliegue de instrumentación con este cambio documental.

### Resultado de validación de esta entrega

Revisión del 26/10/2026: PASS con 6.774 comprobaciones de diseño/contrato; 66 contratos/fichas, 5 obligatorios, 61 oportunidades y siete categorías. El JSON conserva exactamente los mismos bytes que la entrega aprobada; contratos, ejemplos y metadata no se han reducido. Las pruebas positivas/negativas de contrato se mantienen; se sustituyen comparaciones de texto duplicado por comprobaciones del catálogo compacto, referencias y allowlists tipadas. Además, cinco alteraciones en memoria (hipótesis, tipo, disparador, referencia y omisión de evento) fueron rechazadas por el verificador. Sin acceso a DB/red ni instrumentación.
