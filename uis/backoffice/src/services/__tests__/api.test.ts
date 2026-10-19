import {
  addCandidateNote,
  createCandidate,
  deleteCandidateNote,
  getCandidateById,
  getCandidateNotes,
  getCandidates,
  updateCandidate,
  updateCandidateStatusStage,
  type CandidateInput,
} from "../api";
import { emptyResponse, jsonResponse, mockFetch, sentJson, sentUrl, textResponse } from "./helpers";

const RECORD = {
  id: "c1",
  full_name: "Ana Pérez",
  email: "ana@x.com",
  phone: "+34 600",
  position: "Backend",
  linkedin_url: null,
  cv_url: "https://cv.example/ana.pdf",
  status: "received",
  stage: "pending",
  experience_years: 4,
  notes_count: 2,
  applied_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-02T10:00:00Z",
};
const NOTE = { id: "n1", record_id: "c1", content: "Buen perfil", created_at: "2026-01-03T09:00:00Z" };
const INPUT: CandidateInput = {
  name: "Ana Pérez",
  email: "ana@x.com",
  phone: "+34 600",
  position: "Backend",
  linkedinUrl: null,
  resumeUrl: "https://cv.example/ana.pdf",
  yearsOfExperience: 4,
};

describe("mapeo DTO -> Candidate", () => {
  it("convierte nombres de campo y fechas", async () => {
    mockFetch(jsonResponse(200, { total: 1, page: 1, limit: 100, data: [RECORD] }));

    const [candidate] = await getCandidates();

    expect(candidate).toEqual({
      id: "c1",
      name: "Ana Pérez",
      email: "ana@x.com",
      phone: "+34 600",
      position: "Backend",
      linkedinUrl: null,
      resumeUrl: "https://cv.example/ana.pdf",
      yearsOfExperience: 4,
      status: "received",
      stage: "pending",
      notesCount: 2,
      createdAt: new Date("2026-01-01T10:00:00Z"),
      updatedAt: new Date("2026-01-02T10:00:00Z"),
    });
    expect(candidate.createdAt).toBeInstanceOf(Date);
  });

  it("lista vacía", async () => {
    mockFetch(jsonResponse(200, { total: 0, page: 1, limit: 100, data: [] }));

    expect(await getCandidates()).toEqual([]);
  });
});

describe("getCandidates: filtros", () => {
  const list = () => jsonResponse(200, { total: 0, page: 1, limit: 100, data: [] });

  it("sin filtros solo pide el límite", async () => {
    const fetchMock = mockFetch(list());

    await getCandidates();

    expect(sentUrl(fetchMock).searchParams.toString()).toBe("limit=100");
  });

  it("incluye búsqueda, estado y etapa cuando se dan", async () => {
    const fetchMock = mockFetch(list());

    await getCandidates({ search: "ana", status: "in_progress", stage: "review" });

    const params = sentUrl(fetchMock).searchParams;
    expect(params.get("search")).toBe("ana");
    expect(params.get("status")).toBe("in_progress");
    expect(params.get("stage")).toBe("review");
  });

  it("ignora filtros vacíos", async () => {
    const fetchMock = mockFetch(list());

    await getCandidates({ search: "" });

    expect(sentUrl(fetchMock).searchParams.has("search")).toBe(false);
  });
});

describe("getCandidateById", () => {
  it("devuelve el candidato mapeado", async () => {
    mockFetch(jsonResponse(200, RECORD));

    expect((await getCandidateById("c1"))?.name).toBe("Ana Pérez");
  });

  it("devuelve null si no existe (404)", async () => {
    mockFetch(jsonResponse(404, { message: "no existe" }));

    expect(await getCandidateById("zzz")).toBeNull();
  });

  it("otros errores sí lanzan", async () => {
    mockFetch(jsonResponse(500, { message: "Fallo del servidor" }));

    await expect(getCandidateById("c1")).rejects.toThrow("Fallo del servidor");
  });
});

describe("escritura de candidatos", () => {
  it("createCandidate envía solo los campos que acepta la API", async () => {
    const fetchMock = mockFetch(jsonResponse(201, RECORD));

    await createCandidate(INPUT);

    expect(sentJson(fetchMock)).toEqual({
      full_name: "Ana Pérez",
      email: "ana@x.com",
      phone: "+34 600",
      position: "Backend",
      linkedin_url: null,
      cv_url: "https://cv.example/ana.pdf",
      experience_years: 4,
    });
  });

  it("updateCandidate no toca status ni stage", async () => {
    const fetchMock = mockFetch(jsonResponse(200, RECORD));

    await updateCandidate("c1", INPUT);

    const body = sentJson(fetchMock);
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("stage");
  });

  it("updateCandidateStatusStage envía solo lo indicado", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { ...RECORD, status: "selected" }));

    const candidate = await updateCandidateStatusStage("c1", { status: "selected" });

    expect(sentJson(fetchMock)).toEqual({ status: "selected" });
    expect(candidate.status).toBe("selected");
  });
});

describe("notas", () => {
  it("getCandidateNotes mapea las notas", async () => {
    mockFetch(jsonResponse(200, { data: [NOTE], meta: { total: 1 } }));

    expect(await getCandidateNotes("c1")).toEqual([
      { id: "n1", candidateId: "c1", text: "Buen perfil", date: new Date("2026-01-03T09:00:00Z") },
    ]);
  });

  it("addCandidateNote devuelve la nota creada", async () => {
    const fetchMock = mockFetch(jsonResponse(201, NOTE));

    const note = await addCandidateNote("c1", "Buen perfil");

    expect(sentJson(fetchMock)).toEqual({ content: "Buen perfil" });
    expect(note.text).toBe("Buen perfil");
  });

  it("deleteCandidateNote resuelve sin cuerpo", async () => {
    mockFetch(emptyResponse(204));

    await expect(deleteCandidateNote("c1", "n1")).resolves.toBeUndefined();
  });

  it("deleteCandidateNote lanza el mensaje de la API si falla", async () => {
    mockFetch(jsonResponse(404, { error: "Nota no encontrada" }));

    await expect(deleteCandidateNote("c1", "n9")).rejects.toThrow("Nota no encontrada");
  });
});

describe("errores", () => {
  it("red caída: mensaje en español, no el TypeError nativo", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    await expect(getCandidates()).rejects.toThrow(
      "No se pudo conectar con el servidor. Comprueba tu conexión a internet."
    );
  });

  it.each([
    ["detail como lista con msg", { detail: [{ msg: "email inválido" }, { msg: "teléfono inválido" }] }, "email inválido teléfono inválido"],
    ["detail ignora entradas sin msg de texto", { detail: [{ msg: 5 }, { msg: "ok" }] }, "ok"],
    ["clave error", { error: "Mal" }, "Mal"],
    ["clave message", { message: "Peor" }, "Peor"],
  ])("extrae el mensaje: %s", async (_name, body, expected) => {
    mockFetch(jsonResponse(400, body));

    await expect(createCandidate(INPUT)).rejects.toThrow(expected);
  });

  it.each([
    ["lista de candidatos", () => getCandidates(), "No se pudo obtener la lista de candidatos"],
    ["candidato", () => getCandidateById("c1"), "No se pudo obtener el candidato c1"],
    ["alta", () => createCandidate(INPUT), "No se pudo guardar el candidato"],
    ["edición", () => updateCandidate("c1", INPUT), "No se pudo actualizar el candidato c1"],
    ["estado/etapa", () => updateCandidateStatusStage("c1", {}), "No se pudo actualizar el estado o etapa del candidato c1"],
    ["notas", () => getCandidateNotes("c1"), "No se pudieron obtener las notas del candidato c1"],
    ["nueva nota", () => addCandidateNote("c1", "x"), "No se pudo agregar la nota al candidato c1"],
    ["borrar nota", () => deleteCandidateNote("c1", "n1"), "No se pudo borrar la nota n1"],
  ])("%s: usa el mensaje por defecto si el cuerpo no es legible", async (_n, call, message) => {
    mockFetch(textResponse(500, "<html>boom</html>"));

    await expect(call()).rejects.toThrow(message);
  });

  it("lista de detail sin ningún msg válido cae al mensaje por defecto", async () => {
    mockFetch(jsonResponse(422, { detail: [{ msg: 1 }] }));

    await expect(getCandidates()).rejects.toThrow("No se pudo obtener la lista de candidatos");
  });
});
