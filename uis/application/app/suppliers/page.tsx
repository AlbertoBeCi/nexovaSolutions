/**
 * NEXOVA SOLUTIONS - suppliers/page.tsx
 * Directorio de proveedores. La cabecera se prerenderiza; el directorio usa
 * useSearchParams (filtros en la URL), así que va dentro de un Suspense.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { SuppliersDirectory } from "./_components/suppliers-directory";

export const metadata: Metadata = {
  title: "Proveedores",
};

export default function SuppliersPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Directorio de proveedores
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Proveedores con contrato en España (EUR) y Estados Unidos (USD), sus tarifas mensuales y
          su estado.
        </p>
      </header>

      <Suspense
        fallback={<p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando proveedores...</p>}
      >
        <SuppliersDirectory />
      </Suspense>
    </main>
  );
}
