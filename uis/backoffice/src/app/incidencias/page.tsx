/**
 * NEXOVA SOLUTIONS - incidencias/page.tsx
 * Página de análisis de tickets de soporte: sube un CSV a
 * POST /api/incidents/analyze, muestra el resumen devuelto, y permite
 * exportar ese resultado con GET /api/incidents/results/export.
 */

"use client";

import { useState } from "react";
import { analyzeIncidentsCsv, downloadIncidentsResultsCsv } from "../../services/incidents-api";
import type { IncidentsAnalysisSummary } from "../../types/incidents";
import { AnalysisSummaryView } from "./_components/analysis-summary";
import { CsvUploader } from "./_components/csv-uploader";

export default function IncidenciasPage() {
  const [summary, setSummary] = useState<IncidentsAnalysisSummary | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setAnalyzing(true);
    setErrorMessage(null);

    try {
      const result = await analyzeIncidentsCsv(file);
      setSummary(result);
    } catch (err) {
      setSummary(null);
      setErrorMessage(err instanceof Error ? err.message : "No se pudo analizar el archivo.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setErrorMessage(null);

    try {
      await downloadIncidentsResultsCsv();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "No se pudo exportar el resultado del análisis."
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Análisis de incidencias
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sube el CSV de tickets de soporte exportado del helpdesk para ver métricas de
            validez, categoría, estado y satisfacción del cliente.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !summary}
          title={!summary ? "Analiza un archivo primero para poder exportarlo" : undefined}
          className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {exporting ? "Exportando..." : "Exportar resultados a CSV"}
        </button>
      </header>

      <CsvUploader onFileSelected={handleFileSelected} disabled={analyzing} />

      {analyzing && <p className="text-sm text-zinc-500 dark:text-zinc-400">Analizando archivo...</p>}

      {errorMessage && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      {!analyzing && summary && <AnalysisSummaryView summary={summary} />}
    </main>
  );
}
