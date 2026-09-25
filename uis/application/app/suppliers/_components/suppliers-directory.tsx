/**
 * NEXOVA SOLUTIONS - suppliers/_components/suppliers-directory.tsx
 * Directorio de proveedores: los filtros viven en la URL (?country=&category=)
 * y cada cambio vuelve a pedir GET /suppliers sin recargar la página. Las
 * acciones rápidas sustituyen la fila con la respuesta de la API, así que la
 * insignia y la tarifa cambian en cuanto la petición tiene éxito.
 */

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  deleteSupplier,
  listSuppliers,
  updateSupplierRate,
  updateSupplierStatus,
} from "@/lib/suppliers-api";
import {
  STATUS_LABELS,
  formatMonthlyRate,
  isSupplierCategory,
  isSupplierCountry,
  matchesFilters,
  type Supplier,
  type SupplierFilters,
} from "@/types/supplier";
import { SupplierFiltersBar } from "./supplier-filters";
import { SupplierForm } from "./supplier-form";
import { SupplierTable } from "./supplier-table";

interface QueryResult {
  key: string;
  suppliers: Supplier[];
  errorMessage: string | null;
}

interface Notice {
  kind: "success" | "error";
  text: string;
}

export function SuppliersDirectory() {
  const searchParams = useSearchParams();
  const countryParam = searchParams.get("country");
  const categoryParam = searchParams.get("category");
  const filters = useMemo<SupplierFilters>(
    () => ({
      country: isSupplierCountry(countryParam) ? countryParam : null,
      category: isSupplierCategory(categoryParam) ? categoryParam : null,
    }),
    [countryParam, categoryParam]
  );

  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${filters.country ?? ""}|${filters.category ?? ""}|${reloadToken}`;
  const [result, setResult] = useState<QueryResult | null>(null);
  const loading = result?.key !== requestKey;

  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let cancelled = false;

    listSuppliers(filters)
      .then((suppliers) => {
        if (!cancelled) setResult({ key: requestKey, suppliers, errorMessage: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            suppliers: [],
            errorMessage:
              err instanceof Error ? err.message : "No se pudo cargar el directorio de proveedores.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, filters]);

  function handleFiltersChange(next: SupplierFilters) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.country) params.set("country", next.country);
    else params.delete("country");
    if (next.category) params.set("category", next.category);
    else params.delete("category");

    const query = params.toString();
    // Integrado con el router de Next: useSearchParams se actualiza sin recargar.
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  function updateSuppliers(transform: (suppliers: Supplier[]) => Supplier[]) {
    setResult((current) => current && { ...current, suppliers: transform(current.suppliers) });
  }

  function replaceSupplier(updated: Supplier) {
    updateSuppliers((suppliers) => suppliers.map((s) => (s.id === updated.id ? updated : s)));
  }

  /** Propaga el error a RateEditor para que lo muestre en la propia fila. */
  async function handleSaveRate(supplier: Supplier, monthlyRate: number) {
    const updated = await updateSupplierRate(supplier.id, monthlyRate);
    replaceSupplier(updated);
    setNotice({
      kind: "success",
      text: `Tarifa de ${updated.name} actualizada a ${formatMonthlyRate(updated.monthlyRate, updated.currency)}.`,
    });
  }

  async function handleToggleStatus(supplier: Supplier) {
    const nextStatus = supplier.status === "active" ? "suspended" : "active";
    setBusyId(supplier.id);
    setNotice(null);
    try {
      const updated = await updateSupplierStatus(supplier.id, nextStatus);
      replaceSupplier(updated);
      setNotice({
        kind: "success",
        text: `${updated.name} ahora está «${STATUS_LABELS[updated.status]}».`,
      });
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "No se pudo cambiar el estado del proveedor.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(supplier: Supplier) {
    if (!window.confirm(`¿Eliminar a ${supplier.name}? Esta acción no se puede deshacer.`)) return;

    setBusyId(supplier.id);
    setNotice(null);
    try {
      await deleteSupplier(supplier.id);
      updateSuppliers((suppliers) => suppliers.filter((s) => s.id !== supplier.id));
      setNotice({ kind: "success", text: `${supplier.name} se ha eliminado del directorio.` });
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "No se pudo eliminar el proveedor.",
      });
    } finally {
      setBusyId(null);
    }
  }

  function handleCreated(supplier: Supplier) {
    setShowForm(false);
    if (matchesFilters(supplier, filters)) {
      updateSuppliers((suppliers) => [...suppliers, supplier]);
      setNotice({ kind: "success", text: `${supplier.name} se ha registrado.` });
    } else {
      setNotice({
        kind: "success",
        text: `${supplier.name} se ha registrado, pero no aparece en la lista porque no coincide con los filtros activos.`,
      });
    }
  }

  const hasFilters = filters.country !== null || filters.category !== null;
  const suppliers = result?.suppliers ?? [];
  const count = suppliers.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SupplierFiltersBar filters={filters} onChange={handleFiltersChange} />
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setShowForm(true);
            }}
            className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50"
          >
            Registrar proveedor
          </button>
        )}
      </div>

      {showForm && <SupplierForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />}

      <div aria-live="polite">
        {notice?.kind === "success" && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            {notice.text}
          </p>
        )}
      </div>
      {notice?.kind === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {notice.text}
        </p>
      )}

      {loading && !result && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando proveedores...</p>
      )}

      {!loading && result?.errorMessage && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          <p>{result.errorMessage}</p>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="w-fit rounded-md px-3 py-1 font-medium ring-1 ring-red-300 ring-inset hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:ring-red-800 dark:hover:bg-red-900"
          >
            Reintentar
          </button>
        </div>
      )}

      {result && !result.errorMessage && (
        <section aria-busy={loading} className={`flex flex-col gap-3 ${loading ? "opacity-60" : ""}`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {loading
              ? "Actualizando..."
              : `${count} ${count === 1 ? "proveedor" : "proveedores"}${hasFilters ? " con los filtros aplicados" : ""}`}
          </p>
          {count > 0 ? (
            <SupplierTable
              suppliers={suppliers}
              busyId={busyId}
              onSaveRate={handleSaveRate}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {hasFilters
                ? "Ningún proveedor coincide con los filtros seleccionados."
                : "Todavía no hay proveedores registrados."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
