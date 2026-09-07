/**
 * NEXOVA SOLUTIONS - website/_components/talent-form.tsx
 * Formulario de registro de talento en 3 pasos. Portado desde application.html +
 * validation.js + form-modal.js (Hito 1). El envio se simula (sin backend);
 * mensajes de error y de exito LITERALES de CONTEXT.md.
 */

"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import {
  AVAILABILITY_OPTIONS,
  COMMENTS_MAX,
  COUNTRY_OPTIONS,
  EMPTY_TALENT_VALUES,
  ENGLISH_OPTIONS,
  SECTOR_OPTIONS,
  STEP_FIELDS,
  STEP_LABELS,
  validateTalent,
  type TalentErrors,
  type TalentField,
  type TalentValues,
} from "@/lib/talent-validation";

const inputClass =
  "w-full border border-line bg-bg px-4 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const errorInputClass = "border-red-500 focus:border-red-500 focus:ring-red-500";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="status" className="mt-1.5 text-xs text-red-600">
      {message}
    </p>
  );
}

export function TalentForm() {
  const [values, setValues] = useState<TalentValues>({ ...EMPTY_TALENT_VALUES });
  const [touched, setTouched] = useState<Set<TalentField>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  const errors: TalentErrors = useMemo(() => validateTalent(values), [values]);

  const visibleFields: TalentField[] = submitAttempted
    ? (Object.keys(EMPTY_TALENT_VALUES) as TalentField[])
    : (Object.keys(EMPTY_TALENT_VALUES) as TalentField[]).filter((f) => touched.has(f));
  const summaryMessages = visibleFields.map((f) => errors[f]).filter(Boolean) as string[];

  function shownError(field: TalentField): string | undefined {
    return touched.has(field) || submitAttempted ? errors[field] : undefined;
  }

  function focusField(field: TalentField) {
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`);
    el?.focus();
  }

  function setValue(field: TalentField, value: string | boolean) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function markTouched(field: TalentField) {
    setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const target = e.target;
    const field = target.name as TalentField;
    const value =
      target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;
    setValue(field, value);

    const discrete =
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio"));
    if (discrete) markTouched(field);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    markTouched(e.target.name as TalentField);
  }

  function goToStep(index: number) {
    const clamped = Math.max(0, Math.min(index, STEP_FIELDS.length - 1));
    setStep(clamped);
  }

  function handleNext() {
    const fields = STEP_FIELDS[step];
    setTouched((prev) => {
      const next = new Set(prev);
      fields.forEach((f) => next.add(f));
      return next;
    });
    const firstInvalid = fields.find((f) => errors[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    goToStep(step + 1);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitAttempted(true);
    const allFields = Object.keys(EMPTY_TALENT_VALUES) as TalentField[];
    setTouched(new Set(allFields));

    const firstInvalid = allFields.find((f) => errors[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }
    setSubmitted(true);
    requestAnimationFrame(() => successRef.current?.focus());
  }

  function handleClear() {
    setValues({ ...EMPTY_TALENT_VALUES });
    setTouched(new Set());
    setSubmitAttempted(false);
    setStep(0);
  }

  if (submitted) {
    return (
      <div
        ref={successRef}
        role="status"
        tabIndex={-1}
        className="grid gap-3 border border-emerald-300 bg-emerald-50 p-6"
      >
        <p className="m-0 text-base font-bold text-emerald-800">¡Gracias por tu interés en Nexova!</p>
        <p className="m-0 text-sm text-emerald-700">
          Hemos recibido tu información. Nuestro equipo de selección la revisará y te contactaremos en
          caso de que tu perfil encaje con alguna de nuestras oportunidades actuales o futuras.
        </p>
        <p className="m-0 text-sm text-emerald-700">
          Mientras tanto, síguenos en{" "}
          <a
            href="https://linkedin.com/company/nexova"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline hover:text-emerald-900"
          >
            LinkedIn
          </a>{" "}
          para estar al día de nuestras vacantes y contenido sobre desarrollo profesional.
        </p>
        <button
          type="button"
          onClick={() => {
            handleClear();
            setSubmitted(false);
          }}
          className="mt-1 justify-self-start border border-emerald-600 bg-transparent px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500"
        >
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  const isLastStep = step === STEP_FIELDS.length - 1;
  const commentsRemaining = values.comments.length;

  return (
    <div className="border border-line bg-bg-alt/40">
      <div className="border-b border-line px-6 py-5 sm:px-8">
        <h2 className="font-display text-xl font-semibold text-ink">Registro de Talento</h2>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-accent" aria-live="polite">
          Paso {step + 1} de {STEP_FIELDS.length} — {STEP_LABELS[step]}
        </p>
        <div className="mt-4 flex items-center gap-2" aria-hidden="true">
          {STEP_FIELDS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 ${i <= step ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </div>
      </div>

      <div className="px-6 py-8 sm:px-8">
        {summaryMessages.length > 0 && (
          <div
            className="mb-6 border border-red-300 bg-red-50 p-4 text-sm text-red-700"
            role="alert"
            aria-live="assertive"
          >
            <p className="font-bold">Por favor, corrige los errores antes de continuar:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-600">
              {summaryMessages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          {/* Paso 1 */}
          <div className={step === 0 ? "space-y-4" : "hidden"}>
            <h3 className="mb-2 font-display text-lg font-semibold text-ink">1. Datos de Contacto</h3>

            <div>
              <label htmlFor="fullName" className={labelClass}>
                Nombre Completo <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={values.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-required="true"
                aria-invalid={Boolean(shownError("fullName"))}
                aria-describedby="fullNameError"
                placeholder="Ej. Carlos Mendoza"
                className={`${inputClass} ${shownError("fullName") ? errorInputClass : ""}`}
              />
              <FieldError id="fullNameError" message={shownError("fullName")} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className={labelClass}>
                  Correo Electrónico <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-required="true"
                  aria-invalid={Boolean(shownError("email"))}
                  aria-describedby="emailError"
                  placeholder="nombre@empresa.com"
                  className={`${inputClass} ${shownError("email") ? errorInputClass : ""}`}
                />
                <FieldError id="emailError" message={shownError("email")} />
              </div>

              <div>
                <label htmlFor="phone" className={labelClass}>
                  Teléfono <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={values.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-required="true"
                  aria-invalid={Boolean(shownError("phone"))}
                  aria-describedby="phoneError"
                  placeholder="+34 612 345 678"
                  className={`${inputClass} ${shownError("phone") ? errorInputClass : ""}`}
                />
                <FieldError id="phoneError" message={shownError("phone")} />
              </div>
            </div>

            <div>
              <label htmlFor="country" className={labelClass}>
                País de Residencia <span className="text-red-600">*</span>
              </label>
              <select
                id="country"
                name="country"
                value={values.country}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-required="true"
                aria-invalid={Boolean(shownError("country"))}
                aria-describedby="countryError"
                className={`${inputClass} cursor-pointer appearance-none ${shownError("country") ? errorInputClass : ""}`}
              >
                <option value="" disabled hidden>
                  Seleccione su país...
                </option>
                {COUNTRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <FieldError id="countryError" message={shownError("country")} />
            </div>
          </div>

          {/* Paso 2 */}
          <div className={step === 1 ? "space-y-4" : "hidden"}>
            <h3 className="mb-2 font-display text-lg font-semibold text-ink">2. Perfil Profesional</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="yearsExperience" className={labelClass}>
                  Años de Experiencia <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  id="yearsExperience"
                  name="yearsExperience"
                  min={0}
                  max={50}
                  value={values.yearsExperience}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-required="true"
                  aria-invalid={Boolean(shownError("yearsExperience"))}
                  aria-describedby="yearsExperienceError"
                  placeholder="Ej. 5"
                  className={`${inputClass} ${shownError("yearsExperience") ? errorInputClass : ""}`}
                />
                <FieldError id="yearsExperienceError" message={shownError("yearsExperience")} />
              </div>

              <div>
                <label htmlFor="englishLevel" className={labelClass}>
                  Nivel de Inglés <span className="text-red-600">*</span>
                </label>
                <select
                  id="englishLevel"
                  name="englishLevel"
                  value={values.englishLevel}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-required="true"
                  aria-invalid={Boolean(shownError("englishLevel"))}
                  aria-describedby="englishLevelError"
                  className={`${inputClass} cursor-pointer appearance-none ${shownError("englishLevel") ? errorInputClass : ""}`}
                >
                  <option value="" disabled hidden>
                    Seleccione su nivel...
                  </option>
                  {ENGLISH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <FieldError id="englishLevelError" message={shownError("englishLevel")} />
              </div>
            </div>

            <div>
              <label htmlFor="sector" className={labelClass}>
                Sector de Interés <span className="text-red-600">*</span>
              </label>
              <select
                id="sector"
                name="sector"
                value={values.sector}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-required="true"
                aria-invalid={Boolean(shownError("sector"))}
                aria-describedby="sectorError"
                className={`${inputClass} cursor-pointer appearance-none ${shownError("sector") ? errorInputClass : ""}`}
              >
                <option value="" disabled hidden>
                  Seleccione un sector...
                </option>
                {SECTOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <FieldError id="sectorError" message={shownError("sector")} />
            </div>

            <div>
              <fieldset className="border border-line px-4 py-3" aria-describedby="availabilityError">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Disponibilidad <span className="text-red-600">*</span>
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {AVAILABILITY_OPTIONS.map((o) => (
                    <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name="availability"
                        value={o.value}
                        checked={values.availability === o.value}
                        onChange={handleChange}
                        className="cursor-pointer border-line text-accent focus:ring-accent"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <FieldError id="availabilityError" message={shownError("availability")} />
            </div>

            <div>
              <label htmlFor="linkedin" className={labelClass}>
                LinkedIn (URL de perfil)
              </label>
              <input
                type="url"
                id="linkedin"
                name="linkedin"
                value={values.linkedin}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-invalid={Boolean(shownError("linkedin"))}
                aria-describedby="linkedinError"
                placeholder="https://www.linkedin.com/in/tu-perfil"
                className={`${inputClass} ${shownError("linkedin") ? errorInputClass : ""}`}
              />
              <FieldError id="linkedinError" message={shownError("linkedin")} />
            </div>
          </div>

          {/* Paso 3 */}
          <div className={step === 2 ? "space-y-4" : "hidden"}>
            <h3 className="mb-2 font-display text-lg font-semibold text-ink">3. Confirmación y Envío</h3>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="comments" className={`${labelClass} mb-0`}>
                  Comentarios Adicionales
                </label>
                <span className="text-xs text-ink-muted" aria-live="polite">
                  {commentsRemaining}/{COMMENTS_MAX}
                </span>
              </div>
              <textarea
                id="comments"
                name="comments"
                rows={4}
                maxLength={COMMENTS_MAX}
                value={values.comments}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-describedby="commentsError"
                placeholder="Cuéntanos algo más sobre tu perfil (máx. 500 caracteres)..."
                className={`${inputClass} resize-none ${shownError("comments") ? errorInputClass : ""}`}
              />
              <FieldError id="commentsError" message={shownError("comments")} />
            </div>

            <div className="flex items-start">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                checked={values.terms}
                onChange={handleChange}
                aria-required="true"
                aria-invalid={Boolean(shownError("terms"))}
                aria-describedby="termsError"
                className="mt-0.5 h-4 w-4 cursor-pointer border-line text-accent focus:ring-accent"
              />
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="cursor-pointer font-medium text-ink-muted">
                  Acepto el tratamiento de datos para la evaluación operativa entre las sedes de
                  Valencia y Miami. <span className="text-red-600">*</span>
                </label>
                <FieldError id="termsError" message={shownError("terms")} />
              </div>
            </div>
          </div>

          {/* Navegación */}
          <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleClear}
              className="self-start text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:self-auto"
            >
              Limpiar formulario
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => goToStep(step - 1)}
                  className="border border-ink/25 px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-ink/10"
                >
                  Atrás
                </button>
              )}
              {!isLastStep && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                >
                  Siguiente
                </button>
              )}
              {isLastStep && (
                <button
                  type="submit"
                  className="bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                >
                  Enviar Formulario a Nexova
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
