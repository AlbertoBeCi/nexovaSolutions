/**
 * NEXOVA SOLUTIONS - incidents/_components/incident-form.tsx
 * Registro de incidencia (POST /api/incidents vía lib/incidents-api.ts). El
 * estado siempre nace "Abierta" (lo fija la API); aquí solo se editan
 * title/description/category/origin/branch.
 */

"use client";

import { useState, type FormEvent } from "react";
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SUCCESS_CLASS } from "@/app/_components/form-styles";
import { IncidentsApiError, createIncident } from "@/lib/incidents-api";
import {
  INCIDENT_BRANCHES,
  INCIDENT_BRANCH_LABELS,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_ORIGINS,
  INCIDENT_ORIGIN_LABELS,
  isIncidentBranch,
  isIncidentCategory,
  isIncidentOrigin,
  type Incident,
  type IncidentBranch,
  type IncidentCategory,
  type IncidentOrigin,
} from "@/types/incident";

interface FormState {
  title: string;
  description: string;
  category: IncidentCategory;
  origin: IncidentOrigin;
  branch: IncidentBranch;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: INCIDENT_CATEGORIES[0],
  origin: INCIDENT_ORIGINS[0],
  branch: INCIDENT_BRANCHES[0],
};

/** Validación en cliente: obligatorios y valores permitidos, antes de
 * llamar a la API (que vuelve a validar con la misma logica del backend). */
function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "El título es obligatorio.";
  if (!form.description.trim()) errors.description = "La descripción es obligatoria.";
  if (!isIncidentCategory(form.category)) errors.category = "Selecciona una categoría válida.";
  if (!isIncidentOrigin(form.origin)) errors.origin = "Selecciona un origen válido.";
  if (!isIncidentBranch(form.branch)) errors.branch = "Selecciona una sede válida.";
  return errors;
}

export function IncidentForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<Incident | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    setGeneralError(null);

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      const created = await createIncident({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        origin: form.origin,
        branch: form.branch,
      });
      setForm(EMPTY_FORM);
      setSuccess(created);
    } catch (err) {
      if (err instanceof IncidentsApiError) {
        setFieldErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setGeneralError(err.message);
      } else {
        setGeneralError("No se pudo registrar la incidencia.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // origin = branch: la sede pasa a ser el foco de la incidencia (se
  // resalta y se avisa, en vez de ser "solo un campo más").
  const branchHighlighted = form.origin === "branch";

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <label className={`${LABEL_CLASS} sm:col-span-2`}>
        Título *
        <input
          type="text"
          value={form.title}
          onChange={(event) => update("title", event.target.value)}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? "incident-title-error" : undefined}
          className={FIELD_CLASS}
        />
        {fieldErrors.title && (
          <p id="incident-title-error" role="alert" className="text-xs font-normal text-red-700 dark:text-red-300">
            {fieldErrors.title}
          </p>
        )}
      </label>

      <label className={`${LABEL_CLASS} sm:col-span-2`}>
        Descripción *
        <textarea
          rows={4}
          value={form.description}
          onChange={(event) => update("description", event.target.value)}
          aria-invalid={fieldErrors.description ? true : undefined}
          aria-describedby={fieldErrors.description ? "incident-description-error" : undefined}
          className={FIELD_CLASS}
        />
        {fieldErrors.description && (
          <p
            id="incident-description-error"
            role="alert"
            className="text-xs font-normal text-red-700 dark:text-red-300"
          >
            {fieldErrors.description}
          </p>
        )}
      </label>

      <label className={LABEL_CLASS}>
        Categoría *
        <select
          value={form.category}
          onChange={(event) => {
            const value = event.target.value;
            if (isIncidentCategory(value)) update("category", value);
          }}
          aria-invalid={fieldErrors.category ? true : undefined}
          aria-describedby={fieldErrors.category ? "incident-category-error" : undefined}
          className={FIELD_CLASS}
        >
          {INCIDENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {INCIDENT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        {fieldErrors.category && (
          <p id="incident-category-error" role="alert" className="text-xs font-normal text-red-700 dark:text-red-300">
            {fieldErrors.category}
          </p>
        )}
      </label>

      <label className={LABEL_CLASS}>
        Origen *
        <select
          value={form.origin}
          onChange={(event) => {
            const value = event.target.value;
            if (isIncidentOrigin(value)) update("origin", value);
          }}
          aria-invalid={fieldErrors.origin ? true : undefined}
          aria-describedby={fieldErrors.origin ? "incident-origin-error" : undefined}
          className={FIELD_CLASS}
        >
          {INCIDENT_ORIGINS.map((origin) => (
            <option key={origin} value={origin}>
              {INCIDENT_ORIGIN_LABELS[origin]}
            </option>
          ))}
        </select>
        {fieldErrors.origin && (
          <p id="incident-origin-error" role="alert" className="text-xs font-normal text-red-700 dark:text-red-300">
            {fieldErrors.origin}
          </p>
        )}
      </label>

      <label
        className={`${LABEL_CLASS} sm:col-span-2 rounded-lg border p-3 transition-colors ${
          branchHighlighted
            ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950"
            : "border-transparent"
        }`}
      >
        Sede *
        <select
          value={form.branch}
          onChange={(event) => {
            const value = event.target.value;
            if (isIncidentBranch(value)) update("branch", value);
          }}
          aria-invalid={fieldErrors.branch ? true : undefined}
          aria-describedby={
            [fieldErrors.branch ? "incident-branch-error" : null, branchHighlighted ? "incident-branch-hint" : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={FIELD_CLASS}
        >
          {INCIDENT_BRANCHES.map((branch) => (
            <option key={branch} value={branch}>
              {INCIDENT_BRANCH_LABELS[branch]}
            </option>
          ))}
        </select>
        {branchHighlighted && (
          <p id="incident-branch-hint" className="text-xs font-normal text-amber-800 dark:text-amber-300">
            Estás reportando desde una sede específica
          </p>
        )}
        {fieldErrors.branch && (
          <p id="incident-branch-error" role="alert" className="text-xs font-normal text-red-700 dark:text-red-300">
            {fieldErrors.branch}
          </p>
        )}
      </label>

      <p className="text-sm text-zinc-600 sm:col-span-2 dark:text-zinc-400">
        Estado inicial: <span className="font-medium text-zinc-900 dark:text-zinc-50">Abierta</span>
      </p>

      {generalError && (
        <p role="alert" className={`${ERROR_CLASS} sm:col-span-2`}>
          {generalError}
        </p>
      )}

      {success && (
        <p role="status" className={`${SUCCESS_CLASS} sm:col-span-2`}>
          Incidencia «{success.title}» registrada correctamente.
        </p>
      )}

      <div className="sm:col-span-2">
        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON_CLASS}>
          {submitting ? "Registrando..." : "Registrar incidencia"}
        </button>
      </div>
    </form>
  );
}
