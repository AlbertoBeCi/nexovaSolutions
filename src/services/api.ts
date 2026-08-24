import { Candidate, CandidateNote, CandidateStatus, CandidateStage } from "../types/candidate";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://playground.4geeks.com/tracker/api/v1";
const DEFAULT_LIST_LIMIT = 100;

export interface CandidateFilters {
  search?: string;
  status?: CandidateStatus;
  stage?: CandidateStage;
}

export type CandidateInput = Omit<
  Candidate,
  "id" | "status" | "stage" | "notesCount" | "createdAt" | "updatedAt"
>;

export interface CandidateStatusStageInput {
  status?: CandidateStatus;
  stage?: CandidateStage;
}

interface RecordDto {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  position: string;
  linkedin_url: string | null;
  cv_url: string | null;
  status: string;
  stage: string;
  experience_years: number;
  notes_count: number;
  applied_at: string;
  updated_at: string;
}

interface RecordListResponseDto {
  total: number;
  page: number;
  limit: number;
  data: RecordDto[];
}

interface NoteDto {
  id: string;
  record_id: string;
  content: string;
  created_at: string;
}

interface NoteListResponseDto {
  data: NoteDto[];
  meta: { total: number };
}

function toCandidate(dto: RecordDto): Candidate {
  return {
    id: dto.id,
    name: dto.full_name,
    email: dto.email,
    phone: dto.phone,
    position: dto.position,
    linkedinUrl: dto.linkedin_url,
    resumeUrl: dto.cv_url,
    yearsOfExperience: dto.experience_years,
    status: dto.status as CandidateStatus,
    stage: dto.stage as CandidateStage,
    notesCount: dto.notes_count,
    createdAt: new Date(dto.applied_at),
    updatedAt: new Date(dto.updated_at),
  };
}

function toCandidateNote(dto: NoteDto): CandidateNote {
  return {
    id: dto.id,
    candidateId: dto.record_id,
    text: dto.content,
    date: new Date(dto.created_at),
  };
}

function toRecordPayload(data: CandidateInput) {
  return {
    full_name: data.name,
    email: data.email,
    phone: data.phone,
    position: data.position,
    linkedin_url: data.linkedinUrl,
    cv_url: data.resumeUrl,
    experience_years: data.yearsOfExperience,
  };
}

async function extractErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const body = await response.json();

    if (Array.isArray(body?.detail)) {
      const messages = body.detail
        .map((issue: { msg?: unknown }) => issue.msg)
        .filter((msg: unknown): msg is string => typeof msg === "string");
      if (messages.length > 0) return messages.join(" ");
    }

    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
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
  params.set("limit", String(DEFAULT_LIST_LIMIT));

  const response = await fetch(`${API_BASE_URL}/records?${params.toString()}`);
  const result = await parseJsonResponse<RecordListResponseDto>(
    response,
    "No se pudo obtener la lista de candidatos"
  );

  return result.data.map(toCandidate);
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const response = await fetch(`${API_BASE_URL}/records/${id}`);

  if (response.status === 404) {
    return null;
  }

  const dto = await parseJsonResponse<RecordDto>(response, `No se pudo obtener el candidato ${id}`);
  return toCandidate(dto);
}

export async function createCandidate(data: CandidateInput): Promise<Candidate> {
  const response = await fetch(`${API_BASE_URL}/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toRecordPayload(data)),
  });

  const dto = await parseJsonResponse<RecordDto>(response, "No se pudo guardar el candidato");
  return toCandidate(dto);
}

export async function updateCandidate(id: string, data: CandidateInput): Promise<Candidate> {
  const response = await fetch(`${API_BASE_URL}/records/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toRecordPayload(data)),
  });

  const dto = await parseJsonResponse<RecordDto>(response, `No se pudo actualizar el candidato ${id}`);
  return toCandidate(dto);
}

export async function updateCandidateStatusStage(
  id: string,
  data: CandidateStatusStageInput
): Promise<Candidate> {
  const response = await fetch(`${API_BASE_URL}/records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const dto = await parseJsonResponse<RecordDto>(
    response,
    `No se pudo actualizar el estado o etapa del candidato ${id}`
  );
  return toCandidate(dto);
}

export async function getCandidateNotes(candidateId: string): Promise<CandidateNote[]> {
  const response = await fetch(`${API_BASE_URL}/records/${candidateId}/notes`);
  const result = await parseJsonResponse<NoteListResponseDto>(
    response,
    `No se pudieron obtener las notas del candidato ${candidateId}`
  );

  return result.data.map(toCandidateNote);
}

export async function addCandidateNote(candidateId: string, text: string): Promise<CandidateNote> {
  const response = await fetch(`${API_BASE_URL}/records/${candidateId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text }),
  });

  const dto = await parseJsonResponse<NoteDto>(
    response,
    `No se pudo agregar la nota al candidato ${candidateId}`
  );
  return toCandidateNote(dto);
}

export async function deleteCandidateNote(candidateId: string, noteId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/records/${candidateId}/notes/${noteId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, `No se pudo borrar la nota ${noteId}`));
  }
}
