import { act, cleanup, render } from "@testing-library/react";
import { TextEncoder } from "node:util";
import { TelemetryObserver } from "../telemetry-observer";
import { markTelemetryAuthReady } from "../../../services/telemetry-context";

let mockPath = "/backoffice/inventory/products";
let mockVitalCallback: (metric: { id: string; name: string; value: number; navigationType: string }) => void;
const mockTrack = jest.fn();
jest.mock("next/navigation", () => ({ usePathname: () => mockPath }));
jest.mock("next/web-vitals", () => ({ useReportWebVitals: (callback: typeof mockVitalCallback) => { mockVitalCallback = callback; } }));
jest.mock("../../../services/telemetry", () => ({ track: (...args: unknown[]) => mockTrack(...args), startTelemetry: jest.fn(), stopTelemetry: jest.fn() }));

beforeEach(() => {
  mockTrack.mockClear(); markTelemetryAuthReady(false);
  Object.assign(globalThis, { TextEncoder });
  Object.defineProperty(crypto, "subtle", { configurable: true, value: { digest: jest.fn().mockResolvedValue(new Uint8Array(32).buffer) } });
  Object.defineProperty(performance, "getEntriesByType", { configurable: true, value: jest.fn().mockReturnValue([]) });
});
afterEach(() => { cleanup(); jest.useRealTimers(); });

test("protected page views wait for the displayed authenticated route and aliases do not duplicate", () => {
  mockPath = "/backoffice/inventory/products";
  const view = render(<TelemetryObserver />);
  expect(mockTrack.mock.calls.filter(([name]) => name === "page_viewed")).toHaveLength(0);
  act(() => markTelemetryAuthReady(mockPath));
  view.rerender(<TelemetryObserver />);
  expect(mockTrack.mock.calls.filter(([name]) => name === "page_viewed")).toHaveLength(1);
  mockPath = "/inventario"; view.rerender(<TelemetryObserver />);
  expect(mockTrack.mock.calls.filter(([name]) => name === "page_viewed")).toHaveLength(1);
  mockPath = "/candidates/private-id"; view.rerender(<TelemetryObserver />);
  expect(mockTrack).toHaveBeenLastCalledWith("page_viewed", expect.objectContaining({ route_template: "/candidates/{id}" }));
});

test("Web Vitals use a stable callback, allowed names, original page context and normalized navigation", () => {
  mockPath = "/"; const view = render(<TelemetryObserver />);
  const callback = mockVitalCallback;
  act(() => mockVitalCallback({ id: "lcp-once", name: "LCP", value: 123, navigationType: "back-forward" }));
  act(() => mockVitalCallback({ id: "lcp-once", name: "LCP", value: 123, navigationType: "back-forward" }));
  act(() => mockVitalCallback({ id: "ttfb", name: "TTFB", value: 50, navigationType: "navigate" }));
  view.rerender(<TelemetryObserver />);
  expect(mockVitalCallback).toBe(callback);
  const metrics = mockTrack.mock.calls.filter(([name]) => name === "page_performance_recorded");
  expect(metrics).toHaveLength(1);
  expect(metrics[0][1]).toEqual(expect.objectContaining({ metric: "LCP", value: 123, navigation_type: "back_forward", measurement_origin: "field" }));
  expect(metrics[0][1].route_template).not.toContain("private-id");
});

test("uncaught errors omit raw contents and repeats use disjoint 60-second counts", async () => {
  jest.useFakeTimers(); mockPath = "/"; render(<TelemetryObserver />);
  await act(async () => {
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: "private-password-email@example.com" }));
    await Promise.resolve();
  });
  act(() => { window.dispatchEvent(new Event("unhandledrejection")); window.dispatchEvent(new Event("unhandledrejection")); });
  await act(async () => { await jest.advanceTimersByTimeAsync(60000); });
  const captured = mockTrack.mock.calls.filter(([name]) => name === "frontend_error_captured");
  expect(captured.map(([, p]) => p.occurrence_count)).toEqual([1, 2]);
  expect(JSON.stringify(captured)).not.toContain("private-password");
  expect(captured[0][1].fingerprint).toMatch(/^[a-f0-9]{64}$/);
});

test("window errors use a controlled code rather than a raw message", async () => {
  mockPath = "/"; render(<TelemetryObserver />);
  await act(async () => { window.dispatchEvent(Object.assign(new Event("error"), { message: "private-window-error" })); await Promise.resolve(); });
  const event = mockTrack.mock.calls.find(([name]) => name === "frontend_error_captured");
  expect(event?.[1].error_code).toBe("unexpected_exception");
  expect(JSON.stringify(event)).not.toContain("private-window-error");
});
