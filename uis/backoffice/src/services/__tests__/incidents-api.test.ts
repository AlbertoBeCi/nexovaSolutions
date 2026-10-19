import { analyzeIncidentsCsv, downloadIncidentsResultsCsv } from "../incidents-api";
import { INCIDENT_CATEGORIES, INCIDENT_STATUSES, INVALID_RULES } from "../../types/incidents";
import { getToken, setToken } from "../../lib/auth-storage";
import { jsonResponse, mockFetch } from "./helpers";

const DTO = {
  source_file: "tickets.csv",
  analyzed_at: "2026-01-01T00:00:00+00:00",
  total_records: 10,
  valid_records: 8,
  invalid_records: 2,
  invalid_breakdown: {
    missing_company: 1, invalid_category: 0, short_description: 0, invalid_agent_id: 0,
    invalid_email: 1, closed_no_score: 0, score_out_of_range: 0,
  },
  categories: { TECHNICAL: { count: 4, percentage: 50 }, BILLING: { count: 4, percentage: 50 } },
  statuses: { OPEN: { count: 8, percentage: 100 } },
  satisfaction: {
    closed_tickets: 3, scored_tickets: 3, average_score: 3.67,
    distribution: { "3": 2, "5": 1 },
  },
};
const FILE = new File(["a,b"], "tickets.csv", { type: "text/csv" });

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("analyzeIncidentsCsv: mapeo del resumen", () => {
  it("convierte los campos y traduce las etiquetas al español", async () => {
    mockFetch(jsonResponse(200, DTO));

    const summary = await analyzeIncidentsCsv(FILE);

    expect(summary.sourceFile).toBe("tickets.csv");
    expect(summary.analyzedAt).toBe("2026-01-01T00:00:00+00:00");
    expect([summary.totalRecords, summary.validRecords, summary.invalidRecords]).toEqual([10, 8, 2]);
    expect(summary.satisfaction).toMatchObject({ closedTickets: 3, scoredTickets: 3, averageScore: 3.67 });
  });

  it("siempre devuelve todas las reglas, categorías y estados, en orden fijo", async () => {
    mockFetch(jsonResponse(200, DTO));

    const summary = await analyzeIncidentsCsv(FILE);

    expect(summary.invalidBreakdown.map((r) => r.rule)).toEqual([...INVALID_RULES]);
    expect(summary.categories.map((c) => c.code)).toEqual([...INCIDENT_CATEGORIES]);
    expect(summary.statuses.map((s) => s.code)).toEqual([...INCIDENT_STATUSES]);
  });

  it("rellena con 0 lo que la API no envía", async () => {
    mockFetch(jsonResponse(200, DTO));

    const summary = await analyzeIncidentsCsv(FILE);

    const complaint = summary.categories.find((c) => c.code === "COMPLAINT");
    expect(complaint).toMatchObject({ count: 0, percentage: 0 });
    expect(summary.statuses.find((s) => s.code === "CLOSED")).toMatchObject({ count: 0, percentage: 0 });
    expect(summary.invalidBreakdown.find((r) => r.rule === "invalid_category")?.count).toBe(0);
  });

  it("la distribución cubre las puntuaciones 1 a 5", async () => {
    mockFetch(jsonResponse(200, DTO));

    const { distribution } = (await analyzeIncidentsCsv(FILE)).satisfaction;

    expect(distribution).toEqual([
      { score: 1, count: 0 }, { score: 2, count: 0 }, { score: 3, count: 2 },
      { score: 4, count: 0 }, { score: 5, count: 1 },
    ]);
  });

  it("etiquetas legibles: ninguna es el código crudo", async () => {
    mockFetch(jsonResponse(200, DTO));

    const summary = await analyzeIncidentsCsv(FILE);

    for (const item of [...summary.categories, ...summary.statuses]) expect(item.label).not.toBe(item.code);
    for (const item of summary.invalidBreakdown) expect(item.label).not.toBe(item.rule);
  });

  it("analyzedAt puede ser null", async () => {
    mockFetch(jsonResponse(200, { ...DTO, analyzed_at: null }));

    expect((await analyzeIncidentsCsv(FILE)).analyzedAt).toBeNull();
  });
});

describe("analyzeIncidentsCsv: errores en español", () => {
  it.each([
    ["El archivo debe tener extension .csv.", "El archivo debe tener extensión .csv."],
    ["El archivo esta vacio.", "El archivo está vacío."],
    ["El archivo no es un CSV valido.", "El archivo no es un CSV válido."],
    ["El archivo no esta codificado en UTF-8.", "El archivo no está codificado en UTF-8."],
  ])("corrige las tildes de «%s»", async (raw, polished) => {
    mockFetch(jsonResponse(400, { detail: raw }));

    await expect(analyzeIncidentsCsv(FILE)).rejects.toThrow(polished);
  });

  it("deja pasar sin cambios un mensaje que no conoce", async () => {
    mockFetch(jsonResponse(400, { detail: "Faltan columnas requeridas en el CSV: date" }));

    await expect(analyzeIncidentsCsv(FILE)).rejects.toThrow("Faltan columnas requeridas en el CSV: date");
  });

  it.each([
    [{ type: "missing", loc: ["body", "file"], msg: "Field required" }, "El campo «Archivo CSV» es obligatorio."],
    [{ type: "other", loc: ["body", "file"], msg: "Algo" }, "Revisa el campo «Archivo CSV»."],
    [{ type: "missing", loc: ["body", "otro"], msg: "Field required" }, "Alguno de los datos enviados no es válido."],
    [{ type: "missing", loc: ["body", "file"] }, "Alguno de los datos enviados no es válido."],
  ])("422 %j", async (issue, message) => {
    mockFetch(jsonResponse(422, { detail: [issue] }));

    await expect(analyzeIncidentsCsv(FILE)).rejects.toThrow(message);
  });

  it("nunca muestra el msg crudo de Pydantic", async () => {
    mockFetch(jsonResponse(422, { detail: [{ type: "missing", loc: ["body", "file"], msg: "Field required" }] }));

    await expect(analyzeIncidentsCsv(FILE)).rejects.not.toThrow(/Field required/);
  });

  it("401 con sesión: cierra la sesión", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    setToken("caducado");
    mockFetch(jsonResponse(401, { detail: "Credenciales invalidas o token expirado." }));

    await expect(analyzeIncidentsCsv(FILE)).rejects.toThrow();

    expect(getToken()).toBeNull();
  });

  it("red caída: mensaje de conexión", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    await expect(analyzeIncidentsCsv(FILE)).rejects.toThrow("No se pudo conectar con el servidor.");
  });
});

describe("downloadIncidentsResultsCsv", () => {
  function stubDownloadEnvironment() {
    const click = jest.fn();
    const created: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") {
        el.click = click;
        created.push(el as HTMLAnchorElement);
      }
      return el;
    });
    URL.createObjectURL = jest.fn(() => "blob:fake");
    URL.revokeObjectURL = jest.fn();
    return { click, created };
  }

  it("dispara la descarga de results.csv y libera la URL", async () => {
    const { click, created } = stubDownloadEnvironment();
    mockFetch(new Response("metric,value\n", { status: 200 }));

    await downloadIncidentsResultsCsv();

    expect(click).toHaveBeenCalledTimes(1);
    expect(created[0].download).toBe("results.csv");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(document.querySelector("a")).toBeNull();
  });

  it("sin análisis previo (404): lanza el mensaje de la API y no descarga", async () => {
    const { click } = stubDownloadEnvironment();
    mockFetch(jsonResponse(404, { detail: "No hay ningun analisis previo para exportar." }));

    await expect(downloadIncidentsResultsCsv()).rejects.toThrow("No hay ningun analisis previo");

    expect(click).not.toHaveBeenCalled();
  });

  it("libera la URL aunque falle el clic", async () => {
    stubDownloadEnvironment();
    jest.spyOn(document.body, "appendChild").mockImplementation(() => {
      throw new Error("DOM roto");
    });
    mockFetch(new Response("x", { status: 200 }));

    await expect(downloadIncidentsResultsCsv()).rejects.toThrow("DOM roto");

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
