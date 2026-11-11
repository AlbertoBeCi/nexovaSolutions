import { fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { ReportingDashboard, ReportingPageContent } from "../reporting-dashboard";
import ReportingPage from "../page";

const mockGetReport = jest.fn();
const mockReplace = jest.fn();
let mockRole = "admin";
let mockSession = true;

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("../../_components/require-auth", () => ({
  RequireAuth: ({ children }: { children: (user: { role: string }) => React.ReactNode }) => mockSession ? <>{children({ role: mockRole })}</> : <p>Comprobando sesión…</p>,
}));
jest.mock("../../../services/business-performance", () => ({
  ...jest.requireActual("../../../services/business-performance"),
  getWeeklyOfficeProgramPerformance: (...args: unknown[]) => mockGetReport(...args),
}));

const report = {
  week_start: "2026-11-02",
  entries: [
    { office: "valencia", programme_id: "ventas-b2b", total_material_cost: 124, kits_delivered_count: 18, shortage_events_count: 1, cost_variance_events_count: 0, currency: "EUR" },
    { office: "miami", programme_id: "ventas-b2b", total_material_cost: 50.5, kits_delivered_count: 3, shortage_events_count: 2, cost_variance_events_count: 1, currency: "USD" },
  ],
};

beforeEach(() => { mockGetReport.mockReset(); mockReplace.mockReset(); mockRole = "admin"; mockSession = true; });

test("muestra período UTC, cuatro KPI exactos e importes separados por moneda", async () => {
  mockGetReport.mockResolvedValue(report);
  render(<ReportingPageContent />);
  expect(await screen.findByText(/Período UTC:/)).toHaveTextContent("2 de noviembre de 2026 — 8 de noviembre de 2026");
  for (const title of ["Costo de material por oficina/programa", "Kits entregados", "Frecuencia de escasez", "Frecuencia de variación de costo"]) {
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  }
  expect(screen.getByText(/124,00\s*EUR/)).toBeInTheDocument();
  expect(screen.getByText(/50,50\s*USD/)).toBeInTheDocument();
  expect(screen.getAllByText("Valencia")).toHaveLength(4);
  expect(screen.getAllByText("Miami")).toHaveLength(4);
  expect(within(screen.getByRole("table", { name: /Kits entregados/ })).getByText("18")).toBeInTheDocument();
  expect(mockGetReport).toHaveBeenCalledWith(undefined);
});

test("muestra vacío sin inventar ceros ni ocultar los nombres de los KPI", async () => {
  mockGetReport.mockResolvedValue({ ...report, entries: [] });
  render(<ReportingDashboard />);
  expect(await screen.findAllByText("No hay datos publicados para esta semana.")).toHaveLength(4);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("permite reintentar un error de consulta", async () => {
  mockGetReport.mockRejectedValueOnce(new Error("No hay conexión."));
  mockGetReport.mockResolvedValueOnce(report);
  render(<ReportingDashboard />);
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText(/Período UTC:/)).toBeInTheDocument();
  expect(mockGetReport).toHaveBeenCalledTimes(2);
});

test("carga la semana de la URL y conserva la elección al navegar", async () => {
  mockGetReport.mockResolvedValue(report);
  render(<ReportingDashboard weekStart="2026-11-02" />);
  await screen.findByText(/Período UTC:/);
  expect(mockGetReport).toHaveBeenCalledWith("2026-11-02");
  fireEvent.change(screen.getByLabelText("Semana (lunes)"), { target: { value: "2026-10-26" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar semana" }));
  expect(mockReplace).toHaveBeenCalledWith("/reporting?week_start=2026-10-26");
  fireEvent.click(screen.getByRole("button", { name: "Última semana publicada" }));
  expect(mockReplace).toHaveBeenLastCalledWith("/reporting");
});

test("rechaza un día que no sea lunes en el selector", async () => {
  mockGetReport.mockResolvedValue(report);
  render(<ReportingDashboard />);
  await screen.findByText(/Período UTC:/);
  fireEvent.change(screen.getByLabelText("Semana (lunes)"), { target: { value: "2026-11-03" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar semana" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Selecciona el lunes");
  expect(mockReplace).not.toHaveBeenCalled();
});

test("una semana inválida en la URL no dispara consultas", () => {
  render(<ReportingDashboard weekStart="2026-11-03" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Selecciona el lunes");
  expect(mockGetReport).not.toHaveBeenCalled();
});

test.each(["manager", "user"])("no solicita KPI para el rol %s", (role) => {
  mockRole = role;
  render(<ReportingPageContent />);
  expect(screen.getByRole("alert")).toHaveTextContent("solo para administradores");
  expect(mockGetReport).not.toHaveBeenCalled();
});

test("espera la autenticación antes de consultar", () => {
  mockSession = false;
  render(<ReportingPageContent />);
  expect(mockGetReport).not.toHaveBeenCalled();
});

test("muestra carga y permite actualizar", async () => {
  let resolve!: (value: typeof report) => void;
  mockGetReport.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  render(<ReportingDashboard />);
  expect(screen.getByRole("status")).toHaveTextContent("Cargando reporte");
  expect(screen.getByRole("button", { name: "Actualizar reporte" })).toBeDisabled();
  await act(async () => { resolve(report); });
  mockGetReport.mockResolvedValueOnce(report);
  fireEvent.click(screen.getByRole("button", { name: "Actualizar reporte" }));
  await screen.findByText(/Período UTC:/);
  expect(mockGetReport).toHaveBeenCalledTimes(2);
});

test("ignora respuestas de una semana anterior que llegan tarde", async () => {
  let resolveOld!: (value: typeof report) => void;
  mockGetReport.mockReturnValueOnce(new Promise((done) => { resolveOld = done; }));
  mockGetReport.mockResolvedValueOnce({ ...report, week_start: "2026-10-26" });
  const { rerender } = render(<ReportingDashboard weekStart="2026-11-02" />);
  rerender(<ReportingDashboard weekStart="2026-10-26" />);
  expect(await screen.findByText(/Período UTC:/)).toHaveTextContent("26 de octubre");
  await act(async () => { resolveOld(report); });
  expect(screen.getByText(/Período UTC:/)).toHaveTextContent("26 de octubre");
});

test("la página espera searchParams y rechaza parámetros repetidos", async () => {
  render(await ReportingPage({ searchParams: Promise.resolve({ week_start: ["2026-11-02", "2026-10-26"] }) }));
  expect(screen.getByRole("alert")).toHaveTextContent("Selecciona el lunes");
  expect(mockGetReport).not.toHaveBeenCalled();
});
