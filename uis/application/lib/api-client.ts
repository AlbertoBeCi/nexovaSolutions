/**
 * NEXOVA SOLUTIONS - lib/api-client.ts
 * Cliente HTTP generico contra services/api (FastAPI), compartido por todos
 * los dominios (proveedores, auth, ...). Cada dominio trae su propio
 * `translateIssue` para traducir los errores 422 de Pydantic a español.
 *
 * Centraliza el ciclo de vida del token: adjunta `Authorization: Bearer
 * <token>` en cada request si hay uno guardado, y si una request que SI
 * llevaba token responde 401 (sesion invalida/expirada), limpia el storage
 * y redirige a /login. Un 401 en una request SIN token (ej. login con
 * credenciales malas) no dispara nada de esto: se propaga como error normal
 * para que la pagina lo muestre en el formulario.
 */

import { clearToken, getToken } from "@/lib/auth-storage";

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
    throw new Error("No se pudo conectar con el servidor. Comprueba que la API está en marcha.");
  }

  if (response.status === 401 && token) {
    clearToken();
    // Navegacion dura a proposito: apiRequest corre fuera de un componente
    // o evento de React (no hay useRouter aca), y un reload completo deja
    // el estado del cliente limpio tras invalidar la sesion.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (typeof window !== "undefined") window.location.href = "/login";
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, fallbackMessage, translateIssue));
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
