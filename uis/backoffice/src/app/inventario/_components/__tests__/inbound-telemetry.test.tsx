import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InboundOrderForm } from "../inbound-order-form";

const mockCreate = jest.fn();
const mockTrack = jest.fn();
jest.mock("../../../../services/inventory-api", () => ({ createInboundOrder: (...args: unknown[]) => mockCreate(...args) }));
jest.mock("../../../../services/telemetry", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));
jest.mock("../../_hooks/use-inventory-products", () => ({ useInventoryProducts: () => ({ loading: false, error: null, retry: jest.fn(), products: [{ id: 1, name: "Kit de prueba", sku: "SYN-1", office: "Valencia", category: "training_materials", currentStock: 10 }] }) }));
beforeEach(() => { mockCreate.mockReset(); mockTrack.mockClear(); });

function fill() {
  render(<InboundOrderForm initialProductId="1" />);
  fireEvent.change(screen.getByLabelText("Cantidad recibida"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Proveedor de la entrega"), { target: { value: "private-supplier-name" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }));
}

test("a confirmed response completes the flow without supplier text in telemetry", async () => {
  mockCreate.mockResolvedValue({ quantity: 3 }); fill();
  await screen.findByText(/Entrada de 3 unidades/);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockTrack.mock.calls.map(([name]) => name)).toEqual(["flow_started", "flow_submitted", "flow_completed"]);
  expect(JSON.stringify(mockTrack.mock.calls)).not.toContain("private-supplier-name");
});

test("a failed request does not complete or create an authoritative order event", async () => {
  mockCreate.mockRejectedValue(new Error("No se pudo confirmar.")); fill();
  await screen.findByRole("alert");
  expect(mockTrack.mock.calls.some(([name]) => name === "flow_submitted")).toBe(true);
  expect(mockTrack.mock.calls.some(([name]) => ["flow_completed", "inbound_order_created"].includes(name))).toBe(false);
});

test("invalid input reports a validation code and never submits", async () => {
  render(<InboundOrderForm initialProductId="1" />);
  fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }));
  await waitFor(() => expect(mockTrack).toHaveBeenCalledWith("inventory_validation_failed", expect.objectContaining({ field_codes: ["quantity"], stage: "client" })));
  expect(mockCreate).not.toHaveBeenCalled();
  expect(mockTrack.mock.calls.some(([name]) => name === "flow_submitted")).toBe(false);
});
