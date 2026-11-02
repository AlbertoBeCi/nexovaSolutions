/** Best-effort in-memory telemetry. track() is the only event capture API. */
import { apiRequest, genericTranslateIssue } from "../lib/api-client";
import { getToken, subscribeToken } from "../lib/auth-storage";
import { currentRequestId, endTelemetrySession, isUuid, telemetrySessionId, uuid } from "./telemetry-context";
import contract from "./telemetry-contract.json";

type Rule = { type?: string; const?: unknown; enum?: unknown[]; anyOf?: Rule[]; format?: string; pattern?: string; minimum?: number; maximum?: number; minLength?: number; maxLength?: number; minItems?: number; maxItems?: number; uniqueItems?: boolean; items?: Rule };
const specs = contract.events as Record<string, { required: string[]; properties: Record<string, Rule> }>;
const ENDPOINT = process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT;
const SCHEMA_VERSION = contract.schemaVersion;
const COMMON = ["source", "environment", "actor_type", "authority", "key_version"];
const MAX_EVENT = 16 * 1024;
const MAX_QUEUE = 1024 * 1024;
const BEACON_LIMIT = 48 * 1024;

interface TelemetryEvent {
  eventId: string; timestamp: string; sessionId: string | null; userId: string | null;
  event_type: string; schemaVersion: string; requestId: string; properties: Record<string, unknown>;
}
interface Item { event: TelemetryEvent; bytes: number; capturedAt: number }
const queue: Item[] = [];
let active: Item[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let unsubscribe: (() => void) | undefined;
let userId: string | null = null;
let identityGeneration = 0;
let identityPromise: Promise<void> = Promise.resolve();
let dropped = 0;

function valid(value: unknown, rule: Rule): boolean {
  if (rule.anyOf) return rule.anyOf.some((part) => valid(value, part));
  if ("const" in rule && value !== rule.const) return false;
  if (rule.enum && !rule.enum.includes(value)) return false;
  if (rule.type === "null") return value === null;
  if (rule.type === "integer" && !Number.isSafeInteger(value)) return false;
  if (rule.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) return false;
  if ((rule.type === "number" || rule.type === "integer") && typeof value === "number") {
    if (rule.minimum !== undefined && value < rule.minimum || rule.maximum !== undefined && value > rule.maximum) return false;
  }
  if (rule.type === "string") {
    if (typeof value !== "string") return false;
    if (rule.minLength !== undefined && value.length < rule.minLength || rule.maxLength !== undefined && value.length > rule.maxLength) return false;
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) return false;
    if (rule.format === "uuid" && !isUuid(value)) return false;
    if (rule.format === "date-time" && (!value.endsWith("Z") || !Number.isFinite(Date.parse(value)))) return false;
    if (rule.format === "route" && !contract.routes.includes(value)) return false;
  }
  if (rule.type === "array") {
    if (!Array.isArray(value)) return false;
    if (rule.minItems !== undefined && value.length < rule.minItems || rule.maxItems !== undefined && value.length > rule.maxItems) return false;
    if (rule.uniqueItems && new Set(value).size !== value.length) return false;
    if (rule.items && !value.every((item) => valid(item, rule.items!))) return false;
  }
  return true;
}

function payloadAllowed(type: string, properties: Record<string, unknown>): boolean {
  const spec = specs[type];
  if (!Object.hasOwn(specs, type) || !spec || spec.required.some((key) => !Object.hasOwn(properties, key))) return false;
  if (!Object.keys(properties).every((key) => !COMMON.includes(key) && Object.hasOwn(spec.properties, key) && valid(properties[key], spec.properties[key]))) return false;
  if (properties.programme_id !== undefined && properties.programme_id !== null) return false; // no approved programme registry yet
  if ("office" in properties && "currency" in properties) {
    const currency = properties.office === "valencia" ? "EUR" : properties.office === "miami" ? "USD" : null;
    if (properties.currency !== currency) return false;
  }
  return true;
}

function byteLength(value: unknown): number { return new Blob([JSON.stringify(value)]).size; }
function clearTimer(): void { if (timer !== undefined) clearTimeout(timer); timer = undefined; }
function schedule(): void {
  if (!running || !queue.length || timer !== undefined) return;
  timer = setTimeout(() => { timer = undefined; void flush(); }, Math.max(0, queue[0].capturedAt + 10000 - Date.now()));
}

function enqueue(item: Item): void {
  const size = () => [...queue, ...active].reduce((n, entry) => n + entry.bytes, 0);
  while (queue.length + active.length >= 500 || size() + item.bytes > MAX_QUEUE) {
    if (!queue.length) { dropped++; return; }
    const lowPriority = queue.findIndex((entry) => ["page_viewed", "filter_applied", "page_performance_recorded", "client_request_completed"].includes(entry.event.event_type));
    if (lowPriority < 0 && queue.every((entry) => ["frontend_error_captured", "session_logged_out"].includes(entry.event.event_type)) && !["frontend_error_captured", "session_logged_out"].includes(item.event.event_type)) { dropped++; return; }
    queue.splice(lowPriority >= 0 ? lowPriority : 0, 1);
    dropped++;
  }
  queue.push(item);
  schedule();
}

export function track(eventType: string, properties: Record<string, unknown>): void {
  try {
    if (typeof window === "undefined" || !ENDPOINT || !running || !payloadAllowed(eventType, properties)) return;
    const capturedAt = Date.now();
    const event: TelemetryEvent = {
      eventId: uuid(), timestamp: new Date(capturedAt).toISOString(),
      sessionId: telemetrySessionId(), userId, event_type: eventType, schemaVersion: SCHEMA_VERSION,
      requestId: currentRequestId(),
      properties: { ...JSON.parse(JSON.stringify(properties)), source: "backoffice", environment: process.env.NODE_ENV === "test" ? "test" : process.env.NODE_ENV === "production" ? "production" : "development", actor_type: userId ? "user" : "anonymous", authority: "client_observed", key_version: userId ? "p1" : null },
    };
    const bytes = byteLength(event);
    if (bytes > MAX_EVENT) { dropped++; return; }
    enqueue({ event, bytes, capturedAt });
    if (queue.length >= 20) void flush();
  } catch { /* telemetry must never affect a business action */ }
}

async function send(batch: Item[]): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(ENDPOINT!, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", signal: controller.signal, body: JSON.stringify({ events: batch.map((item) => item.event) }) });
    if (!response.ok) throw new Error("delivery_failed");
  } finally { clearTimeout(timeout); }
}

async function flush(): Promise<void> {
  if (active.length || !queue.length || !ENDPOINT) return;
  clearTimer();
  active = queue.splice(0, 20);
  const batch = active;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await send(batch); return; } catch {
        if (attempt === 2) { dropped += batch.length; return; }
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  } catch { dropped += batch.length; } finally {
    active = [];
    if (running && (queue.length >= 20 || queue.length && queue[0].capturedAt + 10000 <= Date.now())) void flush();
    else schedule();
  }
}

function flushClosing(): void {
  try {
    if (!ENDPOINT) return;
    clearTimer();
    while (queue.length) {
      const batch: Item[] = [];
      while (queue.length && batch.length < 20 && byteLength({ events: [...batch, queue[0]].map((item) => item.event) }) <= BEACON_LIMIT) batch.push(queue.shift()!);
      if (!batch.length) { queue.shift(); dropped++; continue; }
      const body = new Blob([JSON.stringify({ events: batch.map((item) => item.event) })], { type: "application/json" });
      let accepted = false;
      try { accepted = !!navigator.sendBeacon?.(ENDPOINT, body); } catch { /* use keepalive */ }
      if (!accepted) {
        const restore = () => { for (const item of batch) enqueue(item); };
        try {
          void fetch(ENDPOINT, { method: "POST", body, keepalive: true, credentials: "omit" }).then((response) => { if (!response.ok) restore(); }).catch(restore);
        } catch { restore(); break; }
      }
    }
  } catch { /* unload is best effort */ }
}
function visibility(): void { if (document.visibilityState === "hidden") flushClosing(); }

function refreshIdentity(): void {
  const generation = ++identityGeneration;
  userId = null;
  if (!getToken()) { endTelemetrySession(); return; }
  identityPromise = (async () => {
    try {
      const response = await apiRequest("/telemetry/context", { method: "GET" }, "", genericTranslateIssue, { redirectOnUnauthorized: false });
      const context = await response.json();
      if (generation === identityGeneration && context.schemaVersion === SCHEMA_VERSION && context.keyVersion === "p1" && /^p1_[a-f0-9]{64}$/.test(context.userId)) userId = context.userId;
    } catch { /* no verified identity: anonymous */ }
  })();
}

export function startTelemetry(): void {
  try {
    if (running || !ENDPOINT || typeof window === "undefined") return;
    running = true;
    telemetrySessionId();
    unsubscribe = subscribeToken(refreshIdentity);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", flushClosing);
    refreshIdentity();
    schedule();
  } catch { /* optional capability */ }
}
export function stopTelemetry(): void {
  try {
    unsubscribe?.(); unsubscribe = undefined;
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", flushClosing);
    clearTimer(); running = false; identityGeneration++; userId = null;
  } catch { /* SSR or teardown */ }
}
export function telemetryIdentityReady(): Promise<void> { return identityPromise; }
export function telemetryDiagnostics(): { queued: number; dropped: number } { return { queued: queue.length + active.length, dropped }; }
