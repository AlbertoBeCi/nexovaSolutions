import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";

import TelemetryPage from "../page";

const mockGetTelemetryReport = jest.fn();
let mockRole: "admin" | "manager" | "user" = "admin";

jest.mock("../../_components/require-auth", () => ({
  RequireAuth: ({ children }: { children: (user: { role: string }) => React.ReactNode }) => (
    <>{children({ role: mockRole })}</>
  ),
}));

jest.mock("../../../services/telemetry-report", () => ({
  getTelemetryReport: (...args: unknown[]) => mockGetTelemetryReport(...args),
}));

const report = {
  period: { from: "2026-11-01T00:00:00Z", to: "2026-11-08T00:00:00Z" },
  metrics: {
    events_per_day: [{ date: "2026-11-03", event_type: "client_request_completed", events: 25 }],
    request_error_rate: [{ date: "2026-11-03", route_template: "/auth/login", requests: 10, errors: 2, error_rate: 0.2 }],
    latency_by_route: [{ date: "2026-11-03", route_template: "/auth/login", samples: 10, mean_ms: 120.5, p95_ms: 250 }],
    auth_failure_rate: [{ date: "2026-11-03", attempts: 10, failures: 2, failure_rate: 0.2 }],
  },
};

beforeEach(() => {
  mockRole = "admin";
  mockGetTelemetryReport.mockReset();
});

test("muestra el período UTC y las cuatro métricas operacionales", async () => {
  mockGetTelemetryReport.mockResolvedValue(report);
  render(<TelemetryPage />);

  expect(await screen.findByText(/Período UTC:/)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Volumen de eventos" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Errores de peticiones" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Latencia observada" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Fallos de inicio de sesión" })).toBeInTheDocument();
  expect(screen.getByText("Petición completada")).toBeInTheDocument();
  expect(screen.getAllByText(/20\s*%/)).toHaveLength(2);
});

test("muestra un estado vacío cuando el período no tiene eventos", async () => {
  mockGetTelemetryReport.mockResolvedValue({
    ...report,
    metrics: {
      events_per_day: [],
      request_error_rate: [],
      latency_by_route: [],
      auth_failure_rate: [],
    },
  });
  render(<TelemetryPage />);

  expect(await screen.findByText("No hay eventos en este período.")).toBeInTheDocument();
  expect(screen.getByText("No hay intentos de inicio de sesión registrados en este período.")).toBeInTheDocument();
});

test("permite reintentar cuando falla la consulta", async () => {
  mockGetTelemetryReport.mockRejectedValueOnce(new Error("No hay conexión con la API."));
  mockGetTelemetryReport.mockResolvedValueOnce(report);
  render(<TelemetryPage />);

  fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("heading", { name: "Volumen de eventos" })).toBeInTheDocument();
  expect(mockGetTelemetryReport).toHaveBeenCalledTimes(2);
});

test("no solicita ni expone el reporte a usuarios que no son administradores", async () => {
  mockRole = "user";
  render(<TelemetryPage />);

  expect(screen.getByRole("alert")).toHaveTextContent("solo para administradores");
  expect(mockGetTelemetryReport).not.toHaveBeenCalled();
});

test("muestra la carga y permite actualizar el reporte", async () => {
  let resolveReport!: (value: typeof report) => void;
  mockGetTelemetryReport.mockReturnValue(new Promise((resolve) => { resolveReport = resolve; }));
  render(<TelemetryPage />);

  expect(screen.getByRole("status")).toHaveTextContent("Cargando métricas técnicas");
  await act(async () => {
    resolveReport(report);
    await Promise.resolve();
  });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar reporte" }));
  expect(mockGetTelemetryReport).toHaveBeenCalledTimes(2);
});
