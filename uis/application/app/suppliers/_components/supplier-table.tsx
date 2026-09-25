/**
 * NEXOVA SOLUTIONS - suppliers/_components/supplier-table.tsx
 * Tabla del directorio: nombre, país, categorías, tarifa (editable), estado
 * (insignia) y acciones rápidas (activar/suspender, eliminar).
 */

"use client";

import {
  CATEGORY_LABELS,
  COUNTRY_LABELS,
  STATUS_LABELS,
  type Supplier,
} from "@/types/supplier";
import { RateEditor } from "./rate-editor";
import { StatusBadge } from "./status-badge";

const renewalFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  // La fecha llega como YYYY-MM-DD (sin hora): se formatea en UTC para no
  // mostrar el día anterior en husos horarios negativos (sede de Miami).
  timeZone: "UTC",
});

const ACTION_BUTTON_CLASS =
  "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:outline-zinc-50";

export function SupplierTable({
  suppliers,
  busyId,
  onSaveRate,
  onToggleStatus,
  onDelete,
}: {
  suppliers: Supplier[];
  busyId: number | null;
  onSaveRate: (supplier: Supplier, monthlyRate: number) => Promise<void>;
  onToggleStatus: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">Directorio de proveedores</caption>
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Nombre</th>
            <th scope="col" className="px-4 py-3 font-medium">País</th>
            <th scope="col" className="px-4 py-3 font-medium">Categorías</th>
            <th scope="col" className="px-4 py-3 font-medium">Tarifa mensual</th>
            <th scope="col" className="px-4 py-3 font-medium">Estado</th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {suppliers.map((supplier) => {
            const busy = busyId === supplier.id;
            const nextStatus = supplier.status === "active" ? "suspended" : "active";
            return (
              <tr key={supplier.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{supplier.name}</span>
                    {supplier.contactEmail && (
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">{supplier.contactEmail}</span>
                    )}
                    {supplier.contractRenewalDate && (
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        Renovación: {renewalFormatter.format(new Date(supplier.contractRenewalDate))}
                      </span>
                    )}
                    {supplier.notes && (
                      <span className="max-w-64 text-xs text-zinc-500 dark:text-zinc-400">{supplier.notes}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                  {COUNTRY_LABELS[supplier.country]}
                </td>
                <td className="px-4 py-3">
                  <ul className="flex flex-wrap gap-1">
                    {supplier.categories.map((category) => (
                      <li
                        key={category}
                        className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {CATEGORY_LABELS[category]}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3">
                  <RateEditor
                    supplier={supplier}
                    disabled={busy}
                    onSave={(monthlyRate) => onSaveRate(supplier, monthlyRate)}
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={supplier.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(supplier)}
                      disabled={busy}
                      aria-label={`${nextStatus === "active" ? "Activar" : "Suspender"} a ${supplier.name}`}
                      title={`Cambiar a «${STATUS_LABELS[nextStatus]}»`}
                      className={`${ACTION_BUTTON_CLASS} text-zinc-700 ring-zinc-300 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800`}
                    >
                      {nextStatus === "active" ? "Activar" : "Suspender"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(supplier)}
                      disabled={busy}
                      aria-label={`Eliminar a ${supplier.name}`}
                      className={`${ACTION_BUTTON_CLASS} text-red-700 ring-red-200 hover:bg-red-50 dark:text-red-300 dark:ring-red-900 dark:hover:bg-red-950`}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
