import { getWeeklyOfficeProgramPerformance, isIsoMonday } from "../business-performance";
import { getToken, setToken } from "../../lib/auth-storage";
import { jsonResponse, mockFetch, sentUrl } from "./helpers";

jest.mock("../telemetry", () => ({ track: jest.fn() }));

beforeEach(() => { window.localStorage.clear(); setToken("report-token"); });
afterEach(() => jest.restoreAllMocks());

const report = { week_start: "2026-11-02", entries: [] };

test("consulta la última semana mediante el cliente autenticado sin cachear", async () => {
  const fetchMock = mockFetch(jsonResponse(200, report));
  await expect(getWeeklyOfficeProgramPerformance()).resolves.toEqual(report);
  expect(sentUrl(fetchMock).pathname).toBe("/reporting/weekly-office-program-performance");
  expect(sentUrl(fetchMock).search).toBe("");
  expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer report-token");
});

test("envía el lunes ISO seleccionado sin cambiar el contrato KPI", async () => {
  const response = { ...report, entries: [{ office: "miami", programme_id: "ventas-b2b", total_material_cost: 12.5, kits_delivered_count: 2, shortage_events_count: 1, cost_variance_events_count: 0, currency: "USD" }] };
  const fetchMock = mockFetch(jsonResponse(200, response));
  await expect(getWeeklyOfficeProgramPerformance("2026-11-02")).resolves.toEqual(response);
  expect(sentUrl(fetchMock).searchParams.get("week_start")).toBe("2026-11-02");
});

test.each(["2026-11-03", "2026-02-30", "texto", "", "2026-1-5"])("rechaza una semana inválida antes de consultar: %s", async (value) => {
  const fetchMock = mockFetch();
  expect(isIsoMonday(value)).toBe(false);
  await expect(getWeeklyOfficeProgramPerformance(value)).rejects.toThrow("Selecciona el lunes");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("acepta el lunes de cambio de año ISO", () => { expect(isIsoMonday("2025-12-29")).toBe(true); });

test.each([403, 503, 422])("traduce el error %s sin exponer detalles del servidor", async (status) => {
  mockFetch(jsonResponse(status, { detail: "private backend details" }));
  await expect(getWeeklyOfficeProgramPerformance()).rejects.toThrow(status === 403 ? "solo para administradores" : "No se pudo cargar el reporte");
});

test("traduce un fallo de red", async () => {
  mockFetch(new Error("Failed to fetch"));
  await expect(getWeeklyOfficeProgramPerformance()).rejects.toThrow("Comprueba la conexión");
});

test("un 401 conserva la limpieza central de sesión y muestra español", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockFetch(jsonResponse(401, { detail: "Not authenticated" }));
  await expect(getWeeklyOfficeProgramPerformance()).rejects.toThrow("La sesión ha caducado");
  expect(getToken()).toBeNull();
});
