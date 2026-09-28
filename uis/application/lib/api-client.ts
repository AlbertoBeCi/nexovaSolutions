/**
 * NEXOVA SOLUTIONS - lib/api-client.ts
 * Cliente HTTP generico contra services/api (FastAPI), compartido por todos
 * los dominios (proveedores, auth, ...). Cada dominio trae su propio
 * `translateIssue` para traducir los errores 422 de Pydantic a español.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ValidationIssue {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
}

export type TranslateIssue = (issue: ValidationIssue) => string;

/** Extrae un mensaje legible del cuerpo de error de la API; si no reconoce
 *  el formato, o el cuerpo no es JSON, cae al mensaje por defecto. */
export async function extractErrorMessage(
  response: Response,
  fallbackMessage: string,
  translateIssue: TranslateIssue
): Promise<string> {
  try {
    const body = await response.json();

    if (Array.isArray(body?.detail)) {
      const messages = [...new Set((body.detail as ValidationIssue[]).map(translateIssue))];
      if (messages.length > 0) return messages.join(" ");
    }

    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // el cuerpo de la respuesta no es JSON o está vacío, se usa el mensaje por defecto
  }
  return fallbackMessage;
}

/** fetch contra la API que convierte fallos de red y respuestas no-2xx en Error con mensaje en español. */
export async function apiRequest(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
  translateIssue: TranslateIssue
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error("No se pudo conectar con el servidor. Comprueba que la API está en marcha.");
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, fallbackMessage, translateIssue));
  }
  return response;
}

export function jsonInit(method: string, body: unknown, headers?: HeadersInit): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

/** Traductor generico de fallback: usarlo cuando un dominio no tiene reglas propias. */
export function genericTranslateIssue(issue: ValidationIssue): string {
  if (issue.type === "value_error" && issue.msg) {
    return issue.msg.replace(/^Value error,\s*/i, "");
  }
  return "Alguno de los datos enviados no es válido.";
}
