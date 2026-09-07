/**
 * NEXOVA SOLUTIONS - website/lib/talent-validation.ts
 * Validacion del formulario de registro de talento. Portada desde validation.js
 * (Hito 1). Los mensajes coinciden LITERALMENTE con "Mensajes de error esperados"
 * y las reglas con "Validaciones especificas" de CONTEXT.md. No parafrasear.
 */

export type TalentField =
  | "fullName"
  | "email"
  | "phone"
  | "country"
  | "yearsExperience"
  | "sector"
  | "englishLevel"
  | "availability"
  | "linkedin"
  | "comments"
  | "terms";

export interface TalentValues {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  yearsExperience: string;
  sector: string;
  englishLevel: string;
  availability: string;
  linkedin: string;
  comments: string;
  terms: boolean;
}

export type TalentErrors = Partial<Record<TalentField, string>>;

export const EMPTY_TALENT_VALUES: TalentValues = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  yearsExperience: "",
  sector: "",
  englishLevel: "",
  availability: "",
  linkedin: "",
  comments: "",
  terms: false,
};

export const COMMENTS_MAX = 500;

export const COUNTRY_OPTIONS = [
  { value: "espana", label: "España" },
  { value: "estados_unidos", label: "Estados Unidos" },
  { value: "otro", label: "Otro" },
];

export const SECTOR_OPTIONS = [
  { value: "tecnologia", label: "Tecnología" },
  { value: "retail", label: "Retail" },
  { value: "financiero", label: "Servicios Financieros" },
  { value: "consultoria", label: "Consultoría" },
  { value: "otro", label: "Otro" },
];

export const ENGLISH_OPTIONS = [
  { value: "basico", label: "Básico" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
  { value: "nativo", label: "Nativo" },
];

export const AVAILABILITY_OPTIONS = [
  { value: "inmediata", label: "Inmediata" },
  { value: "1_mes", label: "1 mes" },
  { value: "2_3_meses", label: "2-3 meses" },
  { value: "explorando", label: "Solo explorando" },
];

/** Devuelve { campo: mensaje } con los campos invalidos. Sin efectos secundarios. */
export function validateTalent(values: TalentValues): TalentErrors {
  const errors: TalentErrors = {};

  const nameWords = values.fullName.trim().split(/\s+/).filter(Boolean);
  if (!values.fullName.trim() || nameWords.length < 2) {
    errors.fullName = "El nombre debe contener al menos nombre y apellido";
  }

  if (!values.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Ingresa un email válido (ejemplo: nombre@empresa.com)";
  }

  if (!values.phone.trim() || !/^\+\d{1,3}[\d\s-]{6,14}$/.test(values.phone.trim())) {
    errors.phone = "El teléfono debe incluir código de país (ejemplo: +34 612 345 678)";
  }

  if (!values.country) {
    errors.country = "Selecciona tu país de residencia";
  }

  const years = Number(values.yearsExperience);
  if (
    !String(values.yearsExperience).trim() ||
    Number.isNaN(years) ||
    years < 0 ||
    years > 50
  ) {
    errors.yearsExperience = "Los años de experiencia deben estar entre 0 y 50";
  }

  if (!values.sector) errors.sector = "Selecciona el sector de tu interés";
  if (!values.englishLevel) errors.englishLevel = "Indica tu nivel de inglés";
  if (!values.availability) errors.availability = "Selecciona tu disponibilidad";

  if (values.linkedin.trim()) {
    let validUrl = false;
    try {
      const url = new URL(values.linkedin.trim());
      validUrl = /^https?:$/.test(url.protocol);
    } catch {
      validUrl = false;
    }
    if (!validUrl) errors.linkedin = "Si incluyes LinkedIn, debe ser una URL válida";
  }

  if (values.comments.length > COMMENTS_MAX) {
    const remaining = Math.max(0, COMMENTS_MAX - values.comments.length);
    errors.comments = `Los comentarios no pueden exceder 500 caracteres (quedan ${remaining})`;
  }

  if (!values.terms) {
    errors.terms = "Debes aceptar la política de tratamiento de datos para continuar";
  }

  return errors;
}

/** Campos por paso del asistente (mismo agrupamiento que form-modal.js). */
export const STEP_FIELDS: TalentField[][] = [
  ["fullName", "email", "phone", "country"],
  ["yearsExperience", "englishLevel", "sector", "availability", "linkedin"],
  ["comments", "terms"],
];

export const STEP_LABELS = ["Datos de contacto", "Perfil profesional", "Confirmación y envío"];
