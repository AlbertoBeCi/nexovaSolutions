/**
 * NEXOVA SOLUTIONS - incidents/_components/incident-filters.tsx
 * Filtros de estado, origen y sede del listado. Controlado: el estado vive
 * en la URL (?status=&origin=&branch=) y lo gestiona IncidentsPanel.
 */

"use client";

import {
  INCIDENT_BRANCHES,
  INCIDENT_BRANCH_LABELS,
  INCIDENT_ORIGINS,
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
  isIncidentBranch,
  isIncidentOrigin,
  isIncidentStatus,
  type IncidentFilters,
} from "@/types/incident";

const SELECT_CLASS =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-zinc-50";

export function IncidentFiltersBar({
  filters,
  onChange,
}: {
  filters: IncidentFilters;
  onChange: (filters: IncidentFilters) => void;
}) {
  const hasFilters = filters.status !== null || filters.origin !== null || filters.branch !== null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Estado
        <select
          value={filters.status ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ ...filters, status: isIncidentStatus(value) ? value : null });
          }}
          className={SELECT_CLASS}
        >
          <option value="">Todos los estados</option>
          {INCIDENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {INCIDENT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Origen
        <select
          value={filters.origin ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ ...filters, origin: isIncidentOrigin(value) ? value : null });
          }}
          className={SELECT_CLASS}
        >
          <option value="">Todos los orígenes</option>
          {INCIDENT_ORIGINS.map((origin) => (
            <option key={origin} value={origin}>
              {INCIDENT_ORIGIN_LABELS[origin]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Sede
        <select
          value={filters.branch ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ ...filters, branch: isIncidentBranch(value) ? value : null });
          }}
          className={SELECT_CLASS}
        >
          <option value="">Todas las sedes</option>
          {INCIDENT_BRANCHES.map((branch) => (
            <option key={branch} value={branch}>
              {INCIDENT_BRANCH_LABELS[branch]}
            </option>
          ))}
        </select>
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange({ status: null, origin: null, branch: null })}
          className="w-fit rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:outline-zinc-50"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
