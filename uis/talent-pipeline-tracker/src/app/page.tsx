"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCandidates } from "../services/api";
import {
  Candidate,
  CandidateStage,
  CandidateStatus,
  stageLabels,
  statusLabels,
} from "../types/candidate";

const SEARCH_DEBOUNCE_MS = 300;

const statusOptions = Object.entries(statusLabels) as [CandidateStatus, string][];
const stageOptions = Object.entries(stageLabels) as [CandidateStage, string][];

function isCandidateStatus(value: string): value is CandidateStatus {
  return value in statusLabels;
}

function isCandidateStage(value: string): value is CandidateStage {
  return value in stageLabels;
}

interface CandidatesQueryResult {
  key: string;
  status: "success" | "error";
  candidates: Candidate[];
  errorMessage: string | null;
}

function CandidatesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get("search") ?? "";
  const urlStatus = searchParams.get("status");
  const urlStage = searchParams.get("stage");
  const status = urlStatus && isCandidateStatus(urlStatus) ? urlStatus : "";
  const stage = urlStage && isCandidateStage(urlStage) ? urlStage : "";
  const requestKey = JSON.stringify({ search: urlSearch, status, stage });

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [queryResult, setQueryResult] = useState<CandidatesQueryResult | null>(null);

  const loading = queryResult === null || queryResult.key !== requestKey;
  const candidates = !loading && queryResult.status === "success" ? queryResult.candidates : [];
  const error = !loading && queryResult.status === "error" ? queryResult.errorMessage : null;

  const updateFilters = useCallback(
    (nextSearch: string, nextStatus: string, nextStage: string) => {
      const params = new URLSearchParams();
      if (nextSearch) params.set("search", nextSearch);
      if (nextStatus) params.set("status", nextStatus);
      if (nextStage) params.set("stage", nextStage);

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    if (searchInput === urlSearch) return;

    const timeoutId = setTimeout(() => {
      updateFilters(searchInput, status, stage);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchInput, urlSearch, status, stage, updateFilters]);

  useEffect(() => {
    let cancelled = false;

    getCandidates({
      search: urlSearch || undefined,
      status: status || undefined,
      stage: stage || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setQueryResult({ key: requestKey, status: "success", candidates: data, errorMessage: null });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setQueryResult({
            key: requestKey,
            status: "error",
            candidates: [],
            errorMessage: err instanceof Error ? err.message : "No se pudo cargar la lista de candidatos",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, urlSearch, status, stage]);

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    updateFilters(searchInput, event.target.value, stage);
  }

  function handleStageChange(event: ChangeEvent<HTMLSelectElement>) {
    updateFilters(searchInput, status, event.target.value);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Nexova - Talent Pipeline
        </h1>
        <Link
          href="/candidates/new"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Registrar candidato
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar por nombre o correo..."
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />

        <select
          value={status}
          onChange={handleStatusChange}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="">Todos los estados</option>
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={stage}
          onChange={handleStageChange}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="">Todas las etapas</option>
          {stageOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </section>

      {loading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando...</p>}

      {!loading && error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && candidates.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No se encontraron candidatos.</p>
      )}

      {!loading && !error && candidates.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Puesto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {candidate.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {candidate.position}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {statusLabels[candidate.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {stageLabels[candidate.stage]}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/candidates/${candidate.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-5xl px-6 py-10 text-sm text-zinc-500">Cargando...</p>}
    >
      <CandidatesPageContent />
    </Suspense>
  );
}
