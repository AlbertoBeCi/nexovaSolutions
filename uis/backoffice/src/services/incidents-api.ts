/**
 * NEXOVA SOLUTIONS - services/incidents-api.ts
 * Cliente HTTP contra services/api (FastAPI), el servicio propio de Nexova
 * que analiza CSVs de tickets de soporte. Traduce el DTO de la API
 * (snake_case, ver services/api/models.py) al modelo de la UI
 * (camelCase, types/incidents.ts), igual que services/api.ts hace con el
 * DTO de 4Geek Tracker.
 */

import {
  INCIDENT_CATEGORIES,
  INCIDENT_STATUSES,
  INVALID_RULES,
  IncidentsAnalysisSummary,
  incidentCategoryLabels,
  incidentStatusLabels,
  invalidRuleLabels,
} from "../types/incidents";

const INCIDENTS_API_URL =
  process.env.NEXT_PUBLIC_INCIDENTS_API_URL ?? "http://localhost:8000";

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

/** Extrae un mensaje legible del cuerpo de error de la API (formato de
 *  validación FastAPI, o `detail`/`error`/`message`); si no reconoce el
 *  formato, o el cuerpo no es JSON, cae al mensaje por defecto. */
async function extractErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = await response.json();

    if (Array.isArray(body?.detail)) {
      const messages = body.detail
        .map((issue: { msg?: unknown }) => issue.msg)
        .filter((msg: unknown): msg is string => typeof msg === "string");
      if (messages.length > 0) return messages.join(" ");
    }

    if (typeof body?.detail === "string") return body.detail;
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
  } catch {
    // el cuerpo de la respuesta no es JSON o esta vacio, se usa el mensaje por defecto
  }
  return fallbackMessage;
}

// ─── Endpoints: incidencias ───────────────────────────────────────────

/** Sube un CSV de tickets de soporte y devuelve el resumen agregado del análisis. */
export async function analyzeIncidentsCsv(file: File): Promise<IncidentsAnalysisSummary> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${INCIDENTS_API_URL}/api/incidents/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "No se pudo analizar el archivo."));
  }

  const dto = (await response.json()) as AnalysisSummaryDto;
  return toIncidentsAnalysisSummary(dto);
}

/** Descarga el resultado del último análisis como CSV y dispara la descarga en el navegador. */
export async function downloadIncidentsResultsCsv(): Promise<void> {
  const response = await fetch(`${INCIDENTS_API_URL}/api/incidents/results/export`);

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, "No se pudo exportar el resultado del análisis.")
    );
  }

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
