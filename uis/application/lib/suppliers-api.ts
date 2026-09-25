/**
 * NEXOVA SOLUTIONS - lib/suppliers-api.ts
 * Cliente HTTP contra services/api (FastAPI) para el directorio de proveedores
 * (/suppliers). Traduce el DTO de la API (snake_case, ver
 * services/api/models.py) al modelo de la UI (camelCase, types/supplier.ts) y
 * convierte los errores de validación de Pydantic (en inglés) a mensajes en
 * español que se pueden mostrar tal cual. Mismo patrón que
 * uis/backoffice/src/services/incidents-api.ts.
 */

import {
  COUNTRY_LABELS,
  COUNTRY_CURRENCY,
  type NewSupplier,
  type Supplier,
  type SupplierCategory,
  type SupplierCountry,
  type SupplierCurrency,
  type SupplierFilters,
  type SupplierStatus,
} from "@/types/supplier";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── DTO de la API (snake_case, ver services/api/models.py) ──────────

interface SupplierDto {
  id: number;
  name: string;
  country: SupplierCountry;
  categories: SupplierCategory[];
  monthly_rate: number;
  currency: SupplierCurrency;
  status: SupplierStatus;
  contract_renewal_date: string | null;
  contact_email: string | null;
  notes: string | null;
  updated_at: string;
}

type SupplierCreateDto = Omit<SupplierDto, "id" | "updated_at">;

interface ValidationIssue {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
}

// ─── Mappers DTO ↔ modelo de la UI ────────────────────────────────────

function toSupplier(dto: SupplierDto): Supplier {
  return {
    id: dto.id,
    name: dto.name,
    country: dto.country,
    categories: dto.categories,
    monthlyRate: dto.monthly_rate,
    currency: dto.currency,
    status: dto.status,
    contractRenewalDate: dto.contract_renewal_date,
    contactEmail: dto.contact_email,
    notes: dto.notes,
    updatedAt: dto.updated_at,
  };
}

function toCreateDto(supplier: NewSupplier): SupplierCreateDto {
  return {
    name: supplier.name,
    country: supplier.country,
    categories: supplier.categories,
    monthly_rate: supplier.monthlyRate,
    currency: supplier.currency,
    status: supplier.status,
    contract_renewal_date: supplier.contractRenewalDate,
    contact_email: supplier.contactEmail,
    notes: supplier.notes,
  };
}

// ─── Manejo de errores ────────────────────────────────────────────────

const FIELD_NAMES: Record<string, string> = {
  name: "Nombre",
  country: "País",
  categories: "Categorías",
  monthly_rate: "Tarifa mensual",
  currency: "Moneda",
  status: "Estado",
  contract_renewal_date: "Fecha de renovación",
  contact_email: "Email de contacto",
  notes: "Notas",
};

const CURRENCY_MISMATCH_MESSAGE = `La moneda no corresponde al país: ${COUNTRY_LABELS.Spain} contrata en ${COUNTRY_CURRENCY.Spain} y ${COUNTRY_LABELS.USA} en ${COUNTRY_CURRENCY.USA}.`;

/** Un error de validación de FastAPI/Pydantic → frase en español. */
function translateIssue(issue: ValidationIssue): string {
  const field = issue.loc?.[issue.loc.length - 1];
  const name = typeof field === "string" ? FIELD_NAMES[field] : undefined;

  if (field === "contact_email") return "El email de contacto no es válido.";
  if (field === "name" && issue.type === "string_too_short") return "El nombre es obligatorio.";
  if (field === "categories" && issue.type === "too_short") return "Selecciona al menos una categoría.";
  if (issue.type === "value_error" && issue.msg?.includes("moneda")) return CURRENCY_MISMATCH_MESSAGE;
  if (name && issue.type === "greater_than") return `El campo «${name}» debe ser mayor que 0.`;
  if (name && issue.type === "missing") return `El campo «${name}» es obligatorio.`;
  if (name) return `Revisa el campo «${name}».`;
  return "Alguno de los datos enviados no es válido.";
}

/** Extrae un mensaje legible del cuerpo de error de la API; si no reconoce
 *  el formato, o el cuerpo no es JSON, cae al mensaje por defecto. */
async function extractErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = await response.json();

    if (Array.isArray(body?.detail)) {
      const messages = [...new Set((body.detail as ValidationIssue[]).map(translateIssue))];
      if (messages.length > 0) return messages.join(" ");
    }

    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // el cuerpo de la respuesta no es JSON o está vacío, se usa el mensaje por defecto
  }
  return fallbackMessage;
}

/** fetch contra la API que convierte fallos de red y respuestas no-2xx en Error con mensaje en español. */
async function request(path: string, init: RequestInit, fallbackMessage: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Comprueba que la API está en marcha.");
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, fallbackMessage));
  }
  return response;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ─── Endpoints: proveedores ───────────────────────────────────────────

/** Lista proveedores; los filtros vacíos no se envían. */
export async function listSuppliers(filters: SupplierFilters): Promise<Supplier[]> {
  const params = new URLSearchParams();
  if (filters.country) params.set("country", filters.country);
  if (filters.category) params.set("category", filters.category);
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const response = await request(
    `/suppliers${query}`,
    { method: "GET" },
    "No se pudo cargar el directorio de proveedores."
  );
  const dtos = (await response.json()) as SupplierDto[];
  return dtos.map(toSupplier);
}

export async function createSupplier(supplier: NewSupplier): Promise<Supplier> {
  const response = await request(
    "/suppliers",
    jsonInit("POST", toCreateDto(supplier)),
    "No se pudo registrar el proveedor."
  );
  return toSupplier((await response.json()) as SupplierDto);
}

export async function updateSupplierRate(id: number, monthlyRate: number): Promise<Supplier> {
  const response = await request(
    `/suppliers/${id}/rate`,
    jsonInit("PATCH", { monthly_rate: monthlyRate }),
    "No se pudo actualizar la tarifa."
  );
  return toSupplier((await response.json()) as SupplierDto);
}

export async function updateSupplierStatus(id: number, status: SupplierStatus): Promise<Supplier> {
  const response = await request(
    `/suppliers/${id}/status`,
    jsonInit("PATCH", { status }),
    "No se pudo cambiar el estado del proveedor."
  );
  return toSupplier((await response.json()) as SupplierDto);
}

export async function deleteSupplier(id: number): Promise<void> {
  await request(`/suppliers/${id}`, { method: "DELETE" }, "No se pudo eliminar el proveedor.");
}
