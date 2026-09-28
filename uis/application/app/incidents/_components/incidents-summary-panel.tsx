/**
 * NEXOVA SOLUTIONS - incidents/_components/incidents-summary-panel.tsx
 * Totales por estado, categoría, origen y sede (GET /api/incidents/summary).
 * Estados de carga y error propios y aislados: un fallo aquí no rompe el
 * resto de la página (la cabecera y la navegación siguen intactas).
 */

"use client";

import { useEffect, useState } from "react";
import { getIncidentsSummary } from "@/lib/incidents-api";
import {
  INCIDENT_BRANCHES,
  INCIDENT_BRANCH_LABELS,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_ORIGINS,
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
  type IncidentSummary,
} from "@/types/incident";

interface QueryResult {
  key: number;
  data: IncidentSummary | null;
  errorMessage: string | null;
}

function SummaryCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
            <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{row.count}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-zinc-200 pt-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Total: {total}
      </p>
    </div>
  );
}

export function IncidentsSummaryPanel() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<QueryResult | null>(null);
  // Sin estado "loading" propio: es "true" mientras la ultima respuesta
  // guardada no sea la de este reloadToken (mismo patron que
  // suppliers-directory.tsx). Evita tener que poner loading=true a mano al
  // reintentar, que el lint de este repo bloquea dentro de un efecto.
  const loading = result?.key !== reloadToken;

  useEffect(() => {
    let cancelled = false;

    getIncidentsSummary()
      .then((data) => {
        if (!cancelled) setResult({ key: reloadToken, data, errorMessage: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            key: reloadToken,
            data: null,
            errorMessage: err instanceof Error ? err.message : "No se pudo cargar el resumen.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (loading && !result) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando resumen...</p>;
  }

  if (!loading && (result?.errorMessage || !result?.data)) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        <p>{result?.errorMessage ?? "No se pudo cargar el resumen."}</p>
        <button
          type="button"
          onClick={() => setReloadToken((token) => token + 1)}
          className="w-fit rounded-md px-3 py-1 font-medium ring-1 ring-red-300 ring-inset hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:ring-red-800 dark:hover:bg-red-900"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!result?.data) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando resumen...</p>;
  }

  const { data } = result;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SummaryCard
        title="Por estado"
        rows={INCIDENT_STATUSES.map((status) => ({
          label: INCIDENT_STATUS_LABELS[status],
          count: data.status[status],
        }))}
      />
      <SummaryCard
        title="Por categoría"
        rows={INCIDENT_CATEGORIES.map((category) => ({
          label: INCIDENT_CATEGORY_LABELS[category],
          count: data.category[category],
        }))}
      />
      <SummaryCard
        title="Por origen"
        rows={INCIDENT_ORIGINS.map((origin) => ({
          label: INCIDENT_ORIGIN_LABELS[origin],
          count: data.origin[origin],
        }))}
      />
      <SummaryCard
        title="Por sede"
        rows={INCIDENT_BRANCHES.map((branch) => ({
          label: INCIDENT_BRANCH_LABELS[branch],
          count: data.branch[branch],
        }))}
      />
    </div>
  );
}
