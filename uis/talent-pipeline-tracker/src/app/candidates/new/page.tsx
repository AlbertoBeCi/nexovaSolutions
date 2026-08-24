"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { createCandidate, updateCandidateStatusStage } from "../../../services/api";
import { CandidateStage, CandidateStatus, stageLabels, statusLabels } from "../../../types/candidate";
import {
  CandidateFields,
  EMPTY_CANDIDATE_FIELDS,
  toCandidateInput,
} from "../_components/candidate-fields";
import type { CandidateFieldsValue } from "../_components/candidate-fields";

const statusOptions = Object.entries(statusLabels) as [CandidateStatus, string][];
const stageOptions = Object.entries(stageLabels) as [CandidateStage, string][];

const DEFAULT_STATUS: CandidateStatus = "received";
const DEFAULT_STAGE: CandidateStage = "pending";

export default function NewCandidatePage() {
  const [fields, setFields] = useState<CandidateFieldsValue>(EMPTY_CANDIDATE_FIELDS);
  const [status, setStatus] = useState<CandidateStatus>(DEFAULT_STATUS);
  const [stage, setStage] = useState<CandidateStage>(DEFAULT_STAGE);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCreatedId(null);

    try {
      const created = await createCandidate(toCandidateInput(fields));
      const finalCandidate =
        status !== created.status || stage !== created.stage
          ? await updateCandidateStatusStage(created.id, { status, stage })
          : created;

      setCreatedId(finalCandidate.id);
      setSuccessMessage(`Candidato "${finalCandidate.name}" creado correctamente.`);
      setFields(EMPTY_CANDIDATE_FIELDS);
      setStatus(DEFAULT_STATUS);
      setStage(DEFAULT_STAGE);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo crear el candidato");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Volver al listado
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Registrar candidato</h1>

      {successMessage && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {successMessage}{" "}
          {createdId && (
            <Link href={`/candidates/${createdId}`} className="font-medium underline">
              Ver ficha
            </Link>
          )}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Estado inicial
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as CandidateStatus)}
              disabled={submitting}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Etapa inicial
            </label>
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value as CandidateStage)}
              disabled={submitting}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {stageOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Guardando..." : "Registrar candidato"}
        </button>
      </form>
    </main>
  );
}
