import { ApiRequestError, apiRequest, genericTranslateIssue } from "../lib/api-client";
import type { WeeklyOfficeProgramPerformance } from "../../../../packages/shared/types/business-performance";

export function isIsoMonday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && parsed.getUTCDay() === 1;
}

export async function getWeeklyOfficeProgramPerformance(weekStart?: string): Promise<WeeklyOfficeProgramPerformance> {
  if (weekStart !== undefined && !isIsoMonday(weekStart)) {
    throw new Error("Selecciona el lunes de la semana que quieres consultar.");
  }
  const query = weekStart ? "?week_start=" + encodeURIComponent(weekStart) : "";
  try {
    const response = await apiRequest(
      "/reporting/weekly-office-program-performance" + query,
      { method: "GET", cache: "no-store" },
      "No se pudo cargar el reporte de desempeño. Inténtalo de nuevo.",
      genericTranslateIssue
    );
    return await response.json() as WeeklyOfficeProgramPerformance;
  } catch (error: unknown) {
    if (error instanceof ApiRequestError && error.status === 403) {
      throw new Error("Este reporte está disponible solo para administradores.");
    }
    if (error instanceof ApiRequestError && error.status === 401) {
      throw new Error("La sesión ha caducado. Vuelve a iniciar sesión.");
    }
    throw new Error("No se pudo cargar el reporte de desempeño. Comprueba la conexión e inténtalo de nuevo.");
  }
}
