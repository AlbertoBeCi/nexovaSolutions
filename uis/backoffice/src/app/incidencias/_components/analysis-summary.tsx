/**
 * NEXOVA SOLUTIONS - incidencias/_components/analysis-summary.tsx
 * Presenta el resumen devuelto por POST /api/incidents/analyze: métricas
 * generales, desglose de registros inválidos por regla, desglose por
 * categoría/estado, e índice de satisfacción de los tickets cerrados.
 */

import type { IncidentsAnalysisSummary } from "../../../types/incidents";

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "good" | "bad" }) {
  const toneClasses =
    tone === "good"
      ? "text-green-700 dark:text-green-400"
      : tone === "bad"
        ? "text-red-700 dark:text-red-400"
        : "text-zinc-900 dark:text-zinc-50";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </span>
      <span className={`text-2xl font-semibold ${toneClasses}`}>{value}</span>
    </div>
  );
}

function GroupTable({ title, groups }: { title: string; groups: IncidentsAnalysisSummary["categories"] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2">Grupo</th>
              <th className="px-4 py-2 text-right">Cantidad</th>
              <th className="px-4 py-2 text-right">Porcentaje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {groups.map((group) => (
              <tr key={group.code}>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">{group.label}</td>
                <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">{group.count}</td>
                <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {group.percentage.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalysisSummaryView({ summary }: { summary: IncidentsAnalysisSummary }) {
  const invalidRulesWithIssues = summary.invalidBreakdown.filter((rule) => rule.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Resultado del análisis: {summary.sourceFile}
        </h2>
        {summary.analyzedAt && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Analizado el {new Date(summary.analyzedAt).toLocaleString("es-ES")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total de registros" value={summary.totalRecords} />
        <MetricCard label="Registros válidos" value={summary.validRecords} tone="good" />
        <MetricCard label="Registros inválidos" value={summary.invalidRecords} tone="bad" />
      </div>

      {summary.invalidRecords > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p className="font-medium">
            Se encontraron {summary.invalidRecords} registro(s) inválido(s) en el archivo:
          </p>
          <ul className="flex flex-col gap-1">
            {invalidRulesWithIssues.length > 0 ? (
              invalidRulesWithIssues.map((rule) => (
                <li key={rule.rule} className="flex justify-between gap-4">
                  <span>{rule.label}</span>
                  <span className="font-semibold">{rule.count}</span>
                </li>
              ))
            ) : (
              <li>No se pudo determinar el detalle por regla.</li>
            )}
          </ul>
        </div>
      )}

      <GroupTable title="Desglose por categoría (registros válidos)" groups={summary.categories} />
      <GroupTable title="Desglose por estado (registros válidos)" groups={summary.statuses} />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Índice de satisfacción (tickets cerrados)
        </h3>
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {summary.satisfaction.scoredTickets} de {summary.satisfaction.closedTickets} tickets cerrados
            tienen puntuación registrada. Promedio:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {summary.satisfaction.averageScore.toFixed(2)} / 5.00
            </span>
          </p>
          <div className="grid grid-cols-5 gap-2">
            {summary.satisfaction.distribution.map((entry) => (
              <div
                key={entry.score}
                className="flex flex-col items-center gap-1 rounded-lg bg-zinc-50 px-2 py-3 dark:bg-zinc-900"
              >
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Puntuación {entry.score}</span>
                <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
