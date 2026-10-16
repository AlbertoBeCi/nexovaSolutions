"use client";

import {
  INVENTORY_OFFICES,
  INVENTORY_OFFICE_LABELS,
  type InventoryAsset,
  type InventoryOffice,
} from "../../../types/inventory";

export const INVENTORY_FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-zinc-50";
export const INVENTORY_LABEL_CLASS =
  "flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300";
export const INVENTORY_BUTTON_CLASS =
  "inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50";
export const INVENTORY_SECONDARY_BUTTON_CLASS =
  "inline-flex w-fit items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
export const INVENTORY_ERROR_CLASS =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
export const INVENTORY_SUCCESS_CLASS =
  "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";

export function ProductSelect({
  products,
  value,
  onChange,
  disabled,
}: {
  products: InventoryAsset[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className={INVENTORY_LABEL_CLASS}>
      Producto
      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={INVENTORY_FIELD_CLASS}
      >
        <option value="">Selecciona un producto</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name} · {product.sku} · {INVENTORY_OFFICE_LABELS[product.office]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OfficeSelect({
  value,
  onChange,
  disabled,
}: {
  value: InventoryOffice;
  onChange: (value: InventoryOffice) => void;
  disabled: boolean;
}) {
  return (
    <label className={INVENTORY_LABEL_CLASS}>
      Oficina del movimiento
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as InventoryOffice)}
        disabled={disabled}
        className={INVENTORY_FIELD_CLASS}
      >
        {INVENTORY_OFFICES.map((office) => (
          <option key={office} value={office}>
            {INVENTORY_OFFICE_LABELS[office]}
          </option>
        ))}
      </select>
    </label>
  );
}
