import {
  apiRequest,
  extractErrorMessage,
  genericTranslateIssue,
  type TranslateIssue,
} from "@/lib/api-client";
import { getToken, setToken } from "@/lib/auth-storage";
import { emptyResponse, jsonResponse, mockFetch, textResponse } from "./helpers";

const translate: TranslateIssue = (issue) => `T:${issue.type}`;
const FALLBACK = "Mensaje por defecto";

beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

describe("extractErrorMessage", () => {
  it("devuelve el detail cuando es texto", async () => {
    const response = jsonResponse(400, { detail: "Algo salió mal." });

    expect(await extractErrorMessage(response, FALLBACK, translate)).toBe("Algo salió mal.");
  });

  it("traduce cada issue de una lista y une los mensajes", async () => {
    const response = jsonResponse(422, { detail: [{ type: "missing" }, { type: "too_short" }] });

    expect(await extractErrorMessage(response, FALLBACK, translate)).toBe("T:missing T:too_short");
  });

  it("elimina mensajes repetidos", async () => {
    const response = jsonResponse(422, { detail: [{ type: "missing" }, { type: "missing" }] });

    expect(await extractErrorMessage(response, FALLBACK, translate)).toBe("T:missing");
  });

  it.each([
    ["lista vacía", jsonResponse(422, { detail: [] })],
    ["detail ausente", jsonResponse(500, { otra: "cosa" })],
    ["detail numérico", jsonResponse(500, { detail: 42 })],
    ["cuerpo vacío", emptyResponse(500)],
    ["cuerpo que no es JSON", textResponse(502, "<html>Bad Gateway</html>")],
  ])("usa el mensaje por defecto con %s", async (_name, response) => {
    expect(await extractErrorMessage(response, FALLBACK, translate)).toBe(FALLBACK);
  });
});

describe("genericTranslateIssue", () => {
  it("quita el prefijo «Value error,» de los value_error", () => {
    expect(genericTranslateIssue({ type: "value_error", msg: "Value error, Moneda inválida" })).toBe(
      "Moneda inválida"
    );
  });

  it("quita el prefijo sin distinguir mayúsculas", () => {
    expect(genericTranslateIssue({ type: "value_error", msg: "VALUE ERROR,   texto" })).toBe("texto");
  });

  it.each([
    [{ type: "value_error" }],
    [{ type: "missing", msg: "Field required" }],
    [{}],
  ])("devuelve el mensaje genérico en español para %j", (issue) => {
    expect(genericTranslateIssue(issue)).toBe("Alguno de los datos enviados no es válido.");
  });
});

describe("apiRequest", () => {
  it("devuelve la respuesta cuando es 2xx", async () => {
    mockFetch(jsonResponse(200, { ok: true }));

    const response = await apiRequest("/x", { method: "GET" }, FALLBACK, translate);

    expect(await response.json()).toEqual({ ok: true });
  });

  it("adjunta el token guardado como Bearer", async () => {
    setToken("tok123");
    const fetchMock = mockFetch(jsonResponse(200, {}));

    await apiRequest("/x", { method: "GET" }, FALLBACK, translate);

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok123");
  });

  it("no envía Authorization si no hay token", async () => {
    const fetchMock = mockFetch(jsonResponse(200, {}));

    await apiRequest("/x", { method: "GET" }, FALLBACK, translate);

    expect((fetchMock.mock.calls[0][1].headers as Headers).has("Authorization")).toBe(false);
  });

  it("conserva las cabeceras que ya traía la petición", async () => {
    setToken("tok");
    const fetchMock = mockFetch(jsonResponse(200, {}));

    await apiRequest("/x", { headers: { "X-Test": "1" } }, FALLBACK, translate);

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("X-Test")).toBe("1");
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  it("convierte un fallo de red en un error legible en español", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    await expect(apiRequest("/x", {}, FALLBACK, translate)).rejects.toThrow(
      "No se pudo conectar con el servidor. Comprueba que la API está en marcha."
    );
  });

  it.each([400, 403, 404, 409, 429, 500])("lanza el detail de la API en un %i", async (status) => {
    mockFetch(jsonResponse(status, { detail: `error ${status}` }));

    await expect(apiRequest("/x", {}, FALLBACK, translate)).rejects.toThrow(`error ${status}`);
  });

  it("traduce los errores 422 con la función del dominio", async () => {
    mockFetch(jsonResponse(422, { detail: [{ type: "missing" }] }));

    await expect(apiRequest("/x", {}, FALLBACK, translate)).rejects.toThrow("T:missing");
  });

  it("usa el mensaje por defecto si el error no trae cuerpo legible", async () => {
    mockFetch(textResponse(500, "boom"));

    await expect(apiRequest("/x", {}, FALLBACK, translate)).rejects.toThrow(FALLBACK);
  });

  describe("401", () => {
    it("con token: limpia la sesión y lanza el error", async () => {
      // jsdom no implementa la navegación y lo informa por console.error;
      // se silencia y se usa como señal de que se intentó ir a /login.
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      setToken("caducado");
      mockFetch(jsonResponse(401, { detail: "Credenciales inválidas." }));

      await expect(apiRequest("/x", {}, FALLBACK, translate)).rejects.toThrow("Credenciales inválidas.");

      expect(getToken()).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("navigation") }));
    });

    it("sin token: propaga el error sin tocar la sesión ni redirigir", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      mockFetch(jsonResponse(401, { detail: "Email o contraseña incorrectos." }));

      await expect(apiRequest("/x", {}, FALLBACK, translate)).rejects.toThrow(
        "Email o contraseña incorrectos."
      );

      expect(consoleError).not.toHaveBeenCalled();
    });

    it("otros errores con token no cierran la sesión", async () => {
      setToken("vigente");
      mockFetch(jsonResponse(403, { detail: "Prohibido." }));

      await expect(apiRequest("/x", {}, FALLBACK, translate)).rejects.toThrow("Prohibido.");

      expect(getToken()).toBe("vigente");
    });
  });
});
