export type CandidateStatus = "received" | "in_progress" | "selected" | "discarded";

export type CandidateStage =
  | "pending"
  | "review"
  | "personal_interview"
  | "technical_interview"
  | "offer_presented";

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
