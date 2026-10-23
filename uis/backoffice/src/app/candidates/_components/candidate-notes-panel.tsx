"use client";

import { useEffect, useState, type FormEvent } from "react";

import { addCandidateNote, deleteCandidateNote, getCandidateNotes } from "../../../services/api";
import type { CandidateNote } from "../../../types/candidate";

type NotesResult = {
  candidateId: string;
  reloadToken: number;
  status: "success" | "error";
  notes: CandidateNote[];
  errorMessage: string | null;
};

function formatNoteDate(date: Date): string {
  return date.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
}

function sortNotesByDateDesc(notes: CandidateNote[]): CandidateNote[] {
  return [...notes].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function CandidateNotesPanel({ candidateId }: { candidateId: string }) {
  const [result, setResult] = useState<NotesResult | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const loading = result === null || result.candidateId !== candidateId || result.reloadToken !== reloadToken;
  const notes = !loading && result.status === "success" ? result.notes : [];
  const loadError = !loading && result.status === "error" ? result.errorMessage : null;

  useEffect(() => {
    let cancelled = false;
    getCandidateNotes(candidateId)
      .then((data) => {
        if (!cancelled) {
          setResult({
            candidateId,
            reloadToken,
            status: "success",
            notes: sortNotesByDateDesc(data),
            errorMessage: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            candidateId,
            reloadToken,
            status: "error",
            notes: [],
            errorMessage: error instanceof Error ? error.message : "No se pudieron cargar las notas.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [candidateId, reloadToken]);

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedText = noteText.trim();
    if (trimmedText === "") return;

    setSaving(true);
    setActionError(null);
    try {
      const newNote = await addCandidateNote(candidateId, trimmedText);
      setResult((previous) =>
        previous?.status === "success" && previous.candidateId === candidateId
          ? { ...previous, notes: [newNote, ...previous.notes] }
          : previous
      );
      setNoteText("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo agregar la nota.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    setDeletingNoteId(noteId);
    setActionError(null);
    try {
      await deleteCandidateNote(candidateId, noteId);
      setResult((previous) =>
        previous?.status === "success" && previous.candidateId === candidateId
          ? { ...previous, notes: previous.notes.filter((note) => note.id !== noteId) }
          : previous
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo borrar la nota.");
    } finally {
      setDeletingNoteId(null);
    }
  }

  return (
    <section
      id="candidate-notes-panel"
      aria-labelledby="candidate-notes-title"
      className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 id="candidate-notes-title" className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Notas internas
      </h2>

      {loading && <p role="status" aria-live="polite" className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Cargando notas…</p>}
      {loadError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p role="alert">{loadError}</p>
          <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="mt-2 font-medium underline">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {actionError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{actionError}</p>}
          <form onSubmit={handleAddNote} className="mt-4 flex flex-col gap-2">
            <label htmlFor="candidate-internal-note" className="sr-only">Escribe una nota interna sobre este candidato</label>
            <textarea
              id="candidate-internal-note"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Escribe una nota interna sobre este candidato..."
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={saving || noteText.trim() === ""}
              className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saving ? "Añadiendo..." : "Añadir nota"}
            </button>
          </form>

          {notes.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Este candidato todavía no tiene notas.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {notes.map((note) => (
                <li key={note.id} className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <p className="text-sm text-zinc-900 dark:text-zinc-50">{note.text}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatNoteDate(note.date)}</p>
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
        </>
      )}
    </section>
  );
}
