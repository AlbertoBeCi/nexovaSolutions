import {
  createIncident,
  getIncidentsSummary,
  IncidentsApiError,
  listIncidents,
  transitionErrorMessage,
  updateIncidentStatus,
} from "@/lib/incidents-api";
import { INCIDENT_STATUSES, type IncidentStatus, type NewIncident } from "@/types/incident";
import { jsonResponse, mockFetch, sentUrl, textResponse } from "./helpers";

const DTO = {
  id: 3,
  title: "Fallo",
  description: "Detalle",
  category: "technical_failure",
  status: "open",
  origin: "customer",
  branch: "central",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};
const NEW_INCIDENT: NewIncident = {
  title: "Fallo",
  description: "Detalle",
  category: "technical_failure",
  origin: "customer",
  branch: "central",
};
const NO_FILTERS = { status: null, origin: null, branch: null };

function backendError(status: number, code: string, fields?: Record<string, string>) {
  return jsonResponse(status, { error: { code, message: "TEXTO-DEL-BACKEND", fields } });
}

async function catchError(promise: Promise<unknown>): Promise<IncidentsApiError> {
  try {
    await promise;
  } catch (err) {
    return err as IncidentsApiError;
  }
  throw new Error("Se esperaba un error");
}

describe("mapeo DTO -> Incident", () => {
  it("convierte created_at/updated_at a camelCase", async () => {
    mockFetch(jsonResponse(200, [DTO]));

    const [incident] = await listIncidents(NO_FILTERS);

    expect(incident).toEqual({
      id: 3,
      title: "Fallo",
      description: "Detalle",
      category: "technical_failure",
      status: "open",
      origin: "customer",
      branch: "central",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("createIncident devuelve la incidencia mapeada", async () => {
    mockFetch(jsonResponse(201, DTO));

    expect((await createIncident(NEW_INCIDENT)).createdAt).toBe("2026-01-01T00:00:00Z");
  });

  it("getIncidentsSummary devuelve el resumen tal cual", async () => {
    const summary = { status: { open: 1 }, category: {}, origin: {}, branch: {} };
    mockFetch(jsonResponse(200, summary));

    expect(await getIncidentsSummary()).toEqual(summary);
  });
});

describe("filtros del listado", () => {
  it.each([
    [NO_FILTERS, ""],
    [{ ...NO_FILTERS, status: "open" }, "status=open"],
    [{ status: "resolved", origin: "internal", branch: "remote" }, "status=resolved&origin=internal&branch=remote"],
  ] as const)("%j -> «%s»", async (filters, query) => {
    const fetchMock = mockFetch(jsonResponse(200, []));

    await listIncidents({ ...filters });

    expect(sentUrl(fetchMock).search.replace(/^\?/, "")).toBe(query);
  });
});

describe("transitionErrorMessage", () => {
  it("mismo estado", () => {
    expect(transitionErrorMessage("open", "open")).toBe("La incidencia ya está en estado «Abierta».");
  });

  it.each(["resolved", "discarded"] as const)("salir de un estado final (%s)", (final) => {
    expect(transitionErrorMessage(final, "open")).toContain("está en un estado final");
    expect(transitionErrorMessage(final, "open")).toContain(final === "resolved" ? "Resuelta" : "Descartada");
  });

  it("salto de estado no permitido", () => {
    expect(transitionErrorMessage("open", "resolved")).toBe(
      "No se puede pasar de «Abierta» a «Resuelta»."
    );
  });

  it("siempre produce texto en español, nunca el código crudo", () => {
    for (const from of INCIDENT_STATUSES) {
      for (const to of INCIDENT_STATUSES) {
        const message = transitionErrorMessage(from as IncidentStatus, to as IncidentStatus);
        expect(message).not.toMatch(/in_progress|discarded|resolved|open/);
      }
    }
  });
});

describe("errores de dominio", () => {
  it("400 de validación: mensajes propios por campo y nunca el texto del backend", async () => {
    mockFetch(backendError(400, "validation_error", { title: "x", branch: "y" }));

    const error = await catchError(createIncident(NEW_INCIDENT));

    expect(error).toBeInstanceOf(IncidentsApiError);
    expect(error.kind).toBe("validation");
    expect(error.message).toBe("Alguno de los datos enviados no es válido.");
    expect(error.fieldErrors).toEqual({
      title: "El título es obligatorio.",
      branch: "Selecciona una sede válida.",
    });
    expect(JSON.stringify(error)).not.toContain("TEXTO-DEL-BACKEND");
    expect(error.message).not.toContain("TEXTO-DEL-BACKEND");
  });

  it("campo desconocido: mensaje genérico", async () => {
    mockFetch(backendError(400, "validation_error", { campo_nuevo: "z" }));

    expect((await catchError(createIncident(NEW_INCIDENT))).fieldErrors).toEqual({
      campo_nuevo: "Revisa este campo.",
    });
  });

  it.each([
    [404, "not_found", "not_found", "No se encontró la incidencia solicitada."],
    [500, "internal_error", "server", "Ha ocurrido un error interno. Inténtalo de nuevo más tarde."],
    [400, "invalid_transition", "invalid_transition", "No se pudo completar la operación."],
    [418, "codigo_nuevo", "server", "No se pudo completar la operación."],
  ])("%i %s -> kind %s", async (status, code, kind, message) => {
    mockFetch(backendError(status, code));

    const error = await catchError(listIncidents(NO_FILTERS));

    expect(error.kind).toBe(kind);
    expect(error.message).toBe(message);
    expect(error.fieldErrors).toEqual({});
  });

  it("cuerpo que no es JSON: error de servidor genérico", async () => {
    mockFetch(textResponse(502, "<html>Bad Gateway</html>"));

    const error = await catchError(listIncidents(NO_FILTERS));

    expect(error.kind).toBe("server");
    expect(error.message).toBe("No se pudo completar la operación.");
  });

  it("JSON sin la clave error: error de servidor genérico", async () => {
    mockFetch(jsonResponse(500, { detail: "otra cosa" }));

    expect((await catchError(listIncidents(NO_FILTERS))).kind).toBe("server");
  });

  it("red caída: kind network con mensaje en español", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    const error = await catchError(listIncidents(NO_FILTERS));

    expect(error.kind).toBe("network");
    expect(error.message).toContain("No se pudo conectar con el servidor de incidencias");
  });
});

describe("updateIncidentStatus", () => {
  it("devuelve la incidencia actualizada", async () => {
    mockFetch(jsonResponse(200, { ...DTO, status: "in_progress" }));

    const incident = await updateIncidentStatus(3, "open", "in_progress");

    expect(incident.status).toBe("in_progress");
  });

  it("transición inválida: reescribe el mensaje con las etiquetas de la UI", async () => {
    mockFetch(backendError(400, "invalid_transition"));

    const error = await catchError(updateIncidentStatus(3, "open", "resolved"));

    expect(error.kind).toBe("invalid_transition");
    expect(error.message).toBe("No se puede pasar de «Abierta» a «Resuelta».");
  });

  it("transición desde un estado final: mensaje de estado final", async () => {
    mockFetch(backendError(400, "invalid_transition"));

    const error = await catchError(updateIncidentStatus(3, "resolved", "open"));

    expect(error.message).toContain("estado final");
  });

  it("otros errores se propagan sin reescribir", async () => {
    mockFetch(backendError(404, "not_found"));

    const error = await catchError(updateIncidentStatus(99, "open", "in_progress"));

    expect(error.kind).toBe("not_found");
  });

  it("un error de validación del estado conserva el campo", async () => {
    mockFetch(backendError(400, "validation_error", { status: "x" }));

    const error = await catchError(updateIncidentStatus(3, "open", "in_progress"));

    expect(error.fieldErrors).toEqual({ status: "El estado indicado no es válido." });
  });
});
