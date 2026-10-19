import { createInboundOrder, createOutboundOrder, getInventoryOrders, getInventoryProduct, getInventoryProducts } from "../inventory-api";
import { setToken } from "../../lib/auth-storage";
import { jsonResponse, mockFetch, sentJson, sentUrl } from "./helpers";

const ASSET = {
  id: 7,
  name: "Portátil",
  sku: "NXV-IT-007",
  category: "hardware",
  office: "Valencia",
  current_stock: 12,
};

beforeEach(() => {
  window.localStorage.clear();
  setToken("session-token");
});

afterEach(() => jest.restoreAllMocks());

describe("inventory queries", () => {
  it("maps product stock to the UI model and does not cache the response", async () => {
    const fetchMock = mockFetch(jsonResponse(200, [ASSET]));

    await expect(getInventoryProducts("Valencia")).resolves.toEqual([
      { id: 7, name: "Portátil", sku: "NXV-IT-007", category: "hardware", office: "Valencia", currentStock: 12 },
    ]);

    expect(sentUrl(fetchMock).pathname).toBe("/inventory/products");
    expect(sentUrl(fetchMock).searchParams.get("office")).toBe("Valencia");
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer session-token");
  });

  it("loads the selected product detail to refresh current stock", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { ...ASSET, current_stock: 4 }));

    await expect(getInventoryProduct(7)).resolves.toMatchObject({ id: 7, currentStock: 4 });

    expect(sentUrl(fetchMock).pathname).toBe("/inventory/products/7");
  });

  it("maps order type, product and creator from the history response", async () => {
    mockFetch(jsonResponse(200, [{
      id: 3,
      order_type: "inbound",
      asset_id: 7,
      asset: { id: 7, name: "Portátil", sku: "NXV-IT-007", category: "hardware", office: "Valencia" },
      quantity: 2,
      office: "Valencia",
      created_at: "2026-10-16T10:00:00+00:00",
      user_uuid: "user-uuid",
      creator_name: "Ana García",
      supplier: "Distribuidor",
    }]));

    await expect(getInventoryOrders()).resolves.toMatchObject([
      { id: 3, orderType: "inbound", asset: { name: "Portátil" }, creatorName: "Ana García", userUuid: "user-uuid", supplier: "Distribuidor" },
    ]);
  });
});

describe("inventory order writes", () => {
  it("sends the confirmed inbound request fields", async () => {
    const fetchMock = mockFetch(jsonResponse(201, {
      id: 2, asset_id: 7, quantity: 5, supplier: "Distribuidor", office: "Valencia",
      created_at: "2026-10-16T10:00:00+00:00", user_uuid: "uuid",
    }));

    await createInboundOrder({ assetId: 7, quantity: 5, supplier: "Distribuidor", office: "Valencia" });

    expect(sentUrl(fetchMock).pathname).toBe("/inventory/orders/inbound");
    expect(sentJson(fetchMock)).toEqual({ asset_id: 7, quantity: 5, supplier: "Distribuidor", office: "Valencia" });
  });

  it("sends null for a consumption and translates the API's insufficient stock 400", async () => {
    const fetchMock = mockFetch(jsonResponse(400, {
      detail: "Insufficient stock for asset 'Portátil'. Available: 3, requested: 5.",
    }));

    await expect(createOutboundOrder({
      assetId: 7, quantity: 5, exitType: "consumption", assignedTo: null, office: "Valencia",
    })).rejects.toThrow("Stock insuficiente: hay 3 unidades disponibles y has solicitado 5.");

    expect(sentUrl(fetchMock).pathname).toBe("/inventory/orders/outbound");
    expect(sentJson(fetchMock).assigned_to).toBeNull();
  });

  it("shows a human-readable unrecognized 400 detail instead of discarding it", async () => {
    mockFetch(jsonResponse(400, { detail: "Unexpected backend text" }));

    await expect(createOutboundOrder({
      assetId: 7, quantity: 1, exitType: "consumption", assignedTo: null, office: "Valencia",
    })).rejects.toThrow("Unexpected backend text");
  });

  it("translates known assignment validation and exposes unknown 422 text safely", async () => {
    mockFetch(jsonResponse(422, {
      detail: [{ type: "value_error", loc: ["body"], msg: "Value error, assigned_to es obligatorio para una asignacion." }],
    }));

    await expect(createOutboundOrder({
      assetId: 7, quantity: 1, exitType: "allocation", assignedTo: null, office: "Valencia",
    })).rejects.toThrow("Indica a quién se asigna el producto.");

    mockFetch(jsonResponse(422, {
      detail: [{ type: "value_error", loc: ["body", "unknown"], msg: "Unexpected backend text" }],
    }));

    await expect(getInventoryProduct(7)).rejects.toThrow("La API indicó: Unexpected backend text");
  });

  it("shows the API detail for a 503 response", async () => {
    mockFetch(jsonResponse(503, { detail: "La base de datos no está disponible." }));

    await expect(getInventoryProducts()).rejects.toThrow("La base de datos no está disponible.");
  });

  it("shows readable API details for 500 errors and falls back for non-JSON bodies", async () => {
    mockFetch(jsonResponse(500, { detail: "Servicio de inventario temporalmente interrumpido." }));
    await expect(getInventoryOrders()).rejects.toThrow("Servicio de inventario temporalmente interrumpido.");

    mockFetch(new Response("<html>error</html>", { status: 500, headers: { "Content-Type": "text/html" } }));
    await expect(getInventoryOrders()).rejects.toThrow("No se pudo cargar el historial de inventario.");

    mockFetch(jsonResponse(500, { detail: "{\"exception\":\"internal\"}" }));
    await expect(getInventoryOrders()).rejects.toThrow("No se pudo cargar el historial de inventario.");
  });
});
