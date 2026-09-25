/**
 * NEXOVA SOLUTIONS - types/incidents.ts
 * Modelo del resumen de análisis de tickets de soporte tal como lo consume
 * la UI del backoffice (camelCase). Los códigos de categoría, estado y
 * regla de invalidez deben coincidir exactamente con los definidos en
 * services/api/analysis.py (fuente de verdad del negocio: 5 categorías,
 * 3 estados y 7 reglas de invalidez de los tickets de soporte de Nexova).
 */

export const INCIDENT_CATEGORIES = [
  "TECHNICAL",
  "BILLING",
  "ACCESS",
  "HR_QUERY",
  "COMPLAINT",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const incidentCategoryLabels: Record<IncidentCategory, string> = {
  TECHNICAL: "Técnico",
  BILLING: "Facturación",
  ACCESS: "Acceso",
  HR_QUERY: "Consulta de RR. HH.",
  COMPLAINT: "Queja",
};

export const INCIDENT_STATUSES = ["OPEN", "CLOSED", "DISCARDED"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const incidentStatusLabels: Record<IncidentStatus, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  DISCARDED: "Descartado",
};

export const INVALID_RULES = [
  "missing_company",
  "invalid_category",
  "short_description",
  "invalid_agent_id",
  "invalid_email",
  "closed_no_score",
  "score_out_of_range",
] as const;
export type InvalidRule = (typeof INVALID_RULES)[number];

export const invalidRuleLabels: Record<InvalidRule, string> = {
  missing_company: "Falta la empresa cliente (client_company)",
  invalid_category: "Categoría inválida o faltante (category)",
  short_description: "Descripción vacía o demasiado corta (description)",
  invalid_agent_id: "ID de agente inválido o faltante (agent_id)",
  invalid_email: "Email de cliente inválido o faltante (customer_email)",
  closed_no_score: "Ticket cerrado sin puntuación (satisfaction_score)",
  score_out_of_range: "Puntuación de satisfacción fuera de rango 1-5 (satisfaction_score)",
};

/** Un grupo (categoría o estado) con su conteo y porcentaje sobre los válidos. */
export interface IncidentGroupBreakdown {
  code: string;
  label: string;
  count: number;
  percentage: number;
}

/** Resumen del análisis normalizado a camelCase, listo para renderizar. */
export interface IncidentsAnalysisSummary {
  sourceFile: string;
  analyzedAt: string | null;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  invalidBreakdown: { rule: InvalidRule; label: string; count: number }[];
  categories: IncidentGroupBreakdown[];
  statuses: IncidentGroupBreakdown[];
  satisfaction: {
    closedTickets: number;
    scoredTickets: number;
    averageScore: number;
    distribution: { score: number; count: number }[];
  };
}
