"use client";
import { useRef } from "react";
import { track } from "../../../services/telemetry";
import { uuid, withTelemetryRequest } from "../../../services/telemetry-context";

export function useInventoryTelemetry(orderType: "inbound" | "outbound", productId: number | null, office: string) {
  const flow = useRef<{ id: string; startedAt: number; attemptId: string | null; requestId: string | null } | null>(null);
  const route = `/backoffice/inventory/orders/${orderType}`;
  const common = (id: string) => ({ flow_id: id, flow_type: `${orderType}_order`, route_template: route });
  function interact() {
    if (!flow.current) {
      flow.current = { id: uuid(), startedAt: Date.now(), attemptId: null, requestId: null };
      track("flow_started", common(flow.current.id));
    }
    return flow.current;
  }
  function invalid(field: string, reason: string) {
    interact();
    const normalizedOffice = office === "Valencia" ? "valencia" : office === "Miami" ? "miami" : null;
    track("inventory_validation_failed", { product_id: productId, order_type: orderType, stage: "client", field_codes: [field], reason_code: reason, office: normalizedOffice, product_category: null, programme_id: null, quantity: 0, currency: normalizedOffice === "valencia" ? "EUR" : normalizedOffice === "miami" ? "USD" : null });
  }
  function submitted(): string {
    const current = interact();
    current.attemptId = uuid(); current.requestId = uuid();
    withTelemetryRequest(current.requestId, () => track("flow_submitted", { ...common(current.id), attempt_id: current.attemptId, submission_mode: "http" }));
    return current.requestId;
  }
  function completed() {
    const current = flow.current;
    if (!current?.attemptId || !current.requestId) return;
    withTelemetryRequest(current.requestId, () => track("flow_completed", { ...common(current.id), attempt_id: current.attemptId, completion_mode: "server_response", duration_ms: Math.min(3600000, Math.max(0, Date.now() - current.startedAt)) }));
    flow.current = null;
  }
  return { interact, invalid, submitted, completed };
}
