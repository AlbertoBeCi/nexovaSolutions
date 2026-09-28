/**
 * NEXOVA SOLUTIONS - types/incident.ts
 * Modelo de incidencia que usa la UI (camelCase) y diccionarios de
 * etiquetas. Espejo en TypeScript de
 * packages/shared/nexova_shared/incident_constants.py: los códigos y las
 * transiciones deben coincidir exactamente con ese módulo (única fuente de
 * verdad del dominio). Los códigos crudos de la API solo viven aquí: la UI
 * siempre muestra la etiqueta en español vía los diccionarios *_LABELS.
 * Contrato de la API en services/incident-manager-api/schemas.py.
 */

export const INCIDENT_CATEGORIES = [
  "technical_failure",
  "process_error",
  "client_complaint",
  "candidate_issue",
  "staff_issue",
  "sla_breach",
  "data_quality",
  "other",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  technical_failure: "Fallo técnico",
  process_error: "Error de proceso",
  client_complaint: "Queja de cliente",
  candidate_issue: "Incidencia con candidato",
  staff_issue: "Incidencia de personal",
  sla_breach: "Incumplimiento de SLA",
  data_quality: "Calidad de datos",
  other: "Otra",
};

export const INCIDENT_STATUSES = ["open", "in_progress", "resolved", "discarded"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Abierta",
  in_progress: "En curso",
  resolved: "Resuelta",
  discarded: "Descartada",
};

/** open -> in_progress, open -> discarded; in_progress -> resolved,
 * in_progress -> discarded; resolved y discarded son finales (sin salida).
 * Debe coincidir con TRANSITIONS en incident_constants.py. */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  open: ["in_progress", "discarded"],
  in_progress: ["resolved", "discarded"],
  resolved: [],
  discarded: [],
};

export const INCIDENT_ORIGINS = ["customer", "branch", "internal"] as const;
export type IncidentOrigin = (typeof INCIDENT_ORIGINS)[number];

export const INCIDENT_ORIGIN_LABELS: Record<IncidentOrigin, string> = {
  customer: "Cliente",
  branch: "Sede",
  internal: "Interna",
};

// `central` es la sede central de Valencia (no crear un valor aparte de
// "headquarters"); `remote` es un empleado sin sede fija, distinto de
// `central` y de `valencia_operations`.
export const INCIDENT_BRANCHES = [
  "central",
  "valencia_operations",
  "miami_office",
  "remote",
] as const;
export type IncidentBranch = (typeof INCIDENT_BRANCHES)[number];

export const INCIDENT_BRANCH_LABELS: Record<IncidentBranch, string> = {
  central: "Central — Sede Valencia",
  valencia_operations: "Valencia — Operaciones",
  miami_office: "Miami Office",
  remote: "Remoto (empleado sin sede fija)",
};

export interface Incident {
  id: number;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  origin: IncidentOrigin;
  branch: IncidentBranch;
  createdAt: string;
  updatedAt: string;
}

/** Datos del formulario de registro: la API asigna id/status(=open)/timestamps. */
export type NewIncident = Pick<
  Incident,
  "title" | "description" | "category" | "origin" | "branch"
>;

export interface IncidentFilters {
  status: IncidentStatus | null;
  origin: IncidentOrigin | null;
  branch: IncidentBranch | null;
}

export interface IncidentSummary {
  status: Record<IncidentStatus, number>;
  category: Record<IncidentCategory, number>;
  origin: Record<IncidentOrigin, number>;
  branch: Record<IncidentBranch, number>;
}

export function isIncidentCategory(value: string | null): value is IncidentCategory {
  return INCIDENT_CATEGORIES.includes(value as IncidentCategory);
}

export function isIncidentStatus(value: string | null): value is IncidentStatus {
  return INCIDENT_STATUSES.includes(value as IncidentStatus);
}

export function isIncidentOrigin(value: string | null): value is IncidentOrigin {
  return INCIDENT_ORIGINS.includes(value as IncidentOrigin);
}

export function isIncidentBranch(value: string | null): value is IncidentBranch {
  return INCIDENT_BRANCHES.includes(value as IncidentBranch);
}

/** Estados a los que se puede pasar desde `status` (vacío si es un estado final). */
export function nextStatusOptions(status: IncidentStatus): readonly IncidentStatus[] {
  return INCIDENT_TRANSITIONS[status];
}

export function isFinalStatus(status: IncidentStatus): boolean {
  return INCIDENT_TRANSITIONS[status].length === 0;
}
