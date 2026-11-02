import { readFileSync } from "node:fs";
import path from "node:path";
import contract from "../telemetry-contract.json";
import Ajv from "ajv";

let telemetry: typeof import("../telemetry");
let context: typeof import("../telemetry-context");
let storage: typeof import("../../lib/auth-storage");
const endpoint = "http://localhost:8000/telemetry/events";
const page = () => ({ page_view_id: context.uuid(), route_template: "/", ui_language: "es" });
const response = () => Promise.resolve(new Response(JSON.stringify({ received: 20 }), { status: 200 }));
function posts() { return (global.fetch as jest.Mock).mock.calls.filter(([url, init]) => url === endpoint && init?.method === "POST"); }
function events() { return posts().flatMap(([, init]) => JSON.parse(init.body as string).events); }

beforeEach(async () => {
  jest.resetModules(); jest.useFakeTimers(); jest.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  sessionStorage.clear(); localStorage.clear();
  process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT = endpoint;
  global.fetch = jest.fn().mockImplementation(response);
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: jest.fn().mockReturnValue(true) });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  telemetry = await import("../telemetry"); context = await import("../telemetry-context"); storage = await import("../../lib/auth-storage");
  telemetry.startTelemetry();
});
afterEach(() => { telemetry.stopTelemetry(); jest.clearAllTimers(); jest.useRealTimers(); delete process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT; });

test("size batches 20 events and completes the immutable envelope at capture time", async () => {
  context.beginTelemetrySession();
  const properties = page();
  telemetry.track("page_viewed", properties);
  properties.ui_language = "en";
  for (let i = 1; i < 20; i++) telemetry.track("page_viewed", page());
  await jest.advanceTimersByTimeAsync(0);
  expect(posts()).toHaveLength(1);
  expect(events()).toHaveLength(20);
  const event = events()[0];
  expect(Object.keys(event).sort()).toEqual(["eventId", "timestamp", "sessionId", "userId", "event_type", "schemaVersion", "requestId", "properties"].sort());
  expect(context.isUuid(event.eventId)).toBe(true); expect(context.isUuid(event.sessionId)).toBe(true); expect(context.isUuid(event.requestId)).toBe(true);
  expect(event.timestamp).toBe("2026-11-02T12:00:00.000Z"); expect(event.schemaVersion).toBe("1.0.0"); expect(event.userId).toBeNull();
  expect(event.properties.ui_language).toBe("es");
});

test("flushes 10 seconds after the first event without postponing the deadline", async () => {
  telemetry.track("page_viewed", page());
  await jest.advanceTimersByTimeAsync(9000); telemetry.track("page_viewed", page());
  expect(posts()).toHaveLength(0);
  await jest.advanceTimersByTimeAsync(1000);
  expect(events()).toHaveLength(2);
});

test("hidden and pagehide flush once using a JSON Blob", () => {
  telemetry.track("page_viewed", page());
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pagehide"));
  expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  expect((navigator.sendBeacon as jest.Mock).mock.calls[0][1].type).toBe("application/json");
  expect(telemetry.telemetryDiagnostics().queued).toBe(0);
});

test("Beacon false falls back to keepalive without blocking", async () => {
  (navigator.sendBeacon as jest.Mock).mockReturnValue(false);
  telemetry.track("page_viewed", page()); window.dispatchEvent(new Event("pagehide"));
  await jest.advanceTimersByTimeAsync(0);
  expect(posts()[0][1].keepalive).toBe(true);
});

test("retries the same IDs after 1 and 2 seconds and discards after three failures", async () => {
  (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));
  for (let i = 0; i < 20; i++) telemetry.track("page_viewed", page());
  await jest.advanceTimersByTimeAsync(0); expect(posts()).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(999); expect(posts()).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(1); expect(posts()).toHaveLength(2);
  await jest.advanceTimersByTimeAsync(2000); expect(posts()).toHaveLength(3);
  expect(posts()[0][1].body).toBe(posts()[2][1].body);
  expect(telemetry.telemetryDiagnostics()).toEqual({ queued: 0, dropped: 20 });
});

test("later events are not lost while an earlier batch is in flight", async () => {
  let complete!: (response: Response) => void;
  (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise<Response>((resolve) => { complete = resolve; })).mockImplementation(response);
  for (let i = 0; i < 21; i++) telemetry.track("page_viewed", page());
  complete(new Response("{}", { status: 200 })); await jest.advanceTimersByTimeAsync(0);
  expect(events()).toHaveLength(20);
  await jest.advanceTimersByTimeAsync(10000); expect(events()).toHaveLength(21);
});

test("only the server bridge supplies a pseudonym; a failed optional lookup preserves auth", async () => {
  const pseudonym = `p1_${"a".repeat(64)}`;
  (global.fetch as jest.Mock).mockImplementation((url: string) => url.endsWith("/telemetry/context") ? Promise.resolve(new Response(JSON.stringify({ userId: pseudonym, keyVersion: "p1", schemaVersion: "1.0.0" }))) : response());
  storage.setToken("test-token"); await telemetry.telemetryIdentityReady();
  telemetry.track("page_viewed", page()); await jest.advanceTimersByTimeAsync(10000);
  expect(events()[0].userId).toBe(pseudonym); expect(events()[0].properties.actor_type).toBe("user");
  (global.fetch as jest.Mock).mockResolvedValue(new Response("{}", { status: 401 }));
  storage.setToken("changed-test-token"); await telemetry.telemetryIdentityReady();
  expect(storage.getToken()).toBe("changed-test-token");
});

test("rejects PII, extra keys, invalid office currency and unapproved programmes", async () => {
  telemetry.track("page_viewed", { ...page(), email: "private@example.com" });
  telemetry.track("page_viewed", { ...page(), constructor: "secret" });
  telemetry.track("login_failed", { reason_code: "invalid_credentials" }); // server authority only
  const invalid = { product_id: 1, order_type: "inbound", stage: "client", field_codes: ["quantity"], reason_code: "out_of_range", office: "miami", product_category: null, programme_id: null, quantity: 0, currency: "EUR" };
  telemetry.track("inventory_validation_failed", invalid);
  telemetry.track("inventory_validation_failed", { ...invalid, currency: "USD", programme_id: "unapproved" });
  await jest.advanceTimersByTimeAsync(10000); expect(posts()).toHaveLength(0);
});

test("queue stays bounded during a transport outage", () => {
  (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
  for (let i = 0; i < 700; i++) telemetry.track("page_viewed", page());
  expect(telemetry.telemetryDiagnostics().queued).toBeLessThanOrEqual(500);
  expect(telemetry.telemetryDiagnostics().dropped).toBeGreaterThan(0);
});

test("request correlation is scoped and routes contain no personal IDs or queries", async () => {
  const id = context.uuid(); context.withTelemetryRequest(id, () => telemetry.track("page_viewed", page()));
  telemetry.track("page_viewed", page()); await jest.advanceTimersByTimeAsync(10000);
  expect(events()[0].requestId).toBe(id); expect(events()[1].requestId).not.toBe(id);
  expect(context.normalizeRoute("/candidates/private-id?email=secret")).toBe("/candidates/{id}");
  expect(context.normalizeRoute("/unknown/private-id")).toBe("unmatched");
});

test("session survives reload storage and renews after inactivity; logout clears it", () => {
  context.beginTelemetrySession(); const first = context.telemetrySessionId();
  jest.setSystemTime(Date.now() + 30 * 60 * 1000); expect(context.telemetrySessionId()).not.toBe(first);
  context.endTelemetrySession(); expect(context.telemetrySessionId()).toBeNull();
});

test("client contracts retain the approved event names, fields and version", () => {
  const primary = JSON.parse(readFileSync(path.resolve(process.cwd(), "../../docs/telemetry/event-schemas.json"), "utf8"));
  for (const [name, spec] of Object.entries(contract.events)) {
    const event = primary.definitions[name];
    expect(event.properties.schemaVersion.const).toBe(contract.schemaVersion);
    const payload = event.properties.properties;
    expect(Object.keys(spec.properties).sort()).toEqual(Object.keys(payload.properties).filter((key) => !["source", "environment", "actor_type", "authority", "key_version"].includes(key)).sort());
  }
});

test("actual client envelopes validate against the complete approved JSON Schema", async () => {
  const primary = JSON.parse(readFileSync(path.resolve(process.cwd(), "../../docs/telemetry/event-schemas.json"), "utf8"));
  const validate = new Ajv({ allErrors: true }).compile(primary);
  for (const name of Object.keys(contract.events)) {
    const properties = { ...primary.definitions[name].examples[0].properties };
    for (const key of ["source", "environment", "actor_type", "authority", "key_version"]) delete properties[key];
    if ("programme_id" in properties) properties.programme_id = null;
    telemetry.track(name, properties);
  }
  await jest.advanceTimersByTimeAsync(10000);
  expect(events()).toHaveLength(Object.keys(contract.events).length);
  for (const event of events()) { expect(validate(event)).toBe(true); }
});

test("API metrics use the effective response request ID and exclude telemetry traffic", async () => {
  const effective = context.uuid();
  (global.fetch as jest.Mock).mockImplementation((url: string) => url === endpoint ? response() : Promise.resolve(new Response("[]", { headers: { "X-Request-ID": effective } })));
  const api = await import("../../lib/api-client");
  await api.apiRequest("/inventory/products?office=Miami", { method: "GET" }, "fallback", api.genericTranslateIssue);
  await api.apiRequest("/telemetry/context", { method: "GET" }, "", api.genericTranslateIssue, { redirectOnUnauthorized: false });
  await jest.advanceTimersByTimeAsync(10000);
  expect(events()).toHaveLength(1);
  expect(events()[0].requestId).toBe(effective);
  expect(events()[0].properties).toEqual(expect.objectContaining({ route_template: "/inventory/products", outcome: "response", dependency: "nexova_api" }));
});

test("network errors are measured without copying exception messages", async () => {
  (global.fetch as jest.Mock).mockImplementation((url: string) => url === endpoint ? response() : Promise.reject(new Error("private-network-secret")));
  const api = await import("../../lib/api-client");
  await expect(api.apiRequest("/inventory/products", { method: "GET" }, "fallback", api.genericTranslateIssue)).rejects.toMatchObject({ status: null });
  await jest.advanceTimersByTimeAsync(10000);
  expect(events()[0].properties.outcome).toBe("network_error");
  expect(JSON.stringify(events())).not.toContain("private-network-secret");
});
