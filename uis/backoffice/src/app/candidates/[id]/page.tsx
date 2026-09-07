/**
 * NEXOVA SOLUTIONS - candidates/[id]/page.tsx
 * Ficha de detalle de un candidato: datos personales, cambio rápido de
 * estado/etapa y gestión de notas internas. Cada acción es optimista solo
 * tras confirmar la respuesta de la API (no hay actualización optimista real).
 */

"use client";

import { Suspense, use, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import {
  addCandidateNote,
  deleteCandidateNote,
  getCandidateById,
  getCandidateNotes,
  updateCandidateStatusStage,
} from "../../../services/api";
import {
  Candidate,
  CandidateNote,
  CandidateStage,
  CandidateStatus,
  stageLabels,
  statusLabels,
} from "../../../types/candidate";

const statusOptions = Object.entries(statusLabels) as [CandidateStatus, string][];
const stageOptions = Object.entries(stageLabels) as [CandidateStage, string][];

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Carga de datos ─────────────────────────────────────────────────

interface LoadedData {
  id: string;
  outcome: "found" | "not-found" | "error";
  candidate: Candidate | null;
  notes: CandidateNote[];
  errorMessage: string | null;
}

function sortNotesByDateDesc(notes: CandidateNote[]): CandidateNote[] {
  return [...notes].sort((a, b) => b.date.getTime() - a.date.getTime());
}

function CandidateDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [loaded, setLoaded] = useState<LoadedData | null>(null);
  const [savingField, setSavingField] = useState<"status" | "stage" | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // `loaded === null` es la primera carga; `loaded.id !== id` cubre la
  // navegación entre fichas sin desmontar el componente (misma ruta dinámica).
  const loading = loaded === null || loaded.id !== id;

  useEffect(() => {
    let cancelled = false;

    Promise.all([getCandidateById(id), getCandidateNotes(id)])
      .then(([candidate, notes]) => {
        if (cancelled) return;
        if (candidate === null) {
          setLoaded({ id, outcome: "not-found", candidate: null, notes: [], errorMessage: null });
        } else {
          setLoaded({
            id,
            outcome: "found",
            candidate,
            notes: sortNotesByDateDesc(notes),
            errorMessage: null,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoaded({
          id,
          outcome: "error",
          candidate: null,
          notes: [],
          errorMessage:
            err instanceof Error ? err.message : "No se pudo cargar la información del candidato",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ─── Acciones ───────────────────────────────────────────────────

  /** Persiste el nuevo estado vía PATCH y sincroniza la UI con la respuesta del servidor. */
  async function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as CandidateStatus;
    setSavingField("status");
    setActionError(null);

    try {
      const updated = await updateCandidateStatusStage(id, { status: nextStatus });
      setLoaded((prev) => (prev && prev.outcome === "found" ? { ...prev, candidate: updated } : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo actualizar el estado del candidato");
    } finally {
      setSavingField(null);
    }
  }

  /** Persiste la nueva etapa vía PATCH y sincroniza la UI con la respuesta del servidor. */
  async function handleStageChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextStage = event.target.value as CandidateStage;
    setSavingField("stage");
    setActionError(null);

    try {
      const updated = await updateCandidateStatusStage(id, { stage: nextStage });
      setLoaded((prev) => (prev && prev.outcome === "found" ? { ...prev, candidate: updated } : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo actualizar la etapa del candidato");
    } finally {
      setSavingField(null);
    }
  }

  /** Añade la nota al inicio de la lista (más reciente primero) sin refetch completo. */
  async function handleAddNote() {
    const trimmedText = noteText.trim();
    if (trimmedText === "") return;

    setAddingNote(true);
    setActionError(null);

    try {
      const newNote = await addCandidateNote(id, trimmedText);
      setLoaded((prev) =>
        prev && prev.outcome === "found" ? { ...prev, notes: [newNote, ...prev.notes] } : prev
      );
      setNoteText("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo agregar la nota");
    } finally {
      setAddingNote(false);
    }
  }

  /** Borra la nota en el servidor y la retira de la lista local por id. */
  async function handleDeleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    setActionError(null);

    try {
      await deleteCandidateNote(id, noteId);
      setLoaded((prev) =>
        prev && prev.outcome === "found"
          ? { ...prev, notes: prev.notes.filter((note) => note.id !== noteId) }
          : prev
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo borrar la nota");
    } finally {
      setDeletingNoteId(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Volver al listado
        </Link>

        {!loading && loaded.outcome === "found" && (
          <Link
            href={`/candidates/${id}/edit`}
            className="inline-flex w-fit items-center justify-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Editar candidato
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando...</p>}

      {!loading && loaded.outcome === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loaded.errorMessage}
        </p>
      )}

      {!loading && loaded.outcome === "not-found" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No se encontró el candidato.</p>
      )}

      {!loading && loaded.outcome === "found" && loaded.candidate && (
        <>
          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {loaded.candidate.name}
            </h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{loaded.candidate.position}</p>

            <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">{loaded.candidate.email}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Teléfono
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">{loaded.candidate.phone}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  LinkedIn
                </dt>
                <dd className="mt-1 text-sm">
                  {loaded.candidate.linkedinUrl ? (
                    <a
                      href={loaded.candidate.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Ver perfil
                    </a>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">No disponible</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  CV
                </dt>
                <dd className="mt-1 text-sm">
                  {loaded.candidate.resumeUrl ? (
                    <a
                      href={loaded.candidate.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Ver CV
                    </a>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">No disponible</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Años de experiencia
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {loaded.candidate.yearsOfExperience}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Fecha de aplicación
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {formatDate(loaded.candidate.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Controles rápidos
            </h2>

            {actionError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {actionError}
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="candidate-status" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Estado {savingField === "status" && "(guardando...)"}
                </label>
                <select
                  id="candidate-status"
                  value={loaded.candidate.status}
                  onChange={handleStatusChange}
                  disabled={savingField !== null}
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
                <label htmlFor="candidate-stage" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Etapa {savingField === "stage" && "(guardando...)"}
                </label>
                <select
                  id="candidate-stage"
                  value={loaded.candidate.stage}
                  onChange={handleStageChange}
                  disabled={savingField !== null}
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
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Notas internas
            </h2>

            <div className="mt-4 flex flex-col gap-2">
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Escribe una nota interna sobre este candidato..."
                rows={3}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={addingNote || noteText.trim() === ""}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {addingNote ? "Añadiendo..." : "Añadir nota"}
              </button>
            </div>

            {loaded.notes.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Este candidato todavía no tiene notas.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {loaded.notes.map((note) => (
                  <li
                    key={note.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-50">{note.text}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(note.date)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      disabled={deletingNoteId === note.id}
                      className="shrink-0 text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400"
                    >
                      {deletingNoteId === note.id ? "Borrando..." : "Eliminar"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-3xl px-6 py-10 text-sm text-zinc-500">Cargando...</p>}
    >
      <CandidateDetailContent params={params} />
    </Suspense>
  );
}
