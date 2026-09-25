/**
 * NEXOVA SOLUTIONS - suppliers/_components/supplier-form.tsx
 * Alta de proveedor (POST /suppliers). Valida en cliente lo imprescindible
 * (nombre, categorías, tarifa > 0); el resto lo valida la API y su mensaje
 * se muestra tal cual (ya traducido por lib/suppliers-api.ts).
 */

"use client";

import { useState, type FormEvent } from "react";
import { createSupplier } from "@/lib/suppliers-api";
import {
  CATEGORY_LABELS,
  COUNTRY_CURRENCY,
  COUNTRY_LABELS,
  STATUS_LABELS,
  SUPPLIER_CATEGORIES,
  SUPPLIER_COUNTRIES,
  SUPPLIER_STATUSES,
  isSupplierCountry,
  type Supplier,
  type SupplierCategory,
  type SupplierCountry,
  type SupplierStatus,
} from "@/types/supplier";

interface FormState {
  name: string;
  country: SupplierCountry;
  categories: SupplierCategory[];
  monthlyRate: string;
  status: SupplierStatus;
  contractRenewalDate: string;
  contactEmail: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  country: SUPPLIER_COUNTRIES[0],
  categories: [],
  monthlyRate: "",
  status: SUPPLIER_STATUSES[0],
  contractRenewalDate: "",
  contactEmail: "",
  notes: "",
};

const FIELD_CLASS =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-zinc-50";
const LABEL_CLASS = "flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300";

function validate(form: FormState): string | null {
  if (!form.name.trim()) return "El nombre es obligatorio.";
  if (form.categories.length === 0) return "Selecciona al menos una categoría.";
  const rate = Number(form.monthlyRate.replace(",", "."));
  if (!form.monthlyRate.trim() || !Number.isFinite(rate) || rate <= 0) {
    return "La tarifa mensual debe ser mayor que 0.";
  }
  return null;
}

/** Cadena vacía → null, para que la API reciba los opcionales como ausentes. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function SupplierForm({
  onCreated,
  onCancel,
}: {
  onCreated: (supplier: Supplier) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currency = COUNTRY_CURRENCY[form.country];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleCategory(category: SupplierCategory) {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((c) => c !== category)
        : [...current.categories, category],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate(form);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await createSupplier({
        name: form.name.trim(),
        country: form.country,
        categories: form.categories,
        monthlyRate: Number(form.monthlyRate.replace(",", ".")),
        currency,
        status: form.status,
        contractRenewalDate: optional(form.contractRenewalDate),
        contactEmail: optional(form.contactEmail),
        notes: optional(form.notes),
      });
      setForm(EMPTY_FORM);
      onCreated(created);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo registrar el proveedor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="supplier-form-title"
      className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <h2 id="supplier-form-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Registrar proveedor
      </h2>

      <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <label className={`${LABEL_CLASS} sm:col-span-2`}>
          Nombre *
          <input
            type="text"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            autoComplete="organization"
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          País *
          <select
            value={form.country}
            onChange={(event) => {
              const value = event.target.value;
              if (isSupplierCountry(value)) update("country", value);
            }}
            className={FIELD_CLASS}
          >
            {SUPPLIER_COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {COUNTRY_LABELS[country]}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Tarifa mensual ({currency}) *
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={form.monthlyRate}
            onChange={(event) => update("monthlyRate", event.target.value)}
            className={`${FIELD_CLASS} tabular-nums`}
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            La moneda se fija según el país del contrato.
          </span>
        </label>

        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Categorías *</legend>
          <div className="flex flex-wrap gap-2">
            {SUPPLIER_CATEGORIES.map((category) => {
              const checked = form.categories.includes(category);
              return (
                <label
                  key={category}
                  className={`relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 ring-inset has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-zinc-900 dark:has-focus-visible:outline-zinc-50 ${
                    checked
                      ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:ring-zinc-50"
                      : "text-zinc-700 ring-zinc-300 hover:bg-zinc-100 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(category)}
                    className="sr-only"
                  />
                  {CATEGORY_LABELS[category]}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className={LABEL_CLASS}>
          Estado
          <select
            value={form.status}
            onChange={(event) => update("status", event.target.value as SupplierStatus)}
            className={FIELD_CLASS}
          >
            {SUPPLIER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CLASS}>
          Fecha de renovación
          <input
            type="date"
            value={form.contractRenewalDate}
            onChange={(event) => update("contractRenewalDate", event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className={`${LABEL_CLASS} sm:col-span-2`}>
          Email de contacto
          <input
            type="email"
            value={form.contactEmail}
            onChange={(event) => update("contactEmail", event.target.value)}
            autoComplete="off"
            className={FIELD_CLASS}
          />
        </label>

        <label className={`${LABEL_CLASS} sm:col-span-2`}>
          Notas internas
          <textarea
            rows={2}
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50"
          >
            {submitting ? "Registrando..." : "Registrar proveedor"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
