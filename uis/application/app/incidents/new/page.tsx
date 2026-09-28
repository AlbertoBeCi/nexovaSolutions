/**
 * NEXOVA SOLUTIONS - incidents/new/page.tsx
 * Registro de una incidencia nueva.
 */

import type { Metadata } from "next";
import { IncidentForm } from "../_components/incident-form";

export const metadata: Metadata = {
  title: "Registrar incidencia",
};

export default function NewIncidentPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Registrar incidencia
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Registra una incidencia en el gestor centralizado de Nexova. El estado inicial siempre es
          «Abierta».
        </p>
      </header>

      <IncidentForm />
    </main>
  );
}
