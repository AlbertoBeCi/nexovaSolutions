export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Native";
export type SeniorityLevel = "Junior" | "Semi-Senior" | "Senior" | "Lead" | "Executive";
export type AvailabilityStatus = "Immediate" | "2 weeks" | "1 month" | "Not available";
export type CandidateStatus = "Active" | "In process" | "Hired" | "Inactive";

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
