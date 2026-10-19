import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplierRate,
  updateSupplierStatus,
} from "@/lib/suppliers-api";
import type { NewSupplier } from "@/types/supplier";
import { emptyResponse, jsonResponse, mockFetch, sentJson, sentUrl } from "./helpers";

const DTO = {
  id: 7,
  name: "Factorial",
  country: "Spain",
  categories: ["software"],
  monthly_rate: 540,
  currency: "EUR",
  status: "active",
  contract_renewal_date: "2027-03-01",
  contact_email: "a@b.com",
  notes: "n",
  updated_at: "2026-01-01T00:00:00Z",
};

const NEW_SUPPLIER: NewSupplier = {
  name: "Stripe",
  country: "USA",
  categories: ["payments"],
  monthlyRate: 420,
  currency: "USD",
  status: "active",
  contractRenewalDate: null,
  contactEmail: null,
  notes: null,
};

beforeEach(() => window.localStorage.clear());

describe("mapeo DTO -> modelo de la UI", () => {
  it("convierte snake_case a camelCase en el listado", async () => {
    mockFetch(jsonResponse(200, [DTO]));

    const [supplier] = await listSuppliers({ country: null, category: null });

    expect(supplier).toEqual({
      id: 7,
      name: "Factorial",
      country: "Spain",
      categories: ["software"],
      monthlyRate: 540,
      currency: "EUR",
      status: "active",
      contractRenewalDate: "2027-03-01",
      contactEmail: "a@b.com",
      notes: "n",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("devuelve una lista vacía sin proveedores", async () => {
    mockFetch(jsonResponse(200, []));

    expect(await listSuppliers({ country: null, category: null })).toEqual([]);
  });

  it("conserva los campos opcionales nulos", async () => {
    mockFetch(jsonResponse(200, [{ ...DTO, contract_renewal_date: null, contact_email: null, notes: null }]));

    const [supplier] = await listSuppliers({ country: null, category: null });

    expect(supplier.contractRenewalDate).toBeNull();
    expect(supplier.contactEmail).toBeNull();
    expect(supplier.notes).toBeNull();
  });

  it("convierte camelCase a snake_case al crear", async () => {
    const fetchMock = mockFetch(jsonResponse(201, DTO));

    await createSupplier(NEW_SUPPLIER);

    expect(sentJson(fetchMock)).toEqual({
      name: "Stripe",
      country: "USA",
      categories: ["payments"],
      monthly_rate: 420,
      currency: "USD",
      status: "active",
      contract_renewal_date: null,
      contact_email: null,
      notes: null,
    });
  });

  it("devuelve el proveedor creado ya mapeado", async () => {
    mockFetch(jsonResponse(201, DTO));

    expect((await createSupplier(NEW_SUPPLIER)).monthlyRate).toBe(540);
  });
});

describe("filtros del listado", () => {
  it.each([
    [{ country: null, category: null }, ""],
    [{ country: "Spain", category: null }, "country=Spain"],
    [{ country: null, category: "software" }, "category=software"],
    [{ country: "USA", category: "payments" }, "country=USA&category=payments"],
  ] as const)("%j -> query «%s»", async (filters, expected) => {
    const fetchMock = mockFetch(jsonResponse(200, []));

    await listSuppliers({ ...filters });

    expect(sentUrl(fetchMock).search.replace(/^\?/, "")).toBe(expected);
  });
});

describe("actualizaciones y borrado", () => {
  it("updateSupplierRate envía solo la tarifa y devuelve el proveedor", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { ...DTO, monthly_rate: 99 }));

    const supplier = await updateSupplierRate(7, 99);

    expect(sentJson(fetchMock)).toEqual({ monthly_rate: 99 });
    expect(sentUrl(fetchMock).pathname).toBe("/suppliers/7/rate");
    expect(supplier.monthlyRate).toBe(99);
  });

  it("updateSupplierStatus envía solo el estado", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { ...DTO, status: "suspended" }));

    const supplier = await updateSupplierStatus(7, "suspended");

    expect(sentJson(fetchMock)).toEqual({ status: "suspended" });
    expect(supplier.status).toBe("suspended");
  });

  it("deleteSupplier resuelve sin cuerpo (204)", async () => {
    mockFetch(emptyResponse(204));

    await expect(deleteSupplier(7)).resolves.toBeUndefined();
  });
});

describe("errores traducidos al español", () => {
  const fail = (issue: object) => mockFetch(jsonResponse(422, { detail: [issue] }));
  const attempt = () => createSupplier(NEW_SUPPLIER);

  it.each([
    [{ type: "value_error", loc: ["body"], msg: "Value error, Para contratos en Spain, la moneda debe ser 'EUR'." },
      "La moneda no corresponde al país: España contrata en EUR y Estados Unidos en USD."],
    [{ type: "value_error", loc: ["body", "contact_email"], msg: "x" }, "El email de contacto no es válido."],
    [{ type: "string_too_short", loc: ["body", "name"] }, "El nombre es obligatorio."],
    [{ type: "too_short", loc: ["body", "categories"] }, "Selecciona al menos una categoría."],
    [{ type: "greater_than", loc: ["body", "monthly_rate"] }, "El campo «Tarifa mensual» debe ser mayor que 0."],
    [{ type: "missing", loc: ["body", "country"] }, "El campo «País» es obligatorio."],
    [{ type: "enum", loc: ["body", "status"] }, "Revisa el campo «Estado»."],
    [{ type: "extra_forbidden", loc: ["body", "campo_raro"] }, "Alguno de los datos enviados no es válido."],
    [{ type: "x" }, "Alguno de los datos enviados no es válido."],
  ])("%j", async (issue, message) => {
    fail(issue);

    await expect(attempt()).rejects.toThrow(message);
  });

  it("nunca muestra el texto en inglés de Pydantic", async () => {
    fail({ type: "missing", loc: ["body", "name"], msg: "Field required" });

    await expect(attempt()).rejects.not.toThrow(/Field required/);
  });

  it("junta varios errores sin repetirlos", async () => {
    mockFetch(jsonResponse(422, {
      detail: [
        { type: "missing", loc: ["body", "name"] },
        { type: "missing", loc: ["body", "country"] },
        { type: "missing", loc: ["body", "name"] },
      ],
    }));

    await expect(attempt()).rejects.toThrow(
      "El campo «Nombre» es obligatorio. El campo «País» es obligatorio."
    );
  });

  it("404 muestra el detail de la API", async () => {
    mockFetch(jsonResponse(404, { detail: "Proveedor no encontrado." }));

    await expect(deleteSupplier(1)).rejects.toThrow("Proveedor no encontrado.");
  });

  it.each([
    ["listado", () => listSuppliers({ country: null, category: null }), "No se pudo cargar el directorio de proveedores."],
    ["alta", () => createSupplier(NEW_SUPPLIER), "No se pudo registrar el proveedor."],
    ["tarifa", () => updateSupplierRate(1, 1), "No se pudo actualizar la tarifa."],
    ["estado", () => updateSupplierStatus(1, "active"), "No se pudo cambiar el estado del proveedor."],
    ["borrado", () => deleteSupplier(1), "No se pudo eliminar el proveedor."],
  ])("%s: mensaje por defecto si la respuesta no se entiende", async (_name, call, message) => {
    mockFetch(new Response("<html>", { status: 500 }));

    await expect(call()).rejects.toThrow(message);
  });

  it("red caída: mensaje de conexión", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    await expect(listSuppliers({ country: null, category: null })).rejects.toThrow(
      "No se pudo conectar con el servidor."
    );
  });
});
