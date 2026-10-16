"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getInventoryProducts } from "../../../services/inventory-api";
import {
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_OFFICES,
  INVENTORY_OFFICE_LABELS,
  type InventoryAsset,
  type InventoryOffice,
} from "../../../types/inventory";
import { INVENTORY_ERROR_CLASS, INVENTORY_SECONDARY_BUTTON_CLASS } from "./inventory-fields";
import { StockIndicator } from "./stock-indicator";

type ProductsResult =
  | { key: string; status: "success"; products: InventoryAsset[] }
  | { key: string; status: "error"; message: string };

function ProductsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const officeParam = searchParams.get("office");
  const office: InventoryOffice | "" = INVENTORY_OFFICES.includes(officeParam as InventoryOffice)
    ? (officeParam as InventoryOffice)
    : "";
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<ProductsResult | null>(null);
  const requestKey = JSON.stringify({ office, reloadToken });
  const loading = result === null || result.key !== requestKey;
  const products = !loading && result.status === "success" ? result.products : [];
  const error = !loading && result.status === "error" ? result.message : null;

  useEffect(() => {
    let cancelled = false;
    getInventoryProducts(office || undefined)
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, status: "success", products: data });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            status: "error",
            message: cause instanceof Error ? cause.message : "No se pudo cargar el inventario.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [office, requestKey]);

  function setOffice(value: string) {
    const query = new URLSearchParams(searchParams.toString());
    if (value) query.set("office", value);
    else query.delete("office");
    const queryString = query.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  return (
    <main className="flex flex-col gap-6 pb-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Inventario</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Consulta las existencias actuales y registra los movimientos de productos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={INVENTORY_SECONDARY_BUTTON_CLASS} href="/backoffice/inventory/orders/inbound">
            Registrar entrada
          </Link>
          <Link className={INVENTORY_SECONDARY_BUTTON_CLASS} href="/backoffice/inventory/orders/outbound">
            Registrar salida
          </Link>
          <Link className={INVENTORY_SECONDARY_BUTTON_CLASS} href="/backoffice/inventory/orders">
            Ver historial
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:max-w-xs">
        <label htmlFor="inventory-office-filter" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Oficina
        </label>
        <select
          id="inventory-office-filter"
          value={office}
          onChange={(event) => setOffice(event.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="">Todas las oficinas</option>
          {INVENTORY_OFFICES.map((value) => (
            <option key={value} value={value}>{INVENTORY_OFFICE_LABELS[value]}</option>
          ))}
        </select>
      </div>

      {loading && <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">Cargando productos…</p>}
      {error && (
        <div className={INVENTORY_ERROR_CLASS}>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="mt-2 font-medium underline">
            Reintentar
          </button>
        </div>
      )}
      {!loading && !error && products.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay productos para la oficina seleccionada.</p>
      )}
      {!loading && !error && products.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3">Producto</th>
                <th scope="col" className="px-4 py-3">Categoría</th>
                <th scope="col" className="px-4 py-3">Oficina</th>
                <th scope="col" className="px-4 py-3">Stock actual</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <span className="block font-medium text-zinc-900 dark:text-zinc-50">{product.name}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">SKU: {product.sku}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{INVENTORY_CATEGORY_LABELS[product.category]}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{INVENTORY_OFFICE_LABELS[product.office]}</td>
                  <td className="px-4 py-3"><StockIndicator stock={product.currentStock} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link className="font-medium text-blue-700 hover:underline dark:text-blue-400" href={`/backoffice/inventory/orders/inbound?producto=${product.id}`}>Entrada</Link>
                      <Link className="font-medium text-blue-700 hover:underline dark:text-blue-400" href={`/backoffice/inventory/orders/outbound?producto=${product.id}`}>Salida</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default function InventoryProductsPage() {
  return <Suspense fallback={<p role="status" className="text-sm text-zinc-500">Cargando inventario…</p>}><ProductsView /></Suspense>;
}
