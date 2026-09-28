/**
 * NEXOVA SOLUTIONS - lib/suppliers-api.ts
 * Cliente HTTP contra services/api (FastAPI) para el directorio de proveedores
 * (/suppliers). Traduce el DTO de la API (snake_case, ver
 * services/api/models.py) al modelo de la UI (camelCase, types/supplier.ts) y
 * convierte los errores de validación de Pydantic (en inglés) a mensajes en
 * español que se pueden mostrar tal cual. Mismo patrón que
 * uis/backoffice/src/services/incidents-api.ts.
 */

import { apiRequest, jsonInit, type ValidationIssue } from "@/lib/api-client";
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

// ─── Endpoints: proveedores ───────────────────────────────────────────

/** Lista proveedores; los filtros vacíos no se envían. */
export async function listSuppliers(filters: SupplierFilters): Promise<Supplier[]> {
  const params = new URLSearchParams();
  if (filters.country) params.set("country", filters.country);
  if (filters.category) params.set("category", filters.category);
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const response = await apiRequest(
    `/suppliers${query}`,
    { method: "GET" },
    "No se pudo cargar el directorio de proveedores.",
    translateIssue
  );
  const dtos = (await response.json()) as SupplierDto[];
  return dtos.map(toSupplier);
}

export async function createSupplier(supplier: NewSupplier): Promise<Supplier> {
  const response = await apiRequest(
    "/suppliers",
    jsonInit("POST", toCreateDto(supplier)),
    "No se pudo registrar el proveedor.",
    translateIssue
  );
  return toSupplier((await response.json()) as SupplierDto);
}

export async function updateSupplierRate(id: number, monthlyRate: number): Promise<Supplier> {
  const response = await apiRequest(
    `/suppliers/${id}/rate`,
    jsonInit("PATCH", { monthly_rate: monthlyRate }),
    "No se pudo actualizar la tarifa.",
    translateIssue
  );
  return toSupplier((await response.json()) as SupplierDto);
}

export async function updateSupplierStatus(id: number, status: SupplierStatus): Promise<Supplier> {
  const response = await apiRequest(
    `/suppliers/${id}/status`,
    jsonInit("PATCH", { status }),
    "No se pudo cambiar el estado del proveedor.",
    translateIssue
  );
  return toSupplier((await response.json()) as SupplierDto);
}

export async function deleteSupplier(id: number): Promise<void> {
  await apiRequest(
    `/suppliers/${id}`,
    { method: "DELETE" },
    "No se pudo eliminar el proveedor.",
    translateIssue
  );
}
