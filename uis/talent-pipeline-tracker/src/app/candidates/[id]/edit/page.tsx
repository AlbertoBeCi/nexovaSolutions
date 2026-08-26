/**
 * NEXOVA SOLUTIONS - candidates/[id]/edit/page.tsx
 * Edición de los datos personales/profesionales de un candidato existente.
 * Status y stage no se tocan aquí: se gestionan desde la ficha ([id]/page.tsx).
 */

"use client";

import { Suspense, use, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { getCandidateById, updateCandidate } from "../../../../services/api";
import type { Candidate } from "../../../../types/candidate";
import {
  CandidateFields,
  EMPTY_CANDIDATE_FIELDS,
  toCandidateInput,
} from "../../_components/candidate-fields";
import type { CandidateFieldsValue } from "../../_components/candidate-fields";

/** Convierte el candidato cargado al shape de texto que espera el formulario
 *  (los campos opcionales `null` se muestran como cadena vacía). */
function toFieldsValue(candidate: Candidate): CandidateFieldsValue {
  return {
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    position: candidate.position,
    linkedinUrl: candidate.linkedinUrl ?? "",
    resumeUrl: candidate.resumeUrl ?? "",
    yearsOfExperience: String(candidate.yearsOfExperience),
  };
}

interface LoadedCandidate {
  id: string;
  outcome: "found" | "not-found" | "error";
  candidate: Candidate | null;
  errorMessage: string | null;
}

function EditCandidateContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [loaded, setLoaded] = useState<LoadedCandidate | null>(null);
  const [fields, setFields] = useState<CandidateFieldsValue>(EMPTY_CANDIDATE_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loading = loaded === null || loaded.id !== id;

  useEffect(() => {
    let cancelled = false;

    getCandidateById(id)
      .then((candidate) => {
        if (cancelled) return;
        if (candidate === null) {
          setLoaded({ id, outcome: "not-found", candidate: null, errorMessage: null });
        } else {
          setLoaded({ id, outcome: "found", candidate, errorMessage: null });
          setFields(toFieldsValue(candidate));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoaded({
          id,
          outcome: "error",
          candidate: null,
          errorMessage: err instanceof Error ? err.message : "No se pudo cargar el candidato",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Guarda los cambios con PUT y refresca el formulario con la respuesta
   *  del servidor (por si normaliza algún valor). */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await updateCandidate(id, toCandidateInput(fields));
      setLoaded((prev) => (prev && prev.outcome === "found" ? { ...prev, candidate: updated } : prev));
      setFields(toFieldsValue(updated));
      setSuccessMessage("Los cambios se guardaron correctamente.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo actualizar el candidato");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <Link
        href={`/candidates/${id}`}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Volver a la ficha
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Editar candidato</h1>

      {loading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando...</p>}

      {!loading && loaded.outcome === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loaded.errorMessage}
        </p>
      )}

      {!loading && loaded.outcome === "not-found" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No se encontró el candidato.</p>
      )}

      {!loading && loaded.outcome === "found" && (
        <>
          {successMessage && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
              {successMessage}
            </p>
          )}

          {errorMessage && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {errorMessage}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <CandidateFields value={fields} onChange={setFields} disabled={submitting} />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {submitting ? "Guardando..." : "Guardar cambios"}
              </button>

              <Link
                href={`/candidates/${id}`}
                className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </>
      )}
    </main>
  );
}

export default function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-2xl px-6 py-10 text-sm text-zinc-500">Cargando...</p>}
    >
      <EditCandidateContent params={params} />
    </Suspense>
  );
}
