"use client";

import { useMemo } from "react";

import type { InventoryOrder } from "../../../types/inventory";
import { summarizeInventoryOrders } from "../_lib/inventory-order-summary";

export function OrderHistorySummary({ orders }: { orders: InventoryOrder[] }) {
  const summary = useMemo(() => summarizeInventoryOrders(orders), [orders]);

  return (
    <section aria-label="Resumen de movimientos" className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Entradas</h2>
        <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{summary.inboundQuantity.toLocaleString("es-ES")} unidades</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{summary.inboundCount} movimientos · Valencia {summary.byOffice.Valencia.inbound} · Miami {summary.byOffice.Miami.inbound}</p>
      </article>
      <article className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Salidas</h2>
        <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{summary.outboundQuantity.toLocaleString("es-ES")} unidades</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{summary.outboundCount} movimientos · Valencia {summary.byOffice.Valencia.outbound} · Miami {summary.byOffice.Miami.outbound}</p>
      </article>
    </section>
  );
}
