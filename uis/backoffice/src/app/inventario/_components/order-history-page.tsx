"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getInventoryOrders } from "../../../services/inventory-api";
import {
  INVENTORY_EXIT_TYPE_LABELS,
  INVENTORY_OFFICES,
  INVENTORY_OFFICE_LABELS,
  INVENTORY_ORDER_TYPE_LABELS,
  type InventoryOffice,
  type InventoryOrder,
  type InventoryOrderType,
} from "../../../types/inventory";
import { INVENTORY_ERROR_CLASS } from "./inventory-fields";
import { OrderHistorySummary } from "./order-history-summary";

type OrdersResult =
  | { key: string; status: "success"; orders: InventoryOrder[] }
  | { key: string; status: "error"; message: string };

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function OrderHistoryView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const officeParam = searchParams.get("office");
  const office: InventoryOffice | "" = INVENTORY_OFFICES.includes(officeParam as InventoryOffice)
    ? (officeParam as InventoryOffice)
    : "";
  const typeParam = searchParams.get("tipo");
  const orderType: InventoryOrderType | "" = typeParam === "inbound" || typeParam === "outbound" ? typeParam : "";
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<OrdersResult | null>(null);
  const requestKey = JSON.stringify({ office, reloadToken });
  const loading = result === null || result.key !== requestKey;
  const allOrders = !loading && result.status === "success" ? result.orders : [];
  const orders = orderType ? allOrders.filter((order) => order.orderType === orderType) : allOrders;
  const error = !loading && result.status === "error" ? result.message : null;

  useEffect(() => {
    let cancelled = false;
    getInventoryOrders(office || undefined)
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, status: "success", orders: data });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            status: "error",
            message: cause instanceof Error ? cause.message : "No se pudo cargar el historial.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [office, requestKey]);

  function updateFilter(key: "office" | "tipo", value: string) {
    const query = new URLSearchParams(searchParams.toString());
    if (value) query.set(key, value);
    else query.delete(key);
    const queryString = query.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  return (
    <main className="flex flex-col gap-6 pb-8">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Historial de inventario</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Entradas y salidas, con su producto y persona responsable.</p>
      </header>

      <section aria-label="Filtros del historial" className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Oficina
          <select value={office} onChange={(event) => updateFilter("office", event.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
            <option value="">Todas las oficinas</option>
            {INVENTORY_OFFICES.map((value) => <option key={value} value={value}>{INVENTORY_OFFICE_LABELS[value]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Tipo de movimiento
          <select value={orderType} onChange={(event) => updateFilter("tipo", event.target.value)} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
            <option value="">Entradas y salidas</option>
            <option value="inbound">Entradas</option>
            <option value="outbound">Salidas</option>
          </select>
        </label>
      </section>

      {!loading && !error && <OrderHistorySummary orders={allOrders} />}

      {loading && <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">Cargando historial…</p>}
      {error && (
        <div className={INVENTORY_ERROR_CLASS}>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="mt-2 font-medium underline">Reintentar</button>
        </div>
      )}
      {!loading && !error && orders.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {allOrders.length === 0 ? "Todavía no hay movimientos de inventario." : "No hay movimientos para los filtros seleccionados."}
        </p>
      )}
      {!loading && !error && orders.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3">Fecha</th>
                <th scope="col" className="px-4 py-3">Movimiento</th>
                <th scope="col" className="px-4 py-3">Producto</th>
                <th scope="col" className="px-4 py-3">Cantidad</th>
                <th scope="col" className="px-4 py-3">Oficina</th>
                <th scope="col" className="px-4 py-3">Creado por</th>
                <th scope="col" className="px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {orders.map((order) => (
                <tr key={`${order.orderType}-${order.id}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{INVENTORY_ORDER_TYPE_LABELS[order.orderType]}</td>
                  <td className="px-4 py-3">
                    <span className="block font-medium text-zinc-900 dark:text-zinc-50">{order.asset.name}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">SKU: {order.asset.sku}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-50">{order.orderType === "inbound" ? "+" : "−"}{order.quantity}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{INVENTORY_OFFICE_LABELS[order.office]}</td>
                  <td className="px-4 py-3">
                    {order.creatorName ? (
                      <span className="text-zinc-700 dark:text-zinc-300">{order.creatorName}</span>
                    ) : (
                      <span className="text-zinc-600 dark:text-zinc-400">Usuario no disponible</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {order.orderType === "inbound"
                      ? `Proveedor: ${order.supplier ?? "No indicado"}`
                      : `${order.exitType ? INVENTORY_EXIT_TYPE_LABELS[order.exitType] : "Salida"}${order.assignedTo ? ` · ${order.assignedTo}` : ""}`}
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

export default function InventoryHistoryPage() {
  return <Suspense fallback={<p role="status" className="text-sm text-zinc-500">Cargando historial…</p>}><OrderHistoryView /></Suspense>;
}
