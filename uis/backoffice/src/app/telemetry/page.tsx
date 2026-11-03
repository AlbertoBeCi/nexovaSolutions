"use client";

import type { User } from "../../types/auth";
import { RequireAuth } from "../_components/require-auth";
import { TelemetryDashboard } from "./telemetry-dashboard";

function AdminOnly({ currentUser }: { currentUser: User }) {
  if (currentUser.role === "admin") return <TelemetryDashboard />;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Reporte técnico</h1>
      <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        Este reporte está disponible solo para administradores.
      </p>
    </main>
  );
}

export default function TelemetryPage() {
  return <RequireAuth>{(currentUser) => <AdminOnly currentUser={currentUser} />}</RequireAuth>;
}
