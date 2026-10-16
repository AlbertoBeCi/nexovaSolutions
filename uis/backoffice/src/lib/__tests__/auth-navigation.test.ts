import { getLoginHref, getSafeReturnTo } from "../auth-navigation";

describe("safe login return destinations", () => {
  it.each([
    ["/inventario", "/inventario"],
    ["/inventario/historial?office=Miami&tipo=outbound", "/inventario/historial?office=Miami&tipo=outbound"],
  ])("accepts the internal destination %s", (input, expected) => {
    expect(getSafeReturnTo(input)).toBe(expected);
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "/login", "", null])(
    "rejects the unsafe destination %s",
    (value) => {
      expect(getSafeReturnTo(value)).toBeNull();
    }
  );

  it("encodes the requested internal route for the login page", () => {
    expect(getLoginHref("/inventario?office=Miami")).toBe(
      "/login?next=%2Finventario%3Foffice%3DMiami"
    );
  });
});
