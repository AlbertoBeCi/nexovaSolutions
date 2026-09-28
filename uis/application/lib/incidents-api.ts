/**
 * NEXOVA SOLUTIONS - lib/incidents-api.ts
 * Cliente HTTP centralizado contra services/incident-manager-api (puerto
 * 8001 por defecto): un servicio FastAPI DISTINTO de services/api (el que
 * usan lib/suppliers-api.ts y lib/auth-api.ts a través de lib/api-client.ts).
 *
 * Su formato de error es propio -
 * {"error": {"code", "message", "fields"?}} (ver
 * services/incident-manager-api/errors.py) - no el {"detail": [...]} de
 * Pydantic que traduce lib/api-client.ts, así que este archivo no reutiliza
 * apiRequest/extractErrorMessage: tiene su propio fetch de bajo nivel
 * (incidentsApiRequest) con la misma idea (nunca deja escapar una
 * excepción nativa de fetch/JSON, siempre lanza un error con mensaje en
 * español).
 *
 * Nunca se muestra el texto que arma el backend (ver
 * .agents/rules/idioma-y-dominio.md: la UI nunca muestra valores/textos
 * crudos de la API): de la respuesta de error solo se usan `code` y las
 * CLAVES de `fields`; todos los mensajes que ve la persona salen de los
 * diccionarios de este archivo (FIELD_ERROR_MESSAGES, GENERIC_MESSAGES,
 * transitionErrorMessage).
 */

import {
  INCIDENT_STATUS_LABELS,
  isFinalStatus,
  type Incident,
  type IncidentBranch,
  type IncidentCategory,
  type IncidentFilters,
  type IncidentOrigin,
  type IncidentStatus,
  type IncidentSummary,
  type NewIncident,
} from "@/types/incident";

export const INCIDENTS_API_URL =
  process.env.NEXT_PUBLIC_INCIDENTS_API_URL ?? "http://localhost:8001";

// ─── DTO de la API (snake_case, ver services/incident-manager-api/schemas.py) ──

interface IncidentDto {
  id: number;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  origin: IncidentOrigin;
  branch: IncidentBranch;
  created_at: string;
  updated_at: string;
}

interface ErrorBodyDto {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

function toIncident(dto: IncidentDto): Incident {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    category: dto.category,
    status: dto.status,
    origin: dto.origin,
    branch: dto.branch,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

// ─── Error de dominio ───────────────────────────────────────────────────

export type IncidentsApiErrorKind =
  | "validation"
  | "invalid_transition"
  | "not_found"
  | "network"
  | "server";

export class IncidentsApiError extends Error {
  readonly kind: IncidentsApiErrorKind;
  readonly fieldErrors: Record<string, string>;

  constructor(
    kind: IncidentsApiErrorKind,
    message: string,
    fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }
}

// Mensaje en español por CAMPO. Solo se usan las claves de `error.fields`
// que devuelve la API (nunca su valor): el texto que ve la persona sale de
// aquí, no del backend.
const FIELD_ERROR_MESSAGES: Record<string, string> = {
  title: "El título es obligatorio.",
  description: "La descripción es obligatoria.",
  category: "Selecciona una categoría válida.",
  origin: "Selecciona un origen válido.",
  branch: "Selecciona una sede válida.",
  status: "El estado indicado no es válido.",
};

function fieldMessage(field: string): string {
  return FIELD_ERROR_MESSAGES[field] ?? "Revisa este campo.";
}

// Mensaje general por `code`. Tampoco se usa `error.message` del backend.
const GENERIC_MESSAGES: Record<string, string> = {
  validation_error: "Alguno de los datos enviados no es válido.",
  not_found: "No se encontró la incidencia solicitada.",
  internal_error: "Ha ocurrido un error interno. Inténtalo de nuevo más tarde.",
};
const DEFAULT_ERROR_MESSAGE = "No se pudo completar la operación.";

function kindFromCode(code: string): IncidentsApiErrorKind {
  if (code === "not_found") return "not_found";
  if (code === "invalid_transition") return "invalid_transition";
  if (code === "validation_error") return "validation";
  return "server";
}

/** fetch de bajo nivel contra services/incident-manager-api: nunca deja
 * pasar una excepción nativa de fetch/JSON, siempre lanza IncidentsApiError
 * con un mensaje en español listo para mostrar. */
async function incidentsApiRequest(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${INCIDENTS_API_URL}${path}`, init);
  } catch {
    throw new IncidentsApiError(
      "network",
      "No se pudo conectar con el servidor de incidencias. Comprueba que está en marcha."
    );
  }

  if (!response.ok) {
    let body: ErrorBodyDto | null = null;
    try {
      body = (await response.json()) as ErrorBodyDto;
    } catch {
      body = null;
    }

    const code = body?.error?.code ?? "server_error";
    const fields = body?.error?.fields ?? {};
    const fieldErrors = Object.fromEntries(
      Object.keys(fields).map((field) => [field, fieldMessage(field)])
    );

    throw new IncidentsApiError(
      kindFromCode(code),
      GENERIC_MESSAGES[code] ?? DEFAULT_ERROR_MESSAGE,
      fieldErrors
    );
  }

  return response;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ─── Mensajes de transición (nunca el texto del backend) ─────────────────

/** Mensaje en español para una transición inválida, construido con los
 * diccionarios de esta UI (nunca con el texto que arma el backend). Misma
 * lógica que transition_error_message() en
 * nexova_shared/incident_validation.py, en datos (no en reglas): la fuente
 * de verdad de qué transición es válida sigue siendo solo el backend. */
export function transitionErrorMessage(from: IncidentStatus, to: IncidentStatus): string {
  if (from === to) {
    return `La incidencia ya está en estado «${INCIDENT_STATUS_LABELS[from]}».`;
  }
  if (isFinalStatus(from)) {
    return `La incidencia está en un estado final («${INCIDENT_STATUS_LABELS[from]}») y no admite más cambios.`;
  }
  return `No se puede pasar de «${INCIDENT_STATUS_LABELS[from]}» a «${INCIDENT_STATUS_LABELS[to]}».`;
}

// ─── Endpoints ──────────────────────────────────────────────────────────

/** Lista incidencias; los filtros vacíos no se envían. */
export async function listIncidents(filters: IncidentFilters): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.branch) params.set("branch", filters.branch);
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const response = await incidentsApiRequest(`/api/incidents${query}`, { method: "GET" });
  const dtos = (await response.json()) as IncidentDto[];
  return dtos.map(toIncident);
}

export async function getIncidentsSummary(): Promise<IncidentSummary> {
  const response = await incidentsApiRequest("/api/incidents/summary", { method: "GET" });
  return (await response.json()) as IncidentSummary;
}

export async function createIncident(incident: NewIncident): Promise<Incident> {
  const response = await incidentsApiRequest("/api/incidents", jsonInit("POST", incident));
  return toIncident((await response.json()) as IncidentDto);
}

/** PATCH /api/incidents/{id}/status. Si el backend rechaza la transición,
 * el mensaje que se lanza es el de transitionErrorMessage() (nunca el
 * texto del backend), calculado con el `fromStatus` que ya conoce quien
 * llama (la fila que se intentó cambiar). */
export async function updateIncidentStatus(
  id: number,
  fromStatus: IncidentStatus,
  toStatus: IncidentStatus
): Promise<Incident> {
  try {
    const response = await incidentsApiRequest(
      `/api/incidents/${id}/status`,
      jsonInit("PATCH", { status: toStatus })
    );
    return toIncident((await response.json()) as IncidentDto);
  } catch (err) {
    if (err instanceof IncidentsApiError && err.kind === "invalid_transition") {
      throw new IncidentsApiError("invalid_transition", transitionErrorMessage(fromStatus, toStatus));
    }
    throw err;
  }
}
