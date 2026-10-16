jest.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`redirect:${destination}`);
  },
}));

import { redirectToInventory } from "../redirect-to-inventory";

describe("redirectToInventory", () => {
  it("preserves office filters and selected products when redirecting legacy URLs", () => {
    expect(() =>
      redirectToInventory("/backoffice/inventory/orders/outbound", {
        office: "Valencia",
        producto: "7",
      })
    ).toThrow("redirect:/backoffice/inventory/orders/outbound?office=Valencia&producto=7");
  });

  it("preserves repeated search values", () => {
    expect(() =>
      redirectToInventory("/backoffice/inventory/orders", { tipo: ["inbound", "outbound"] })
    ).toThrow("redirect:/backoffice/inventory/orders?tipo=inbound&tipo=outbound");
  });
});
