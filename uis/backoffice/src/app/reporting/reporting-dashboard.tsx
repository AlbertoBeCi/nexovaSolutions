"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WeeklyOfficeProgramPerformance, WeeklyOfficeProgramPerformanceEntry } from "../../../../../packages/shared/types/business-performance";
import { getWeeklyOfficeProgramPerformance, isIsoMonday } from "../../services/business-performance";
import { RequireAuth } from "../_components/require-auth";

const OFFICE_LABELS = { valencia: "Valencia", miami: "Miami" } as const;
const TITLE = "Reporte Semanal de Desempeño por Oficina y Programa";
const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" });
const INTEGER_FORMAT = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const BUTTON = "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

function WeekSelector({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [value, setValue] = useState(weekStart);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
      event.preventDefault();
      if (!isIsoMonday(value)) {
        setError("Selecciona el lunes de la semana que quieres consultar.");
        return;
      }
      setError(null);
      router.replace("/reporting?week_start=" + value);
    }}>
      <div>
        <label htmlFor="reporting-week" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-200">Semana (lunes)</label>
        <input id="reporting-week" type="date" required value={value} onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined} aria-describedby={error ? "reporting-week-error" : undefined}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50" />
      </div>
      <button type="submit" className={BUTTON}>Consultar semana</button>
      <button type="button" className={BUTTON} onClick={() => router.replace("/reporting")}>Última semana publicada</button>
      {error && <p id="reporting-week-error" role="alert" className="w-full text-sm text-red-700 dark:text-red-300">{error}</p>}
    </form>
  );
}

function KpiTable({ title, description, entries, renderValue, valueLabel }: {
  title: string;
  description: string;
  entries: WeeklyOfficeProgramPerformanceEntry[];
  renderValue: (entry: WeeklyOfficeProgramPerformanceEntry) => string;
  valueLabel: string;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      {entries.length === 0 ? <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">No hay datos publicados para esta semana.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-80 text-left text-sm">
            <caption className="sr-only">{title}: desglose por oficina y programa</caption>
            <thead><tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th scope="col" className="px-2 py-2">Oficina</th>
              <th scope="col" className="px-2 py-2">Programa</th>
              <th scope="col" className="px-2 py-2 text-right">{valueLabel}</th>
            </tr></thead>
            <tbody>{entries.map((entry) => (
              <tr key={entry.office + ":" + entry.programme_id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-2 py-3">{OFFICE_LABELS[entry.office]}</td>
                <th scope="row" className="px-2 py-3 font-medium">{entry.programme_id}</th>
                <td className="px-2 py-3 text-right tabular-nums">{renderValue(entry)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type ReportResult = { key: string; report: WeeklyOfficeProgramPerformance; error?: never } | { key: string; report?: never; error: string };

export function ReportingDashboard({ weekStart }: { weekStart?: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<ReportResult | null>(null);
  const validWeek = weekStart === undefined || isIsoMonday(weekStart);
  const requestKey = (weekStart ?? "latest") + ":" + reloadKey;
  const current = result?.key === requestKey ? result : null;
  const loading = validWeek && current === null;
  const report = validWeek ? current?.report : undefined;
  const error = !validWeek ? "Selecciona el lunes de la semana que quieres consultar." : current?.error;
  const selectorWeek = validWeek ? (weekStart ?? report?.week_start ?? "") : "";

  useEffect(() => {
    if (!validWeek) return;
    let active = true;
    getWeeklyOfficeProgramPerformance(weekStart).then((report) => {
      if (active) setResult({ key: requestKey, report });
    }).catch((reason: unknown) => {
      if (active) setResult({ key: requestKey, error: reason instanceof Error ? reason.message : "No se pudo cargar el reporte de desempeño." });
    });
    return () => { active = false; };
  }, [weekStart, requestKey, validWeek]);

  const end = report ? new Date(report.week_start + "T00:00:00Z") : null;
  if (end) end.setUTCDate(end.getUTCDate() + 6);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 text-zinc-800 sm:px-6 dark:text-zinc-200">
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Desempeño de negocio</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{TITLE}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Inversión en material y entregas de formación por oficina y programa.</p>
        {report && end && <p className="mt-3 text-sm font-medium">Período UTC: <time dateTime={report.week_start}>{DATE_FORMAT.format(new Date(report.week_start + "T00:00:00Z"))}</time>{" — "}<time dateTime={end.toISOString().slice(0, 10)}>{DATE_FORMAT.format(end)}</time></p>}
      </header>
      <WeekSelector key={selectorWeek} weekStart={selectorWeek} />
      <div><button type="button" className={BUTTON} disabled={loading || !validWeek} onClick={() => setReloadKey((key) => key + 1)}>Actualizar reporte</button></div>
      {loading && <p role="status" aria-live="polite">Cargando reporte de desempeño…</p>}
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <p>{error}</p>{validWeek && <button type="button" className={BUTTON} onClick={() => setReloadKey((key) => key + 1)}>Reintentar</button>}
      </div>}
      {report && <>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Valencia se expresa en EUR y Miami en USD. Los importes de ambas monedas se presentan por separado.</p>
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          <KpiTable title="Costo de material por oficina/programa" description="Importe adquirido durante la semana, en la moneda de cada oficina." entries={report.entries} valueLabel="Importe" renderValue={(entry) => new Intl.NumberFormat("es-ES", { style: "currency", currency: entry.currency, currencyDisplay: "code" }).format(entry.total_material_cost)} />
          <KpiTable title="Kits entregados" description="Número de entregas registradas durante la semana." entries={report.entries} valueLabel="Entregas" renderValue={(entry) => INTEGER_FORMAT.format(entry.kits_delivered_count)} />
          <KpiTable title="Frecuencia de escasez" description="Veces que el stock cayó por debajo del mínimo configurado durante la semana." entries={report.entries} valueLabel="Veces" renderValue={(entry) => INTEGER_FORMAT.format(entry.shortage_events_count)} />
          <KpiTable title="Frecuencia de variación de costo" description="Variaciones anómalas del costo del proveedor registradas durante la semana." entries={report.entries} valueLabel="Veces" renderValue={(entry) => INTEGER_FORMAT.format(entry.cost_variance_events_count)} />
        </div>
      </>}
    </main>
  );
}

export function ReportingPageContent({ weekStart }: { weekStart?: string }) {
  return <RequireAuth>{(currentUser) => currentUser.role === "admin" ? <ReportingDashboard weekStart={weekStart} /> : (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">{TITLE}</h1>
      <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Este reporte está disponible solo para administradores.</p>
    </main>
  )}</RequireAuth>;
}
