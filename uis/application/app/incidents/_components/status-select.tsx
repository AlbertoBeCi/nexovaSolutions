/**
 * NEXOVA SOLUTIONS - incidents/_components/status-select.tsx
 * Cambio de estado en línea. Solo ofrece las transiciones válidas desde el
 * estado actual (nextStatusOptions, ver types/incident.ts); los estados
 * finales (resuelta/descartada) se muestran como insignia bloqueada, sin
 * selector.
 */

"use client";

import {
  INCIDENT_STATUS_LABELS,
  isFinalStatus,
  isIncidentStatus,
  nextStatusOptions,
  type IncidentStatus,
} from "@/types/incident";

const STATUS_STYLES: Record<IncidentStatus, string> = {
  open: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
  in_progress:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  resolved:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  discarded: "bg-zinc-100 text-zinc-600 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
};

export function StatusSelect({
  incidentId,
  status,
  disabled,
  onChange,
}: {
  incidentId: number;
  status: IncidentStatus;
  disabled: boolean;
  onChange: (nextStatus: IncidentStatus) => void;
}) {
  if (isFinalStatus(status)) {
    return (
      <span
        title="Estado final: no admite más cambios"
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
        {INCIDENT_STATUS_LABELS[status]}
      </span>
    );
  }

  const nextOptions = nextStatusOptions(status);

  return (
    <select
      aria-label={`Cambiar el estado de la incidencia #${incidentId} (actualmente ${INCIDENT_STATUS_LABELS[status]})`}
      value={status}
      disabled={disabled}
      onChange={(event) => {
        const value = event.target.value;
        if (isIncidentStatus(value) && value !== status) onChange(value);
      }}
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-zinc-50"
    >
      <option value={status}>{INCIDENT_STATUS_LABELS[status]}</option>
      {nextOptions.map((option) => (
        <option key={option} value={option}>
          {INCIDENT_STATUS_LABELS[option]}
        </option>
      ))}
    </select>
  );
}
