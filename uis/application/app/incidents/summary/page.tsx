/**
 * NEXOVA SOLUTIONS - incidents/summary/page.tsx
 * Resumen de incidencias por estado, categoría, origen y sede.
 */

import type { Metadata } from "next";
import { IncidentsSummaryPanel } from "../_components/incidents-summary-panel";

export const metadata: Metadata = {
  title: "Resumen de incidencias",
};

export default function IncidentsSummaryPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Resumen de incidencias
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Totales del gestor centralizado de Nexova por estado, categoría, origen y sede.
        </p>
      </header>

      <IncidentsSummaryPanel />
    </main>
  );
}
