import { Candidate, CandidateNote, CandidateStatus, CandidateStage } from "../types/candidate";

const API_BASE_URL = "http://localhost:3000/api";

export interface CandidateFilters {
  search?: string;
  status?: CandidateStatus;
  stage?: CandidateStage;
}

export type CandidateInput = Omit<Candidate, "id" | "createdAt">;

export interface CandidateStatusStageInput {
  status?: CandidateStatus;
  stage?: CandidateStage;
}

async function extractErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.message === "string") {
      return body.message;
    }
  } catch {
    // el cuerpo de la respuesta no es JSON o esta vacio, se usa el mensaje por defecto
  }
  return fallbackMessage;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, fallbackMessage));
  }
  return response.json() as Promise<T>;
}

export async function getCandidates(filters: CandidateFilters = {}): Promise<Candidate[]> {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.stage) {
    params.set("stage", filters.stage);
  }

  const queryString = params.toString();
  const url = queryString ? `${API_BASE_URL}/candidates?${queryString}` : `${API_BASE_URL}/candidates`;

  const response = await fetch(url);
  return parseJsonResponse<Candidate[]>(response, "No se pudo obtener la lista de candidatos");
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const response = await fetch(`${API_BASE_URL}/candidates/${id}`);

  if (response.status === 404) {
    return null;
  }

  return parseJsonResponse<Candidate>(response, `No se pudo obtener el candidato ${id}`);
}

export async function createCandidate(data: CandidateInput): Promise<Candidate> {
  const response = await fetch(`${API_BASE_URL}/candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return parseJsonResponse<Candidate>(response, "No se pudo guardar el candidato");
}

export async function updateCandidate(id: string, data: CandidateInput): Promise<Candidate> {
  const response = await fetch(`${API_BASE_URL}/candidates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return parseJsonResponse<Candidate>(response, `No se pudo actualizar el candidato ${id}`);
}

export async function updateCandidateStatusStage(
  id: string,
  data: CandidateStatusStageInput
): Promise<Candidate> {
  const response = await fetch(`${API_BASE_URL}/candidates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return parseJsonResponse<Candidate>(response, `No se pudo actualizar el estado o etapa del candidato ${id}`);
}

export async function getCandidateNotes(candidateId: string): Promise<CandidateNote[]> {
  const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}/notes`);
  return parseJsonResponse<CandidateNote[]>(
    response,
    `No se pudieron obtener las notas del candidato ${candidateId}`
  );
}

export async function addCandidateNote(candidateId: string, text: string): Promise<CandidateNote> {
  const response = await fetch(`${API_BASE_URL}/candidates/${candidateId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  return parseJsonResponse<CandidateNote>(response, `No se pudo agregar la nota al candidato ${candidateId}`);
}

export async function deleteCandidateNote(noteId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/notes/${noteId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, `No se pudo borrar la nota ${noteId}`));
  }
}
