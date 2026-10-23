import { act, fireEvent, render, screen } from "@testing-library/react";

import CandidateDetailPage from "../page";

const mockGetCandidateById = jest.fn();
const mockGetCandidateNotes = jest.fn();

jest.mock("../../../../services/api", () => ({
  getCandidateById: (...args: unknown[]) => mockGetCandidateById(...args),
  getCandidateResourceUrls: () => ({ candidate: "/records/candidate-1", notes: "/records/candidate-1/notes" }),
  getCandidateNotes: (...args: unknown[]) => mockGetCandidateNotes(...args),
  updateCandidateStatusStage: jest.fn(),
  addCandidateNote: jest.fn(),
  deleteCandidateNote: jest.fn(),
}));

const candidate = {
  id: "candidate-1",
  name: "Ana García",
  email: "ana@example.test",
  phone: "600 000 000",
  position: "Ingeniera de datos",
  linkedinUrl: null,
  resumeUrl: null,
  yearsOfExperience: 5,
  status: "received" as const,
  stage: "pending" as const,
  notesCount: 1,
  createdAt: new Date("2026-10-01T12:00:00Z"),
  updatedAt: new Date("2026-10-01T12:00:00Z"),
};

it("difiere la consulta y el panel de notas hasta que se abre el flujo", async () => {
  mockGetCandidateById.mockResolvedValue(candidate);
  let resolveNotes!: (value: { id: string; candidateId: string; text: string; date: Date }[]) => void;
  mockGetCandidateNotes.mockReturnValue(new Promise((resolve) => { resolveNotes = resolve; }));

  const params = Promise.resolve({ id: "candidate-1" });
  await act(async () => {
    render(<CandidateDetailPage params={params} />);
    await params;
  });
  expect(await screen.findByRole("heading", { name: "Ana García" })).toBeInTheDocument();
  expect(mockGetCandidateNotes).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "Notas internas" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Ver notas internas" }));
  expect(await screen.findByText("Cargando notas…")).toBeInTheDocument();
  expect(mockGetCandidateNotes).toHaveBeenCalledWith("candidate-1");

  await act(async () => resolveNotes([
    { id: "note-1", candidateId: "candidate-1", text: "Nota confidencial de prueba", date: new Date("2026-10-20T12:00:00Z") },
  ]));
  expect(await screen.findByText("Nota confidencial de prueba")).toBeInTheDocument();
});
