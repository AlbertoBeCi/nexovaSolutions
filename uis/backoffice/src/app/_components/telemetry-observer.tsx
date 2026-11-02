"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { startTelemetry, stopTelemetry, track } from "../../services/telemetry";
import { normalizeRoute, subscribeTelemetryAuth, telemetryAuthReady, uuid } from "../../services/telemetry-context";

interface Page { id: string; route: string }
interface Vital { id: string; name: string; value: number; navigationType: string }
interface ErrorWindow { route: string; code: string; fingerprint: string | null; repeatFirst: string | null; last: string; repeats: number; timer: ReturnType<typeof setTimeout> }
let page: Page | null = null;
let vitalsPage: Page | null = null;
let loadRecorded = false;
const pendingVitals: Vital[] = [];
const seenVitals = new Set<string>();
const errors = new Map<string, ErrorWindow>();

function navigationType(value: string): string {
  if (value === "reload") return "reload";
  if (["back-forward", "back_forward", "back-forward-cache"].includes(value)) return "back_forward";
  return "navigate";
}
function reportVital(metric: Vital): void {
  if (!["LCP", "INP", "CLS"].includes(metric.name) || !Number.isFinite(metric.value) || metric.value < 0) return;
  if (!vitalsPage) { if (pendingVitals.length < 10) pendingVitals.push(metric); return; }
  const key = `${metric.name}:${metric.id}`;
  if (seenVitals.has(key)) return;
  seenVitals.add(key);
  if (seenVitals.size > 100) seenVitals.delete(seenVitals.values().next().value!);
  track("page_performance_recorded", { page_view_id: vitalsPage.id, route_template: vitalsPage.route, metric: metric.name, value: metric.value, navigation_type: navigationType(metric.navigationType), measurement_origin: "field" });
}
const reportWebVital: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  reportVital({ id: metric.id, name: metric.name, value: metric.value, navigationType: metric.navigationType });
};
function reportLoad(): void {
  try {
    if (!vitalsPage || loadRecorded) return;
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!entry || entry.loadEventEnd <= 0) return;
    loadRecorded = true;
    track("page_performance_recorded", { page_view_id: vitalsPage.id, route_template: vitalsPage.route, metric: "load", value: Math.max(0, entry.loadEventEnd - entry.startTime), navigation_type: navigationType(entry.type), measurement_origin: "field" });
  } catch { /* unsupported browser */ }
}
function emitError(window: ErrorWindow, first: string, last: string, count: number): void {
  if (!window.fingerprint || count < 1) return;
  track("frontend_error_captured", { route_template: window.route, error_code: window.code, fingerprint: window.fingerprint, first_seen_at: first, last_seen_at: last, occurrence_count: count, sanitizer_version: "1.0.0" });
}
function flushErrors(): void {
  for (const window of errors.values()) {
    if (window.repeatFirst) emitError(window, window.repeatFirst, window.last, window.repeats);
    clearTimeout(window.timer);
  }
  errors.clear();
}
function recordError(code: string): void {
  try {
    const route = page?.route ?? normalizeRoute(window.location.pathname);
    const key = `${code}|${route}|1.0.0`;
    const now = new Date().toISOString();
    const existing = errors.get(key);
    if (existing) { existing.repeatFirst ??= now; existing.last = now; existing.repeats++; return; }
    const bucket: ErrorWindow = { route, code, fingerprint: null, repeatFirst: null, last: now, repeats: 0, timer: setTimeout(() => {
      if (bucket.repeatFirst) emitError(bucket, bucket.repeatFirst, bucket.last, bucket.repeats);
      errors.delete(key);
    }, 60000) };
    errors.set(key, bucket);
    // Only controlled code/template/version; never error text or stack.
    void crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)).then((hash) => {
      bucket.fingerprint = Array.from(new Uint8Array(hash)).map((value) => value.toString(16).padStart(2, "0")).join("");
      emitError(bucket, now, now, 1);
    }).catch(() => {});
  } catch { /* failures stay out of band */ }
}

export function TelemetryObserver() {
  const pathname = usePathname();
  const readyRoute = useSyncExternalStore(subscribeTelemetryAuth, telemetryAuthReady, () => null);
  const lastPath = useRef<string | null>(null);
  useReportWebVitals(reportWebVital);
  useEffect(() => {
    startTelemetry();
    const error = () => recordError("unexpected_exception");
    const rejection = () => recordError("unhandled_rejection");
    const hidden = () => { if (document.visibilityState === "hidden") flushErrors(); };
    window.addEventListener("error", error, true);
    window.addEventListener("unhandledrejection", rejection);
    window.addEventListener("load", reportLoad);
    document.addEventListener("visibilitychange", hidden, true);
    return () => {
      flushErrors();
      window.removeEventListener("error", error, true);
      window.removeEventListener("unhandledrejection", rejection);
      window.removeEventListener("load", reportLoad);
      document.removeEventListener("visibilitychange", hidden, true);
      stopTelemetry();
    };
  }, []);
  useEffect(() => {
    if (pathname.startsWith("/inventario")) return;
    const protectedRoute = /^\/(account|incidencias|backoffice)(\/|$)/.test(pathname);
    if (protectedRoute && readyRoute !== pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    page = { id: uuid(), route: normalizeRoute(pathname) };
    track("page_viewed", { page_view_id: page.id, route_template: page.route, ui_language: document.documentElement.lang.startsWith("en") ? "en" : "es" });
    vitalsPage ??= page;
    for (const metric of pendingVitals.splice(0)) reportVital(metric);
    reportLoad();
  }, [pathname, readyRoute]);
  return null;
}
