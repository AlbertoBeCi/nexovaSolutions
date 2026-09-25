/**
 * NEXOVA SOLUTIONS - types/supplier.ts
 * Modelo de proveedor que usa la UI (camelCase) y diccionarios de etiquetas.
 * Los códigos de la API (Spain, software, active…) solo viven aquí: la UI
 * siempre muestra la etiqueta en español vía COUNTRY_LABELS / CATEGORY_LABELS /
 * STATUS_LABELS. Contrato de la API en services/api/models.py.
 */

export const SUPPLIER_COUNTRIES = ["Spain", "USA"] as const;
export type SupplierCountry = (typeof SUPPLIER_COUNTRIES)[number];

export const SUPPLIER_CATEGORIES = [
  "software",
  "infrastructure",
  "logistics",
  "marketing",
  "payments",
  "security",
  "other",
] as const;
export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

export const SUPPLIER_STATUSES = ["active", "suspended"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export type SupplierCurrency = "EUR" | "USD";

/** Cada país contrata en una sola moneda (la API rechaza cualquier otra combinación). */
export const COUNTRY_CURRENCY: Record<SupplierCountry, SupplierCurrency> = {
  Spain: "EUR",
  USA: "USD",
};

export const COUNTRY_LABELS: Record<SupplierCountry, string> = {
  Spain: "España",
  USA: "Estados Unidos",
};

export const CATEGORY_LABELS: Record<SupplierCategory, string> = {
  software: "Software",
  infrastructure: "Infraestructura",
  logistics: "Logística",
  marketing: "Marketing",
  payments: "Pagos",
  security: "Seguridad",
  other: "Otros",
};

export const STATUS_LABELS: Record<SupplierStatus, string> = {
  active: "Activo",
  suspended: "Suspendido",
};

export interface Supplier {
  id: number;
  name: string;
  country: SupplierCountry;
  categories: SupplierCategory[];
  monthlyRate: number;
  currency: SupplierCurrency;
  status: SupplierStatus;
  contractRenewalDate: string | null;
  contactEmail: string | null;
  notes: string | null;
  updatedAt: string;
}

/** Datos del formulario de alta: `id` y `updatedAt` los asigna la API. */
export type NewSupplier = Omit<Supplier, "id" | "updatedAt">;

export interface SupplierFilters {
  country: SupplierCountry | null;
  category: SupplierCategory | null;
}

export function isSupplierCountry(value: string | null): value is SupplierCountry {
  return SUPPLIER_COUNTRIES.includes(value as SupplierCountry);
}

export function isSupplierCategory(value: string | null): value is SupplierCategory {
  return SUPPLIER_CATEGORIES.includes(value as SupplierCategory);
}

/** Tarifa con símbolo de moneda, formato español (p. ej. «1.850,00 US$»). */
export function formatMonthlyRate(amount: number, currency: SupplierCurrency): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amount);
}

export function matchesFilters(supplier: Supplier, filters: SupplierFilters): boolean {
  if (filters.country && supplier.country !== filters.country) return false;
  if (filters.category && !supplier.categories.includes(filters.category)) return false;
  return true;
}
