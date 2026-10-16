import { getOutboundStockWarning } from "../outbound-stock-warning";

describe("getOutboundStockWarning", () => {
  it("warns before submission when the requested amount exceeds the current stock", () => {
    expect(getOutboundStockWarning("6", 5)).toBe(
      "La cantidad supera el stock disponible (5 unidades)."
    );
  });

  it.each(["", "0", "-1", "1.5", "5"])("does not warn for %s against stock 5", (value) => {
    expect(getOutboundStockWarning(value, 5)).toBeNull();
  });
});
