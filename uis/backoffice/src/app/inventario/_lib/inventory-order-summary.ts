import type { InventoryOrder, InventoryOffice } from "../../../types/inventory";

export interface InventoryOrderSummary {
  inboundCount: number;
  inboundQuantity: number;
  outboundCount: number;
  outboundQuantity: number;
  byOffice: Record<InventoryOffice, { inbound: number; outbound: number }>;
}

/** Agrupa un historial potencialmente creciente en una sola pasada (O(n)). */
export function summarizeInventoryOrders(orders: readonly InventoryOrder[]): InventoryOrderSummary {
  const summary: InventoryOrderSummary = {
    inboundCount: 0,
    inboundQuantity: 0,
    outboundCount: 0,
    outboundQuantity: 0,
    byOffice: {
      Valencia: { inbound: 0, outbound: 0 },
      Miami: { inbound: 0, outbound: 0 },
    },
  };

  for (const order of orders) {
    const officeTotals = summary.byOffice[order.office];
    if (order.orderType === "inbound") {
      summary.inboundCount += 1;
      summary.inboundQuantity += order.quantity;
      officeTotals.inbound += order.quantity;
    } else {
      summary.outboundCount += 1;
      summary.outboundQuantity += order.quantity;
      officeTotals.outbound += order.quantity;
    }
  }

  return summary;
}
