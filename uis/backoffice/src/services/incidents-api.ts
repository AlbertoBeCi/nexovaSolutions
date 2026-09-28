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

/** Este dominio no tiene mensajes por campo propios: devuelve el `msg` de
 *  Pydantic tal cual (o un mensaje generico si no hay). */
function translateIssue(issue: ValidationIssue): string {
  return issue.msg ?? "Alguno de los datos enviados no es válido.";
}

// ─── Endpoints: incidencias ───────────────────────────────────────────

/** Sube un CSV de tickets de soporte y devuelve el resumen agregado del análisis. */
export async function analyzeIncidentsCsv(file: File): Promise<IncidentsAnalysisSummary> {
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
}

/** Descarga el resultado del último análisis como CSV y dispara la descarga en el navegador. */
export async function downloadIncidentsResultsCsv(): Promise<void> {
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
}
