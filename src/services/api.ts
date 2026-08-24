import { Candidate, CandidateStatus, CandidateStage } from "../types/candidate";

const API_BASE_URL = "http://localhost:3000/api";

export interface CandidateFilters {
  search?: string;
  status?: CandidateStatus;
  stage?: CandidateStage;
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

  if (!response.ok) {
    throw new Error(`Error al obtener candidatos: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<Candidate[]>;
}
