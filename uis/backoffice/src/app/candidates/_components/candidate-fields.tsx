/**
 * NEXOVA SOLUTIONS - candidates/_components/candidate-fields.tsx
 * Formulario reutilizable de datos de candidato, compartido por las
 * pantallas de alta (new/page.tsx) y edición ([id]/edit/page.tsx).
 */

"use client";

import type { ChangeEvent } from "react";
import type { CandidateInput } from "../../../services/api";

export interface CandidateFieldsValue {
  name: string;
  email: string;
  phone: string;
  position: string;
  linkedinUrl: string;
  resumeUrl: string;
  yearsOfExperience: string;
}

export const EMPTY_CANDIDATE_FIELDS: CandidateFieldsValue = {
  name: "",
  email: "",
  phone: "",
  position: "",
  linkedinUrl: "",
  resumeUrl: "",
  yearsOfExperience: "",
};

/** Convierte el estado de texto del formulario al payload que espera la API:
 *  recorta espacios y convierte cadenas vacías de URL en `null`. */
export function toCandidateInput(fields: CandidateFieldsValue): CandidateInput {
  return {
    name: fields.name.trim(),
    email: fields.email.trim(),
    phone: fields.phone.trim(),
    position: fields.position.trim(),
    linkedinUrl: fields.linkedinUrl.trim() === "" ? null : fields.linkedinUrl.trim(),
    resumeUrl: fields.resumeUrl.trim() === "" ? null : fields.resumeUrl.trim(),
    yearsOfExperience: Number(fields.yearsOfExperience),
  };
}

const inputClassName =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const labelClassName = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

interface CandidateFieldsProps {
  value: CandidateFieldsValue;
  onChange: (value: CandidateFieldsValue) => void;
  disabled?: boolean;
}

/** Campos de datos personales/profesionales del candidato, sin estado/etapa
 *  (esos se gestionan aparte porque solo existen tras la creación). */
export function CandidateFields({ value, onChange, disabled = false }: CandidateFieldsProps) {
  function handleChange(field: keyof CandidateFieldsValue) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, [field]: event.target.value });
    };
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="candidate-name" className={labelClassName}>Nombre completo</label>
        <input
          id="candidate-name"
          type="text"
          value={value.name}
          onChange={handleChange("name")}
          required
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="candidate-email" className={labelClassName}>Email</label>
        <input
          id="candidate-email"
          type="email"
          value={value.email}
          onChange={handleChange("email")}
          required
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="candidate-phone" className={labelClassName}>Teléfono</label>
        <input
          id="candidate-phone"
          type="tel"
          value={value.phone}
          onChange={handleChange("phone")}
          required
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="candidate-position" className={labelClassName}>Puesto</label>
        <input
          id="candidate-position"
          type="text"
          value={value.position}
          onChange={handleChange("position")}
          required
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="candidate-linkedinUrl" className={labelClassName}>LinkedIn</label>
        <input
          id="candidate-linkedinUrl"
          type="url"
          value={value.linkedinUrl}
          onChange={handleChange("linkedinUrl")}
          placeholder="https://linkedin.com/in/..."
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="candidate-resumeUrl" className={labelClassName}>CV (URL)</label>
        <input
          id="candidate-resumeUrl"
          type="url"
          value={value.resumeUrl}
          onChange={handleChange("resumeUrl")}
          placeholder="https://..."
          disabled={disabled}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="candidate-yearsOfExperience" className={labelClassName}>Años de experiencia</label>
        <input
          id="candidate-yearsOfExperience"
          type="number"
          min={0}
          step={1}
          value={value.yearsOfExperience}
          onChange={handleChange("yearsOfExperience")}
          required
          disabled={disabled}
          className={inputClassName}
        />
      </div>
    </div>
  );
}
