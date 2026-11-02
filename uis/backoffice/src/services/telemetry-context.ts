/** Context only: no event emission or network transport. */
import { getToken } from "../lib/auth-storage";
import contract from "./telemetry-contract.json";

const SESSION_KEY = "nexova_telemetry_session";
const IDLE_MS = 30 * 60 * 1000;
let session: { id: string; lastActivity: number } | null = null;
let requestId: string | null = null;
let authReady = false;
const listeners = new Set<() => void>();

export function uuid(): string {
  try { return globalThis.crypto.randomUUID(); } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const n = Math.floor(Math.random() * 16);
      return (c === "x" ? n : (n & 3) | 8).toString(16);
    });
  }
}

function saveSession(): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* optional storage */ }
}

export function beginTelemetrySession(): void {
  session = { id: uuid(), lastActivity: Date.now() };
  saveSession();
  markTelemetryAuthReady(false);
}

export function endTelemetrySession(): void {
  session = null;
  saveSession();
  markTelemetryAuthReady(false);
}

export function telemetrySessionId(): string | null {
  if (!session && getToken()) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
      if (stored && isUuid(stored.id) && Number.isFinite(stored.lastActivity)) session = stored;
    } catch { /* memory fallback */ }
    if (!session) beginTelemetrySession();
  }
  if (session) {
    if (Date.now() - session.lastActivity >= IDLE_MS) beginTelemetrySession();
    session!.lastActivity = Date.now();
    saveSession();
  }
  return session?.id ?? null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function requestHeaders(id: string): Record<string, string> {
  const sessionId = telemetrySessionId();
  return { "X-Request-ID": id, "X-Nexova-App": "backoffice", ...(sessionId ? { "X-Telemetry-Session-ID": sessionId } : {}) };
}

export function withTelemetryRequest(id: string, run: () => void): void {
  const previous = requestId;
  requestId = isUuid(id) ? id : null;
  try { run(); } finally { requestId = previous; }
}

export function currentRequestId(): string { return requestId ?? uuid(); }

export function normalizeRoute(path: string): string {
  const raw = path.split(/[?#]/, 1)[0];
  if (contract.routes.includes(raw)) return raw;
  const patterns: [RegExp, string][] = [
    [/^\/candidates\/[^/]+\/edit$/, "/candidates/{id}/edit"],
    [/^\/candidates\/[^/]+$/, "/candidates/{id}"],
    [/^\/inventory\/products\/\d+$/, "/inventory/products/{asset_id}"],
    [/^\/users\/\d+$/, "/users/{id}"],
    [/^\/suppliers\/\d+\/(rate|status)$/, "/suppliers/{id}/$1"],
    [/^\/suppliers\/\d+$/, "/suppliers/{id}"],
  ];
  for (const [pattern, template] of patterns) if (pattern.test(raw)) return raw.replace(pattern, template);
  return "unmatched";
}

export function markTelemetryAuthReady(ready = true): void {
  if (authReady === ready) return;
  authReady = ready;
  for (const listener of listeners) { try { listener(); } catch { /* observer isolation */ } }
}
export function subscribeTelemetryAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function telemetryAuthReady(): boolean { return authReady; }
