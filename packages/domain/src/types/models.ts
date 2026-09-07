/**
 * NEXOVA SOLUTIONS - types/models.ts
 * Modelo de dominio del pipeline de reclutamiento (candidatos, vacantes,
 * procesos de selección) usado por src/utils/ y los datos de ejemplo en
 * src/data/. No confundir con el modelo de la API del backoffice
 * (uis/backoffice/src/types/candidate.ts): ese describe el
 * registro tal como lo expone 4Geek Tracker; este describe el dominio de
 * negocio (skills, seniority, salario, encaje con vacantes).
 */

export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Native";
export type SeniorityLevel = "Junior" | "Semi-Senior" | "Senior" | "Lead" | "Executive";
export type AvailabilityStatus = "Immediate" | "2 weeks" | "1 month" | "Not available";
export type CandidateStatus = "Active" | "In process" | "Hired" | "Inactive";

/** Candidato del pipeline, con su perfil profesional completo para scoring y filtrado. */
export interface Candidate {
  id: string; // ej: "C-2024-0451"
  fullName: string;
  email: string;
  phone: string;
  yearsOfExperience: number;
  skills: string[]; // ej: ["TypeScript", "React", "Node.js"]
  englishLevel: EnglishLevel;
  seniority: SeniorityLevel;
  currentSalary: number; // USD
  expectedSalary: number; // USD
  availability: AvailabilityStatus;
  location: string; // ej: "Valencia, España"
  remoteOnly: boolean;
  status: CandidateStatus;
}

export type VacancyStatus = "Open" | "In progress" | "Closed" | "On hold";

/** Vacante abierta por una empresa cliente, con sus requisitos para calcular el encaje de candidatos. */
export interface Vacancy {
  id: string; // ej: "V-2024-0892"
  title: string; // ej: "Senior Full-Stack Developer"
  companyName: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minYearsExperience: number;
  maxYearsExperience: number;
  requiredEnglishLevel: EnglishLevel;
  requiredSeniority: SeniorityLevel;
  salaryRangeMin: number; // USD
  salaryRangeMax: number; // USD
  isRemote: boolean;
  location: string; // Ubicación de oficina si no es remota
  status: VacancyStatus;
}

export type ProcessStage =
  | "Screening"
  | "Interview"
  | "Technical test"
  | "Final interview"
  | "Offer"
  | "Rejected"
  | "Hired";

/** Proceso de selección: vincula un candidato con una vacante y su avance por etapas. */
export interface SelectionProcess {
  id: string; // ej: "SP-2024-1523"
  candidateId: string;
  vacancyId: string;
  stage: ProcessStage;
  score: number; // 0-100
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}
