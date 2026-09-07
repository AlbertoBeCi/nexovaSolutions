/**
 * NEXOVA SOLUTIONS - types/candidate.ts
 * Modelo del candidato tal como lo consume la UI del backoffice
 * (nombres en camelCase). No confundir con el modelo de dominio de
 * packages/domain (@repo/domain): ese describe el pipeline interno de reclutamiento
 * (seniority, skills, salario...), este describe el registro de la API
 * pública de 4Geek Tracker. services/api.ts hace la conversión entre ambos.
 */

export type CandidateStatus = "received" | "in_progress" | "selected" | "discarded";

export type CandidateStage =
  | "pending"
  | "review"
  | "personal_interview"
  | "technical_interview"
  | "offer_presented";

/** Registro del candidato normalizado a camelCase. */
export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  linkedinUrl: string | null;
  resumeUrl: string | null;
  yearsOfExperience: number;
  status: CandidateStatus;
  stage: CandidateStage;
  notesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Nota interna de seguimiento asociada a un candidato. */
export interface CandidateNote {
  id: string;
  candidateId: string;
  text: string;
  date: Date;
}

export const statusLabels: Record<CandidateStatus, string> = {
  received: "Recibida",
  in_progress: "En proceso",
  selected: "Seleccionada",
  discarded: "Descartada",
};

export const stageLabels: Record<CandidateStage, string> = {
  pending: "Pendiente de revisión",
  review: "En revisión",
  personal_interview: "Entrevista personal",
  technical_interview: "Entrevista técnica",
  offer_presented: "Oferta presentada",
};
