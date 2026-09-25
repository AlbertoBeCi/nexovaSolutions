/**
 * NEXOVA SOLUTIONS - suppliers/_components/supplier-filters.tsx
 * Filtros de país y categoría del directorio. Controlado: el estado vive en
 * la URL (?country=&category=) y lo gestiona SuppliersDirectory.
 */

"use client";

import {
  CATEGORY_LABELS,
  COUNTRY_LABELS,
  SUPPLIER_CATEGORIES,
  SUPPLIER_COUNTRIES,
  isSupplierCategory,
  isSupplierCountry,
  type SupplierFilters,
} from "@/types/supplier";

const SELECT_CLASS =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-zinc-50";

export function SupplierFiltersBar({
  filters,
  onChange,
}: {
  filters: SupplierFilters;
  onChange: (filters: SupplierFilters) => void;
}) {
  const hasFilters = filters.country !== null || filters.category !== null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        País
        <select
          value={filters.country ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ ...filters, country: isSupplierCountry(value) ? value : null });
          }}
          className={SELECT_CLASS}
        >
          <option value="">Todos los países</option>
          {SUPPLIER_COUNTRIES.map((country) => (
            <option key={country} value={country}>
              {COUNTRY_LABELS[country]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Categoría
        <select
          value={filters.category ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ ...filters, category: isSupplierCategory(value) ? value : null });
          }}
          className={SELECT_CLASS}
        >
          <option value="">Todas las categorías</option>
          {SUPPLIER_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange({ country: null, category: null })}
          className="w-fit rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:outline-zinc-50"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
