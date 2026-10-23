import { render, screen } from "@testing-library/react";

import type { InventoryOrder } from "../../../../types/inventory";
import { OrderHistorySummary } from "../order-history-summary";

const mockSummarizeInventoryOrders = jest.fn();

jest.mock("../../_lib/inventory-order-summary", () => ({
  summarizeInventoryOrders: (...args: unknown[]) => mockSummarizeInventoryOrders(...args),
}));

function makeOrder(
  id: number,
  orderType: InventoryOrder["orderType"],
  quantity: number,
  office: InventoryOrder["office"]
): InventoryOrder {
  return {
    id,
    orderType,
    assetId: 1,
    asset: { id: 1, name: "Portátil", sku: "NEX-001", category: "hardware", office },
    quantity,
    office,
    createdAt: "2026-10-23T10:00:00Z",
    creatorName: "Ana García",
    supplier: orderType === "inbound" ? "Proveedor" : null,
    exitType: orderType === "outbound" ? "consumption" : null,
    assignedTo: null,
  };
}

it("suma cantidades por tipo y oficina, y actualiza el resumen al cambiar los movimientos", () => {
  const first = [
    makeOrder(1, "inbound", 8, "Valencia"),
    makeOrder(2, "outbound", 3, "Miami"),
  ];
  const { summarizeInventoryOrders } = jest.requireActual<typeof import("../../_lib/inventory-order-summary")>("../../_lib/inventory-order-summary");
  mockSummarizeInventoryOrders.mockImplementation(summarizeInventoryOrders);
  mockSummarizeInventoryOrders.mockClear();
  const { rerender } = render(<OrderHistorySummary orders={first} />);

  expect(screen.getByText("8 unidades")).toBeInTheDocument();
  expect(screen.getByText("3 unidades")).toBeInTheDocument();
  expect(screen.getByText("1 movimientos · Valencia 8 · Miami 0")).toBeInTheDocument();
  expect(mockSummarizeInventoryOrders).toHaveBeenCalledTimes(1);

  rerender(<OrderHistorySummary orders={first} />);
  expect(mockSummarizeInventoryOrders).toHaveBeenCalledTimes(1);

  rerender(<OrderHistorySummary orders={[...first, makeOrder(3, "inbound", 4, "Miami")]} />);
  expect(mockSummarizeInventoryOrders).toHaveBeenCalledTimes(2);
  expect(screen.getByText("12 unidades")).toBeInTheDocument();
  expect(screen.getByText("2 movimientos · Valencia 8 · Miami 4")).toBeInTheDocument();
  mockSummarizeInventoryOrders.mockReset();
});
