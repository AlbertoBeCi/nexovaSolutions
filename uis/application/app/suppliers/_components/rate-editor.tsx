/**
 * NEXOVA SOLUTIONS - suppliers/_components/rate-editor.tsx
 * Tarifa mensual de una fila con edición rápida en línea (PATCH /suppliers/{id}/rate).
 * La fila se actualiza con la respuesta de la API cuando `onSave` resuelve.
 */

"use client";

import { useState, type FormEvent } from "react";
import { formatMonthlyRate, type Supplier } from "@/types/supplier";

export function RateEditor({
  supplier,
  disabled,
  onSave,
}: {
  supplier: Supplier;
  disabled: boolean;
  onSave: (monthlyRate: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(String(supplier.monthlyRate));
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rate = Number(draft.replace(",", "."));
    if (!Number.isFinite(rate) || rate <= 0) {
      setError("La tarifa debe ser mayor que 0.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(rate);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la tarifa.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="font-medium whitespace-nowrap text-zinc-900 tabular-nums dark:text-zinc-50">
          {formatMonthlyRate(supplier.monthlyRate, supplier.currency)}
        </span>
        <button
          type="button"
          onClick={startEditing}
          disabled={disabled}
          className="text-xs font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-50 dark:focus-visible:outline-zinc-50"
        >
          Editar tarifa
        </button>
      </div>
    );
  }

  const errorId = `rate-error-${supplier.id}`;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-w-44 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Nueva tarifa mensual de ${supplier.name} en ${supplier.currency}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-zinc-50"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{supplier.currency}</span>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50"
        >
          Cancelar
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
