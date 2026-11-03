import { getTelemetryReport } from "../telemetry-report";

const mockApiRequest = jest.fn();

jest.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  genericTranslateIssue: jest.fn(),
}));

test("loads the report through the authenticated telemetry API client", async () => {
  const report = { period: { from: "2026-11-01T00:00:00Z", to: "2026-11-08T00:00:00Z" }, metrics: {} };
  mockApiRequest.mockResolvedValue({ json: async () => report });

  await expect(getTelemetryReport()).resolves.toBe(report);
  expect(mockApiRequest).toHaveBeenCalledWith(
    "/telemetry/report",
    { method: "GET" },
    "No se pudo cargar el reporte técnico de telemetría.",
    expect.any(Function)
  );
});
