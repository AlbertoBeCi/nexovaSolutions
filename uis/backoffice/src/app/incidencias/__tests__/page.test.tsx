import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";

import IncidenciasPage from "../page";

const mockAnalyzeIncidentsCsv = jest.fn();

jest.mock("../../../services/incidents-api", () => ({
  analyzeIncidentsCsv: (...args: unknown[]) => mockAnalyzeIncidentsCsv(...args),
  downloadIncidentsResultsCsv: jest.fn(),
}));

jest.mock("../../_components/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("../_components/csv-uploader", () => ({
  CsvUploader: ({ onFileSelected }: { onFileSelected: (file: File) => void }) => (
    <button type="button" onClick={() => onFileSelected(new File(["ticket"], "tickets.csv"))}>
      Seleccionar CSV de prueba
    </button>
  ),
}));

const summary = {
  sourceFile: "tickets.csv",
  analyzedAt: null,
  totalRecords: 1,
  validRecords: 1,
  invalidRecords: 0,
  invalidBreakdown: [],
  categories: [],
  statuses: [],
  satisfaction: { closedTickets: 0, scoredTickets: 0, averageScore: 0, distribution: [] },
};

it("solo carga y muestra el resumen diferido después de un análisis correcto", async () => {
  let resolveAnalysis!: (value: typeof summary) => void;
  mockAnalyzeIncidentsCsv.mockReturnValue(new Promise((resolve) => { resolveAnalysis = resolve; }));
  render(<IncidenciasPage />);

  expect(screen.queryByText(/Resultado del análisis/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Seleccionar CSV de prueba" }));
  expect(screen.getByRole("status")).toHaveTextContent("Analizando archivo");

  await act(async () => resolveAnalysis(summary));
  expect(await screen.findByText("Resultado del análisis: tickets.csv")).toBeInTheDocument();
});
