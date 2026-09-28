/**
 * NEXOVA SOLUTIONS - incidents/_components/incidents-panel.tsx
 * Listado de incidencias: los filtros viven en la URL
 * (?status=&origin=&branch=). El cambio de estado es optimista (la fila
 * cambia antes de que responda la API); si el PATCH falla, la fila vuelve
 * al estado anterior y se avisa con un mensaje (aria-live). Paginación en
 * cliente de 25 filas.
 */

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IncidentsApiError, listIncidents, updateIncidentStatus } from "@/lib/incidents-api";
import {
  isIncidentBranch,
  isIncidentOrigin,
  isIncidentStatus,
  type Incident,
  type IncidentFilters,
  type IncidentStatus,
} from "@/types/incident";
import { IncidentFiltersBar } from "./incident-filters";
import { IncidentTable } from "./incident-table";

const PAGE_SIZE = 25;

interface QueryResult {
  key: string;
  incidents: Incident[];
  errorMessage: string | null;
}

interface Notice {
  kind: "error";
  text: string;
}

export function IncidentsPanel() {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const originParam = searchParams.get("origin");
  const branchParam = searchParams.get("branch");
  const filters = useMemo<IncidentFilters>(
    () => ({
      status: isIncidentStatus(statusParam) ? statusParam : null,
      origin: isIncidentOrigin(originParam) ? originParam : null,
      branch: isIncidentBranch(branchParam) ? branchParam : null,
    }),
    [statusParam, originParam, branchParam]
  );

  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${filters.status ?? ""}|${filters.origin ?? ""}|${filters.branch ?? ""}|${reloadToken}`;
  const [result, setResult] = useState<QueryResult | null>(null);
  const loading = result?.key !== requestKey;

  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Vuelve a la primera página cada vez que cambian los filtros o se
  // recarga. Se ajusta durante el render (no en un efecto): el lint de
  // este repo bloquea llamar a setState directamente dentro de un efecto
  // (ver memory-bank/systemPatterns.md), y este es el patrón que React
  // recomienda para "reiniciar un estado cuando cambia otro valor".
  const [page, setPage] = useState(1);
  const [pageResetKey, setPageResetKey] = useState(requestKey);
  if (requestKey !== pageResetKey) {
    setPageResetKey(requestKey);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    listIncidents(filters)
      .then((incidents) => {
        if (!cancelled) setResult({ key: requestKey, incidents, errorMessage: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            incidents: [],
            errorMessage: err instanceof Error ? err.message : "No se pudieron cargar las incidencias.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, filters]);

  function handleFiltersChange(next: IncidentFilters) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status) params.set("status", next.status);
    else params.delete("status");
    if (next.origin) params.set("origin", next.origin);
    else params.delete("origin");
    if (next.branch) params.set("branch", next.branch);
    else params.delete("branch");

    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  function replaceIncident(updated: Incident) {
    setResult(
      (current) =>
        current && {
          ...current,
          incidents: current.incidents.map((incident) => (incident.id === updated.id ? updated : incident)),
        }
    );
  }

  async function handleStatusChange(incident: Incident, nextStatus: IncidentStatus) {
    const previousStatus = incident.status;
    setBusyId(incident.id);
    setNotice(null);

    // Actualización optimista: la fila refleja el cambio antes de que
    // responda la API.
    replaceIncident({ ...incident, status: nextStatus });

    try {
      const updated = await updateIncidentStatus(incident.id, previousStatus, nextStatus);
      replaceIncident(updated);
    } catch (err) {
      // Si el PATCH falla, la fila vuelve a su estado anterior.
      replaceIncident({ ...incident, status: previousStatus });
      setNotice({
        kind: "error",
        text: err instanceof IncidentsApiError ? err.message : "No se pudo cambiar el estado de la incidencia.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const hasFilters = filters.status !== null || filters.origin !== null || filters.branch !== null;
  const incidents = result?.incidents ?? [];
  const count = incidents.length;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageIncidents = incidents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <IncidentFiltersBar filters={filters} onChange={handleFiltersChange} />

      <div aria-live="polite">
        {notice?.kind === "error" && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {notice.text}
          </p>
        )}
      </div>

      {loading && !result && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando incidencias...</p>
      )}

      {!loading && result?.errorMessage && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          <p>{result.errorMessage}</p>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="w-fit rounded-md px-3 py-1 font-medium ring-1 ring-red-300 ring-inset hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:ring-red-800 dark:hover:bg-red-900"
          >
            Reintentar
          </button>
        </div>
      )}

      {result && !result.errorMessage && (
        <section aria-busy={loading} className={`flex flex-col gap-3 ${loading ? "opacity-60" : ""}`}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {loading
              ? "Actualizando..."
              : `${count} ${count === 1 ? "incidencia" : "incidencias"}${hasFilters ? " con los filtros aplicados" : ""}`}
          </p>
          {count > 0 ? (
            <>
              <IncidentTable incidents={pageIncidents} busyId={busyId} onStatusChange={handleStatusChange} />
              {pageCount > 1 && (
                <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((current) => current - 1)}
                    className="rounded-md px-3 py-1.5 font-medium ring-1 ring-zinc-300 ring-inset hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50"
                  >
                    Anterior
                  </button>
                  <span>
                    Página {currentPage} de {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-md px-3 py-1.5 font-medium ring-1 ring-zinc-300 ring-inset hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {hasFilters
                ? "Ningún resultado para estos filtros."
                : "Todavía no hay incidencias registradas."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
