import { getCandidateById, getCandidateNotes, getCandidateResourceUrls } from "./api";

beforeEach(() => { globalThis.fetch = jest.fn(); });

test("la precarga y la lectura de candidato utilizan la misma URL", async () => {
  const fetchMock = jest.mocked(fetch).mockResolvedValue({ status: 404 } as Response);
  expect(await getCandidateById("audit-id")).toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe(getCandidateResourceUrls("audit-id").candidate);
});

test("la precarga y la lectura de notas utilizan la misma URL", async () => {
  const fetchMock = jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [], meta: { total: 0 } }) } as Response);
  expect(await getCandidateNotes("audit-id")).toEqual([]);
  expect(fetchMock.mock.calls[0][0]).toBe(getCandidateResourceUrls("audit-id").notes);
});

test("las notas pertenecen al recurso del candidato solicitado", () => {
  const resources = getCandidateResourceUrls("audit-id");
  expect(resources.notes).toBe(`${resources.candidate}/notes`);
});
