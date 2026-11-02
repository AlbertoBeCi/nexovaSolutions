import { act, renderHook } from "@testing-library/react";
import { useInventoryTelemetry } from "../use-inventory-telemetry";

const mockTrack = jest.fn();
jest.mock("../../../../services/telemetry", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
beforeEach(() => mockTrack.mockClear());

test("a flow starts on interaction and completes only after an explicit successful response", () => {
  const { result } = renderHook(() => useInventoryTelemetry("inbound", 12, "Valencia"));
  expect(mockTrack).not.toHaveBeenCalled();
  act(() => { result.current.interact(); result.current.interact(); });
  expect(mockTrack.mock.calls.filter(([name]) => name === "flow_started")).toHaveLength(1);
  act(() => { result.current.submitted(); });
  const first = mockTrack.mock.calls.find(([name]) => name === "flow_submitted")![1];
  expect(mockTrack.mock.calls.filter(([name]) => name === "flow_completed")).toHaveLength(0);
  act(() => { result.current.submitted(); result.current.completed(); });
  const submissions = mockTrack.mock.calls.filter(([name]) => name === "flow_submitted");
  expect(submissions[1][1].attempt_id).not.toBe(first.attempt_id);
  expect(submissions[1][1].flow_id).toBe(first.flow_id);
  expect(mockTrack).toHaveBeenLastCalledWith("flow_completed", expect.objectContaining({ attempt_id: submissions[1][1].attempt_id, completion_mode: "server_response" }));
});

test("validation uses codes, nullable missing metadata and the correct office currency", () => {
  const { result } = renderHook(() => useInventoryTelemetry("outbound", 12, "Miami"));
  act(() => result.current.invalid("assigned_to", "required"));
  expect(mockTrack).toHaveBeenLastCalledWith("inventory_validation_failed", { product_id: 12, order_type: "outbound", stage: "client", field_codes: ["assigned_to"], reason_code: "required", office: "miami", product_category: null, programme_id: null, quantity: 0, currency: "USD" });
});
