"use client";

import { useEffect, useState } from "react";

import type { TelemetryReport } from "../../../../../packages/shared/types/telemetry-report";
import { getTelemetryReport } from "../../services/telemetry-report";

const EVENT_TYPE_LABELS: Record<string, string> = {
  page_viewed: "Página visitada",
  client_request_completed: "Petición completada",
  page_performance_recorded: "Rendimiento de página registrado",
  flow_started: "Flujo iniciado",
  flow_submitted: "Flujo enviado",
  flow_completed: "Flujo completado",
  inbound_order_created: "Entrada de inventario registrada",
  outbound_order_created: "Salida de inventario registrada",
  login_failed: "Inicio de sesión fallido",
  login_succeeded: "Inicio de sesión correcto",
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const numberFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 1,
});

function formatPeriod(value: string): string {
  return `${dateFormatter.format(new Date(value))} UTC`;
}

function MetricSection<T extends object>({
  title,
  description,
  rows,
  emptyMessage,
  rowKey,
  columns,
}: {
  title: string;
  description: string;
  rows: T[];
  emptyMessage: string;
  rowKey: (row: T) => string;
  columns: Array<{ label: string; render: (row: T) => React.ReactNode; align?: "left" | "right" }>;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-zinc-50 px-4 py-5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {columns.map((column) => (
                  <th key={column.label} scope="col" className={`px-3 py-2 ${column.align === "right" ? "text-right" : ""}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  {columns.map((column) => (
                    <td key={column.label} className={`px-3 py-3 text-zinc-700 dark:text-zinc-200 ${column.align === "right" ? "text-right tabular-nums" : ""}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function TelemetryDashboard() {
  const [report, setReport] = useState<TelemetryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getTelemetryReport()
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "No se pudo cargar el reporte técnico.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function refreshReport() {
    setError(null);
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Operaciones de ingeniería</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Reporte técnico de telemetría</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Volumen, errores, latencia y autenticación del sistema.
          </p>
          {report && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Período UTC: <time dateTime={report.period.from}>{formatPeriod(report.period.from)}</time>
              {" — "}
              <time dateTime={report.period.to}>{formatPeriod(report.period.to)}</time>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refreshReport}
          disabled={loading}
          className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? "Actualizando…" : "Actualizar reporte"}
        </button>
      </header>

      {loading && <p role="status" aria-live="polite" className="text-sm text-zinc-500 dark:text-zinc-400">Cargando métricas técnicas…</p>}

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button type="button" onClick={refreshReport} className="rounded-md border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-red-800 dark:hover:bg-red-900">
            Reintentar
          </button>
        </div>
      )}

      {report && (
        <div className="flex flex-col gap-5">
          <MetricSection
            title="Volumen de eventos"
            description="Eventos registrados por día y tipo."
            rows={report.metrics.events_per_day}
            emptyMessage="No hay eventos en este período."
            rowKey={(row) => `${row.date}-${row.event_type}`}
            columns={[
              { label: "Día UTC", render: (row) => row.date },
              { label: "Tipo de evento", render: (row) => EVENT_TYPE_LABELS[row.event_type] ?? "Otro evento técnico" },
              { label: "Eventos", align: "right", render: (row) => numberFormatter.format(row.events) },
            ]}
          />

          <MetricSection
            title="Errores de peticiones"
            description="Errores HTTP y fallos de red observados por el cliente, agrupados por ruta."
            rows={report.metrics.request_error_rate}
            emptyMessage="No hay peticiones para calcular la tasa de errores."
            rowKey={(row) => `${row.date}-${row.route_template}`}
            columns={[
              { label: "Día UTC", render: (row) => row.date },
              { label: "Ruta", render: (row) => <code>{row.route_template}</code> },
              { label: "Peticiones", align: "right", render: (row) => numberFormatter.format(row.requests) },
              { label: "Errores", align: "right", render: (row) => numberFormatter.format(row.errors) },
              { label: "Tasa", align: "right", render: (row) => percentFormatter.format(row.error_rate) },
            ]}
          />

          <MetricSection
            title="Latencia observada"
            description="Media y percentil 95 de la duración de peticiones, en milisegundos."
            rows={report.metrics.latency_by_route}
            emptyMessage="No hay datos de duración válidos para este período."
            rowKey={(row) => `${row.date}-${row.route_template}`}
            columns={[
              { label: "Día UTC", render: (row) => row.date },
              { label: "Ruta", render: (row) => <code>{row.route_template}</code> },
              { label: "Muestras", align: "right", render: (row) => numberFormatter.format(row.samples) },
              { label: "Media", align: "right", render: (row) => numberFormatter.format(row.mean_ms) },
              { label: "P95", align: "right", render: (row) => numberFormatter.format(row.p95_ms) },
            ]}
          />

          <MetricSection
            title="Fallos de inicio de sesión"
            description="Fallos sobre el total de intentos por día."
            rows={report.metrics.auth_failure_rate}
            emptyMessage="No hay intentos de inicio de sesión registrados en este período."
            rowKey={(row) => row.date}
            columns={[
              { label: "Día UTC", render: (row) => row.date },
              { label: "Intentos", align: "right", render: (row) => numberFormatter.format(row.attempts) },
              { label: "Fallos", align: "right", render: (row) => numberFormatter.format(row.failures) },
              { label: "Tasa de fallos", align: "right", render: (row) => percentFormatter.format(row.failure_rate) },
            ]}
          />
        </div>
      )}
    </main>
  );
}
