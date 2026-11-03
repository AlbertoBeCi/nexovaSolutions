import { apiRequest, genericTranslateIssue } from "../lib/api-client";
import type { TelemetryReport } from "../../../../packages/shared/types/telemetry-report";

export async function getTelemetryReport(): Promise<TelemetryReport> {
  const response = await apiRequest(
    "/telemetry/report",
    { method: "GET" },
    "No se pudo cargar el reporte técnico de telemetría.",
    genericTranslateIssue
  );
  return (await response.json()) as TelemetryReport;
}
