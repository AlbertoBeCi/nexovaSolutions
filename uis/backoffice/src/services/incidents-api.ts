/**
 * NEXOVA SOLUTIONS - services/incidents-api.ts
 * Cliente HTTP contra services/api (FastAPI), el servicio propio de Nexova
 * que analiza CSVs de tickets de soporte. Traduce el DTO de la API
 * (snake_case, ver services/api/models.py) al modelo de la UI
 * (camelCase, types/incidents.ts), igual que services/api.ts hace con el
 * DTO de 4Geek Tracker.
 *
 * POST /api/incidents/analyze requiere login: usa apiRequest (lib/api-client.ts)
 * para que el token se adjunte solo y un 401 redirija a /login.
 */

import { apiRequest, type ValidationIssue } from "../lib/api-client";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_STATUSES,
  INVALID_RULES,
  IncidentsAnalysisSummary,
  incidentCategoryLabels,
  incidentStatusLabels,
  invalidRuleLabels,
} from "../types/incidents";

const SATISFACTION_SCORES = [1, 2, 3, 4, 5] as const;

// ─── DTO de la API (snake_case, ver services/api/models.py) ────

interface GroupBreakdownDto {
  count: number;
  percentage: number;
}

interface InvalidBreakdownDto {
  missing_company: number;
  invalid_category: number;
  short_description: number;
  invalid_agent_id: number;
  invalid_email: number;
  closed_no_score: number;
  score_out_of_range: number;
}

interface SatisfactionIndexDto {
  closed_tickets: number;
  scored_tickets: number;
  average_score: number;
  distribution: Record<string, number>;
}

interface AnalysisSummaryDto {
  source_file: string;
  analyzed_at: string | null;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  invalid_breakdown: InvalidBreakdownDto;
  categories: Record<string, GroupBreakdownDto>;
  statuses: Record<string, GroupBreakdownDto>;
  satisfaction: SatisfactionIndexDto;
}

// ─── Mapper DTO → modelo de la UI ────────────────────────────────────

/** DTO de la API → modelo de la UI (snake_case → camelCase). */
function toIncidentsAnalysisSummary(dto: AnalysisSummaryDto): IncidentsAnalysisSummary {
  return {
    sourceFile: dto.source_file,
    analyzedAt: dto.analyzed_at,
    totalRecords: dto.total_records,
    validRecords: dto.valid_records,
    invalidRecords: dto.invalid_records,
    invalidBreakdown: INVALID_RULES.map((rule) => ({
      rule,
      label: invalidRuleLabels[rule],
      count: dto.invalid_breakdown[rule] ?? 0,
    })),
    categories: INCIDENT_CATEGORIES.map((code) => ({
      code,
      label: incidentCategoryLabels[code],
      count: dto.categories[code]?.count ?? 0,
      percentage: dto.categories[code]?.percentage ?? 0,
    })),
    statuses: INCIDENT_STATUSES.map((code) => ({
      code,
      label: incidentStatusLabels[code],
      count: dto.statuses[code]?.count ?? 0,
      percentage: dto.statuses[code]?.percentage ?? 0,
    })),
    satisfaction: {
      closedTickets: dto.satisfaction.closed_tickets,
      scoredTickets: dto.satisfaction.scored_tickets,
      averageScore: dto.satisfaction.average_score,
      distribution: SATISFACTION_SCORES.map((score) => ({
        score,
        count: dto.satisfaction.distribution[String(score)] ?? 0,
      })),
    },
  };
}

// ─── Manejo de errores ────────────────────────────────────────────────

// Nombre legible de cada campo que puede fallar la validación de la API
// (auditoría de manejo de errores: antes se mostraba el `msg` crudo de
// Pydantic, en inglés; ahora el mensaje sale de aquí según el campo y el
// tipo de error, no del texto del backend).
const FIELD_NAMES: Record<string, string> = {
  file: "Archivo CSV",
};

/** Un error de validación de FastAPI/Pydantic → frase en español. */
function translateIssue(issue: ValidationIssue): string {
  const field = issue.loc?.[issue.loc.length - 1];
  const name = typeof field === "string" ? FIELD_NAMES[field] : undefined;

  if (!issue.msg) return "Alguno de los datos enviados no es válido.";
  if (name && issue.type === "missing") return `El campo «${name}» es obligatorio.`;
  if (name) return `Revisa el campo «${name}».`;
  return "Alguno de los datos enviados no es válido.";
}

/** `routes/incidents.py` y el analizador (InvalidCsvError) no llevan tildes
 *  en sus mensajes de error; esto los muestra con la ortografía correcta
 *  cuando la API los devuelve como `detail` en texto plano (un 400 no pasa
 *  por translateIssue). Mismo patrón que `KNOWN_MESSAGE_FIXES` en
 *  lib/auth-api.ts. */
const KNOWN_MESSAGE_FIXES: Record<string, string> = {
  "El archivo debe tener extension .csv.": "El archivo debe tener extensión .csv.",
  "El archivo esta vacio.": "El archivo está vacío.",
  "El archivo no es un CSV valido.": "El archivo no es un CSV válido.",
  "El archivo no esta codificado en UTF-8.": "El archivo no está codificado en UTF-8.",
};

function polishErrorMessage(message: string): string {
  return KNOWN_MESSAGE_FIXES[message] ?? message;
}

/** Envuelve una llamada para mostrar el error con la ortografía correcta
 *  (auditoría de manejo de errores), sin dejar de propagar el mensaje. */
function withPolishedErrors<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((err: unknown) => {
    if (err instanceof Error) throw new Error(polishErrorMessage(err.message));
    throw err;
  });
}

// ─── Endpoints: incidencias ───────────────────────────────────────────

/** Sube un CSV de tickets de soporte y devuelve el resumen agregado del análisis. */
export async function analyzeIncidentsCsv(file: File): Promise<IncidentsAnalysisSummary> {
  return withPolishedErrors(async () => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiRequest(
      "/api/incidents/analyze",
      { method: "POST", body: formData },
      "No se pudo analizar el archivo.",
      translateIssue
    );

    const dto = (await response.json()) as AnalysisSummaryDto;
    return toIncidentsAnalysisSummary(dto);
  });
}

/** Descarga el resultado del último análisis como CSV y dispara la descarga en el navegador. */
export async function downloadIncidentsResultsCsv(): Promise<void> {
  return withPolishedErrors(async () => {
    const response = await apiRequest(
      "/api/incidents/results/export",
      { method: "GET" },
      "No se pudo exportar el resultado del análisis.",
      translateIssue
    );

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = "results.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}
