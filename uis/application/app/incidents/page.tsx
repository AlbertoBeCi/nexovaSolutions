/**
 * NEXOVA SOLUTIONS - incidents/page.tsx
 * Panel de incidencias. La cabecera se prerenderiza; el listado usa
 * useSearchParams (filtros en la URL), así que va dentro de un Suspense.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IncidentsPanel } from "./_components/incidents-panel";

export const metadata: Metadata = {
  title: "Incidencias",
};

export default function IncidentsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Incidencias</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Incidencias del gestor centralizado de Nexova, con filtros por estado, origen y sede.
          </p>
        </div>
        <Link
          href="/incidents/new"
          className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50"
        >
          Registrar incidencia
        </Link>
      </header>

      <Suspense
        fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando incidencias...</p>}
      >
        <IncidentsPanel />
      </Suspense>
    </main>
  );
}
