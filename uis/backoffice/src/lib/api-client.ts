/**
 * NEXOVA SOLUTIONS - lib/api-client.ts
 * Cliente HTTP generico contra services/api (FastAPI). Usa la misma
 * variable de entorno que services/incidents-api.ts
 * (NEXT_PUBLIC_INCIDENTS_API_URL) porque apunta al mismo backend. Cada
 * dominio trae su propio `translateIssue` para traducir los errores 422 de
 * Pydantic a español.
 *
 * Centraliza el ciclo de vida del token: adjunta `Authorization: Bearer
 * <token>` en cada request si hay uno guardado, y si una request que SI
 * llevaba token responde 401 (sesion invalida/expirada), limpia el storage
 * y redirige a /login. Un 401 en una request SIN token (ej. login con
 * credenciales malas) no dispara nada de esto: se propaga como error normal
 * para que la pagina lo muestre en el formulario.
 */

import { clearToken, getToken } from "./auth-storage";
import { getLoginHref } from "./auth-navigation";

export const API_URL = process.env.NEXT_PUBLIC_INCIDENTS_API_URL ?? "http://localhost:8000";

export interface ValidationIssue {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
}

export type TranslateIssue = (issue: ValidationIssue) => string;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly apiDetail: string | null = null
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface ExtractedApiError {
  message: string;
  detail: string | null;
}

async function extractApiError(
  response: Response,
  fallbackMessage: string,
  translateIssue: TranslateIssue
): Promise<ExtractedApiError> {
  try {
    const body = await response.json();

    if (Array.isArray(body?.detail)) {
      const issues = body.detail as ValidationIssue[];
      const messages = [...new Set(issues.map(translateIssue))];
      if (messages.length > 0) return { message: messages.join(" "), detail: null };
    }

    if (typeof body?.detail === "string") {
      const detail = body.detail.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500);
      const isMarkupOrJson = /^\s*</.test(detail) || /^\s*[\[{]/.test(detail);
      if (detail && !isMarkupOrJson) return { message: detail, detail };
    }
  } catch {
    // Respuesta vacía o no JSON: conservar el fallback legible.
  }
  return { message: fallbackMessage, detail: null };
}

/** Extrae un mensaje legible del cuerpo de error de la API; si no reconoce
 *  el formato, o el cuerpo no es JSON, cae al mensaje por defecto. */
export async function extractErrorMessage(
  response: Response,
  fallbackMessage: string,
  translateIssue: TranslateIssue
): Promise<string> {
  return (await extractApiError(response, fallbackMessage, translateIssue)).message;
}

/** fetch contra la API que adjunta el token guardado (si hay), convierte
 *  fallos de red y respuestas no-2xx en Error con mensaje en español, y
 *  redirige a /login si una llamada autenticada responde 401. */
export async function apiRequest(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
  translateIssue: TranslateIssue
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiRequestError(
      "No se pudo conectar con el servidor. Comprueba que la API está en marcha.",
      null
    );
  }

  if (response.status === 401 && token) {
    clearToken();
    // Navegacion dura a proposito: apiRequest corre fuera de un componente
    // o evento de React (no hay useRouter aca), y un reload completo deja
    // el estado del cliente limpio tras invalidar la sesion.
    if (typeof window !== "undefined") {
      window.location.href = getLoginHref(`${window.location.pathname}${window.location.search}`);
    }
  }

  if (!response.ok) {
    const apiError = await extractApiError(response, fallbackMessage, translateIssue);
    throw new ApiRequestError(
      apiError.message,
      response.status,
      apiError.detail
    );
  }
  return response;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
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
