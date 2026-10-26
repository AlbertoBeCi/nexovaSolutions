"use strict";
// Valida artefactos de diseño; sin red, DB ni instrumentación de aplicación.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const repo = path.resolve(__dirname, "..");
const localRequire = createRequire(path.join(repo, "uis/backoffice/package.json"));
let Ajv;
try { Ajv = localRequire("ajv"); } catch {
  console.error("Falta Ajv del tooling de uis/backoffice. Instala las dependencias existentes de esa app; no se instala nada automáticamente.");
  process.exit(1);
}
const schemaPath = path.join(repo, "docs/telemetry/event-schemas.json");
const planPath = path.join(repo, "docs/telemetry/telemetry-plan.md");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const plan = fs.readFileSync(planPath, "utf8").replace(/\r\n/g, "\n");
const expected = ["inbound_order_created","outbound_order_created","stock_threshold_triggered","direct_stock_edit_rejected","kit_cost_variance_detected","product_created","inventory_validation_failed","outbound_order_rejected","stock_recovered","stock_depleted","inventory_metadata_missing","login_succeeded","login_failed","session_expired","session_invalidated","session_logged_out","access_rejected","rate_limit_triggered","account_created","account_updated","account_deleted","profile_updated","password_reset_requested","password_reset_completed","password_change_completed","password_operation_failed","notification_delivery_completed","page_viewed","navigation_failed","search_completed","filter_applied","flow_started","flow_step_completed","flow_submitted","flow_completed","flow_cancelled","flow_abandonment_detected","api_request_completed","client_request_completed","page_performance_recorded","cache_lookup_completed","cache_invalidated","database_operation_completed","dependency_request_completed","frontend_error_captured","backend_error_captured","request_validation_failed","candidate_created","candidate_updated","candidate_status_changed","candidate_stage_changed","candidate_note_created","candidate_note_deleted","supplier_created","supplier_rate_changed","supplier_status_changed","supplier_deleted","incident_created","incident_status_changed","incident_analysis_completed","talent_form_validated","telemetry_batch_processed","telemetry_event_rejected","telemetry_delivery_failed","telemetry_queue_observed","telemetry_reconciliation_completed"];
const mandatory = ["inbound_order_created","outbound_order_created","stock_threshold_triggered","direct_stock_edit_rejected","kit_cost_variance_detected"];
let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }
function equal(actual, expectedValue, message) { checks++; assert.deepEqual(actual, expectedValue, message); }
const clone = value => JSON.parse(JSON.stringify(value));
const sorted = value => [...value].sort();
const bq = String.fromCharCode(96);
const cell = value => String(value).replaceAll("|", "&#124;").replaceAll("\n", " ");
const cleanField = field => Object.fromEntries(Object.entries(field).filter(([key]) => !["description", "examples", "x-required", "x-sensitivity"].includes(key)));
const labels = {"category":"Categoría","classification":"Clasificación","owner":"Responsable","trigger":"Disparador","producer":"Productor / referencia","availability":"Disponibilidad","dependencies":"Dependencias","delivery":"Entrega","urgency":"Urgencia / decisión temporal","frequency":"Frecuencia / control de volumen","deduplication":"Deduplicación","privacy":"PII / saneamiento","acceptance":"Aceptación"};
const ajv = new Ajv({ allErrors: true, format: "full", jsonPointers: true, schemaId: "auto" });
check(ajv.validateSchema(schema), "Metaschema Draft-07 inválido: " + JSON.stringify(ajv.errors));
check(schema.$schema === "http://json-schema.org/draft-07/schema#", "Versión Draft-07");
const validate = ajv.compile(schema);
const refs = schema.oneOf.map(item => item.$ref.replace("#/definitions/", ""));
equal(sorted(refs), sorted(expected), "Referencias exactas de los 66 eventos");
check(new Set(refs).size === 66, "No hay eventos duplicados");
const namesInMarkdown = [...plan.matchAll(/^### ([a-z][a-z0-9_]+)$/gm)].map(match => match[1]);
equal(sorted(namesInMarkdown), sorted(expected), "66 fichas Markdown exactas");
equal(sorted(expected.filter(name => schema.definitions[name]["x-telemetry"].classification === "obligatorio")), sorted(mandatory), "Cinco obligatorios exactos");
check(new Set(expected.map(name => schema.definitions[name]["x-telemetry"].category)).size === 7, "Siete categorías");
check(expected.filter(name => schema.definitions[name]["x-telemetry"].classification === "oportunidad_identificada").length === 61, "61 oportunidades");
const envelope = ["eventId","timestamp","sessionId","userId","event_type","schemaVersion","requestId","properties"];
function closedObjects(node, location) {
  if (!node || typeof node !== "object") return;
  if (node.type === "object") check(node.additionalProperties === false, "Objeto cerrado: " + location);
  if (node.type === "array") check(Boolean(node.items), "Array tipado: " + location);
  for (const [key, value] of Object.entries(node)) {
    if (key === "examples") continue;
    if (Array.isArray(value)) value.forEach((item, index) => closedObjects(item, location + "/" + key + "/" + index));
    else if (value && typeof value === "object") closedObjects(value, location + "/" + key);
  }
}
closedObjects(schema, "schema");
function rejects(sample, message) { check(!validate(sample), "Debe rechazar: " + message); }
for (const name of expected) {
  const def = schema.definitions[name];
  const meta = def["x-telemetry"];
  const payload = def.properties.properties;
  const example = def.examples[0];
  const start = plan.indexOf("### " + name + "\n");
  let end = plan.indexOf("\n<a id=", start + 1);
  if (end === -1) end = plan.indexOf("\n## 9.", start);
  const section = plan.slice(start, end === -1 ? undefined : end);
  equal(sorted(def.required), sorted(envelope), name + ": ocho required de envelope");
  equal(sorted(Object.keys(def.properties)), sorted(envelope), name + ": ocho campos exactos");
  check(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(name), name + ": taxonomía");
  check(def.properties.event_type.const === name, name + ": discriminador");
  check(def.properties.schemaVersion.const === "1.0.0", name + ": versión");
  check(["stream", "batch"].includes(meta.delivery), name + ": entrega");
  for (const [key, label] of Object.entries(labels)) {
    check(typeof meta[key] === "string" && meta[key].length > 0, name + ": metadata " + key);
    check(section.includes("| " + label + " | " + cell(meta[key]) + " |"), name + ": metadata Markdown " + key);
  }
  check(section.includes("Capturamos " + bq + name + bq + " porque necesitamos saber " + meta.hypothesis + ", lo que nos permite tomar la decisión de " + meta.decision + "."), name + ": justificación exacta");
  if (meta.semanticRules.length) check(section.includes(meta.semanticRules.map(cell).join(" ")), name + ": reglas semánticas");
  const rows = section.split("\n").filter(line => line.startsWith("| " + bq));
  const parsedNames = [];
  for (const row of rows) {
    const columns = row.split("|").slice(1, -1).map(value => value.trim());
    check(columns.length === 5, name + ": cinco columnas del diccionario");
    const key = columns[0].slice(1, -1);
    parsedNames.push(key);
    const field = payload.properties[key];
    check(Boolean(field), name + ": campo Markdown existe " + key);
    equal(columns[1], payload.required.includes(key) ? "Sí" : "No", name + ": obligatoriedad " + key);
    equal(columns[2], field["x-sensitivity"], name + ": sensibilidad " + key);
    equal(columns[3], cell(field.description), name + ": descripción/unidad " + key);
    const contract = JSON.parse(columns[4].slice(1,-1).replaceAll("&#124;", "|"));
    equal(contract, cleanField(field), name + ": contrato " + key);
  }
  equal(sorted(parsedNames), sorted(Object.keys(payload.properties)), name + ": allowlist completa");
  const block = section.match(/~~~json\n([\s\S]*?)\n~~~/);
  check(Boolean(block), name + ": ejemplo Markdown");
  equal(JSON.parse(block[1]), example, name + ": mismo ejemplo MD/JSON");
  check(validate(example), name + ": ejemplo válido");
  const minimum = clone(example);
  for (const key of Object.keys(minimum.properties)) if (!payload.required.includes(key)) delete minimum.properties[key];
  check(validate(minimum), name + ": campos opcionales omitibles");
  for (const key of envelope) { const bad = clone(example); delete bad[key]; rejects(bad, name + " sin " + key); }
  for (const key of payload.required) { const bad = clone(example); delete bad.properties[key]; rejects(bad, name + " sin properties." + key); }
  for (const target of ["envelope","payload"]) { const bad=clone(example); (target==="envelope"?bad:bad.properties).email="synthetic@example.invalid"; rejects(bad,name + ": PII extra en " + target); }
  const wrongVersion=clone(example); wrongVersion.schemaVersion="2.0.0"; rejects(wrongVersion,name+": versión no soportada");
  const wrongId=clone(example); wrongId.eventId="not-a-uuid"; rejects(wrongId,name+": UUID inválido");
  for (const timestamp of ["2026-02-30T10:00:00Z","2026-10-26","2026-10-26T09:00:00+00:00"]) { const bad=clone(example); bad.timestamp=timestamp; rejects(bad,name+": fecha/formato UTC inválido"); }
  const wrongType=clone(example); wrongType.properties.environment=7; rejects(wrongType,name+": tipo inválido");
  const wrongAuthority=clone(example); wrongAuthority.properties.authority=example.properties.authority==="server"?"client_observed":"server"; rejects(wrongAuthority,name+": autoridad/origen");
  if (name === "incident_created" || name === "incident_status_changed" || name === "login_failed") { const bad=clone(example); bad.properties.actor_type="user"; bad.userId="p1_"+"a".repeat(64); bad.properties.key_version="p1"; rejects(bad,name+": identidad no verificable"); }
  if (example.userId !== null) { const bad=clone(example); bad.userId="synthetic@example.invalid"; rejects(bad,name+": userId personal crudo"); }
  if (payload.properties.office && payload.properties.currency) {
    const pair=clone(example); pair.properties.office="miami"; pair.properties.currency="USD"; check(validate(pair),name+": Miami/USD válido");
    pair.properties.currency="EUR"; rejects(pair,name+": Miami/EUR inválido");
    pair.properties.office="valencia"; pair.properties.currency="USD"; rejects(pair,name+": Valencia/USD inválido");
  }
  if (meta.category === "inventario") for (const key of ["office","product_id","product_category","programme_id","quantity","currency"]) check(payload.required.includes(key), name+": dimensión de inventario " + key);
}
const sample = name => clone(schema.definitions[name].examples[0]);
const unknown=sample("page_viewed"); unknown.event_type="unregistered_action"; rejects(unknown,"tipo desconocido");
const direct=sample("direct_stock_edit_rejected"); check(validate(direct),"rechazo no resoluble conserva claves null");
direct.properties.resolution_reason="resolved"; rejects(direct,"resolved no permite dimensiones null");
const known=sample("inbound_order_created");
Object.assign(direct.properties,Object.fromEntries(["office","product_id","product_category","programme_id","currency"].map(key=>[key,known.properties[key]])));
check(validate(direct),"rechazo con dimensiones resueltas");
for (const name of mandatory.filter(name=>name!=="direct_stock_edit_rejected")) { const bad=sample(name); bad.properties.programme_id=null; rejects(bad,name+": programa obligatorio no null"); }
const invalidCategory=sample("inbound_order_created"); invalidCategory.properties.product_category="hardware"; rejects(invalidCategory,"categoría API no equivale a analítica");
const supplier=sample("supplier_created"); supplier.properties.country="USA"; supplier.properties.currency="EUR"; rejects(supplier,"USA no usa EUR");
// Demostración: forma JSON válida no prueba procedencia ni saneamiento real.
const secretCanary=sample("inbound_order_created"); secretCanary.properties.programme_id="canary-secret-123";
check(validate(secretCanary),"Un slug puede pasar JSON Schema: control semántico imprescindible");
const approvedProgrammes=new Set(["ventas-b2b","liderazgo-basico","soporte-onboarding"]);
check(!approvedProgrammes.has(secretCanary.properties.programme_id),"Registro sintético rechaza canary aunque pase forma");
// Cálculos sintéticos de aceptación, sin implementar emisores ni tocar DB.
const crosses=(before,after,min=6)=>before>=min && after<min;
equal([crosses(6,5),crosses(5,4),crosses(4,6),crosses(6,0)],[true,false,false,true],"Bordes de cruce");
const costVariance=(current,total,quantity,count)=>count>=3 && total>0n && quantity>0n && ((current*quantity-total)<0n ? total-current*quantity : current*quantity-total)*100n>total*10n;
equal([1100n,900n,1101n,899n,0n].map(value=>costVariance(value,30000n,30n,3)),[false,false,true,true,true],"Bordes exactos de costo");
check(!costVariance(1200n,0n,30n,3) && !costVariance(1200n,30000n,30n,2),"Cero/histórico insuficiente no es anomalía");
const duplicate=sample("outbound_order_created"); const repeated=clone(duplicate);
check(new Set([duplicate.eventId,repeated.eventId]).size===1,"Reentrega conserva identidad");
repeated.properties.quantity++; check(repeated.eventId===duplicate.eventId && JSON.stringify(repeated)!==JSON.stringify(duplicate),"Conflicto distinguible; ingreso real pendiente");
const officeDay=(instant,zone)=>new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(instant));
check(officeDay("2026-10-26T00:30:00Z","Europe/Madrid")!==officeDay("2026-10-26T00:30:00Z","America/New_York"),"Días locales distintos para mismo UTC");
const localHour=(instant,zone)=>new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",hourCycle:"h23"}).format(new Date(instant));
equal(localHour("2026-10-25T00:30:00Z","Europe/Madrid"),localHour("2026-10-25T01:30:00Z","Europe/Madrid"),"Hora repetida de otoño de Madrid");
equal(localHour("2026-11-01T05:30:00Z","America/New_York"),localHour("2026-11-01T06:30:00Z","America/New_York"),"Hora repetida de otoño de Miami");
// Contrastar muestras con reglas aritméticas y enums reales, además del metaschema.
for (const name of expected) {
  const def=schema.definitions[name]; const p=def.examples[0].properties;
  for (const [key,field] of Object.entries(def.properties.properties.properties)) equal(field["x-required"]!==false,def.properties.properties.required.includes(key),name+": anotación required coherente "+key);
  for (const source of def.properties.properties.properties.source.enum) {
    const variant=sample(name); variant.properties.source=source;
    variant.properties.authority=source==="telemetry_worker"?"derived":["api","incident_api"].includes(source)?"server":"client_observed";
    check(validate(variant),name+": variante de productor "+source);
  }
  if ("stock_after" in p) { equal(p.quantity,p.stock_after,name+": quantity es saldo restante"); }
  if (name==="stock_threshold_triggered") check(p.stock_before>=p.threshold && p.stock_after<p.threshold && p.order_type==="outbound","Ejemplo de cruce real");
  if (name==="stock_recovered") check(p.stock_before<p.threshold && p.stock_after>=p.threshold && p.order_type==="inbound","Ejemplo de recuperación real");
  if (name==="stock_depleted") check(p.stock_before>0 && p.stock_after===0 && p.order_type==="outbound","Ejemplo de agotamiento real");
  if (name==="inbound_order_created") equal(BigInt(p.total_cost_minor),BigInt(p.quantity)*BigInt(p.unit_cost_minor),"Ejemplo costo total exacto");
  if (name==="kit_cost_variance_detected") { check(costVariance(BigInt(p.unit_cost_minor),BigInt(p.baseline_total_cost_minor),BigInt(p.baseline_total_quantity),p.baseline_order_count),"Ejemplo de anomalía supera umbral"); check(Math.abs(p.variance_percent-100*(p.unit_cost_minor*p.baseline_total_quantity/p.baseline_total_cost_minor-1))<1e-8,"Variación presentada coincide"); }
  if (name==="flow_abandonment_detected") check(Date.parse(def.examples[0].timestamp)-Date.parse(p.last_activity_at)>=1800000,"Ejemplo de abandono espera 30 min");
  if (name==="telemetry_reconciliation_completed") check(Date.parse(p.window_end)>Date.parse(p.window_start),"Ventana de conciliación positiva");
  if (name==="telemetry_batch_processed") equal(p.received_count,p.accepted_count+p.rejected_count+p.duplicate_count,"Contadores disjuntos de lote");
  if (name==="incident_analysis_completed") equal(p.total_rows,p.valid_rows+p.invalid_rows,"Conteo análisis coherente");
  if (p.duration_histogram) equal(p.duration_histogram.reduce((sum,value)=>sum+value,0),p.sample_count,name+": histograma conserva población");
}
const incidentConstants=fs.readFileSync(path.join(repo,"packages/shared/nexova_shared/incident_constants.py"),"utf8");
const categoryTuple=incidentConstants.match(/CATEGORIES:[\s\S]*?=\s*\(([\s\S]*?)\)/);
check(Boolean(categoryTuple),"Leer categorías fuente del gestor");
const incidentCategories=[...categoryTuple[1].matchAll(/"([^"]+)"/g)].map(match=>match[1]);
for (const name of ["incident_created","incident_status_changed"]) equal(schema.definitions[name].properties.properties.properties.incident_category.enum,incidentCategories,name+": categorías exactas del dominio");

const checkRows=[...plan.matchAll(/^\| (\d+)\. /gm)].map(match=>Number(match[1]));
equal(checkRows.filter(value=>value>=1&&value<=23).slice(-23),Array.from({length:23},(_,index)=>index+1),"Matriz de los 23 checks");
console.log("PASS: 66 contratos, 66 fichas, 5 obligatorios, 61 oportunidades, 7 categorías.");
console.log("PASS: " + checks + " comprobaciones de diseño/contrato; sin instrumentación ni acceso a datos.");
