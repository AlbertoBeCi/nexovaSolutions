/**
 * NEXOVA SOLUTIONS - incidents/_components/incident-table.tsx
 * Tabla de incidencias: título/descripción, categoría, origen, sede, fecha
 * de creación y cambio de estado en línea.
 */

"use client";

import {
  INCIDENT_BRANCH_LABELS,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_ORIGIN_LABELS,
  type Incident,
  type IncidentStatus,
} from "@/types/incident";
import { StatusSelect } from "./status-select";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function IncidentTable({
  incidents,
  busyId,
  onStatusChange,
}: {
  incidents: Incident[];
  busyId: number | null;
  onStatusChange: (incident: Incident, nextStatus: IncidentStatus) => void;
}) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">Incidencias registradas</caption>
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Incidencia</th>
            <th scope="col" className="px-4 py-3 font-medium">Categoría</th>
            <th scope="col" className="px-4 py-3 font-medium">Origen</th>
            <th scope="col" className="px-4 py-3 font-medium">Sede</th>
            <th scope="col" className="px-4 py-3 font-medium">Creada</th>
            <th scope="col" className="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {incidents.map((incident) => {
            const busy = busyId === incident.id;
            return (
              <tr key={incident.id} className="align-top">
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{incident.title}</span>
                    <span className="max-w-96 text-xs text-zinc-500 dark:text-zinc-400">
                      {incident.description}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                  {INCIDENT_CATEGORY_LABELS[incident.category]}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                  {INCIDENT_ORIGIN_LABELS[incident.origin]}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                  {INCIDENT_BRANCH_LABELS[incident.branch]}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                  {dateFormatter.format(new Date(incident.createdAt))}
                </td>
                <td className="px-4 py-3">
                  <StatusSelect
                    incidentId={incident.id}
                    status={incident.status}
                    disabled={busy}
                    onChange={(nextStatus) => onStatusChange(incident, nextStatus)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
