import { Candidate, CandidateStatus, EnglishLevel, SelectionProcess, SeniorityLevel, Vacancy } from "../types/models";

const SENIORITY_ORDER: SeniorityLevel[] = ["Junior", "Semi-Senior", "Senior", "Lead", "Executive"];
const ENGLISH_LEVEL_ORDER: EnglishLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];

function normalizeSkills(skills: string[]): string[] {
  return skills.map((skill) => skill.toLowerCase());
}

// Requeridas: +40 si están todas, +20 si >= 50%. Preferidas: +10 c/u, tope +20.
function calculateSkillsScore(candidate: Candidate, vacancy: Vacancy): number {
  const candidateSkills = normalizeSkills(candidate.skills);

  const matchedRequiredCount = vacancy.requiredSkills.filter((skill) =>
    candidateSkills.includes(skill.toLowerCase()),
  ).length;

  const requiredMatchRatio =
    vacancy.requiredSkills.length === 0 ? 1 : matchedRequiredCount / vacancy.requiredSkills.length;

  const requiredScore = requiredMatchRatio === 1 ? 40 : requiredMatchRatio >= 0.5 ? 20 : 0;

  const matchedPreferredCount = vacancy.preferredSkills.filter((skill) =>
    candidateSkills.includes(skill.toLowerCase()),
  ).length;

  const preferredScore = Math.min(matchedPreferredCount * 10, 20);

  return requiredScore + preferredScore;
}

// +20 dentro del rango, +10 si se aleja 1-2 años, 0 si se aleja más.
function calculateExperienceScore(candidate: Candidate, vacancy: Vacancy): number {
  const { yearsOfExperience } = candidate;
  const { minYearsExperience, maxYearsExperience } = vacancy;

  if (yearsOfExperience >= minYearsExperience && yearsOfExperience <= maxYearsExperience) {
    return 20;
  }

  const yearsOutsideRange =
    yearsOfExperience < minYearsExperience
      ? minYearsExperience - yearsOfExperience
      : yearsOfExperience - maxYearsExperience;

  return yearsOutsideRange <= 2 ? 10 : 0;
}

// +15 match exacto de nivel, +7 si difiere en un nivel.
function calculateSeniorityScore(candidate: Candidate, vacancy: Vacancy): number {
  const candidateLevel = SENIORITY_ORDER.indexOf(candidate.seniority);
  const requiredLevel = SENIORITY_ORDER.indexOf(vacancy.requiredSeniority);
  const levelDifference = Math.abs(candidateLevel - requiredLevel);

  if (levelDifference === 0) {
    return 15;
  }

  return levelDifference === 1 ? 7 : 0;
}

function calculateEnglishScore(candidate: Candidate, vacancy: Vacancy): number {
  const candidateLevel = ENGLISH_LEVEL_ORDER.indexOf(candidate.englishLevel);
  const requiredLevel = ENGLISH_LEVEL_ORDER.indexOf(vacancy.requiredEnglishLevel);

  return candidateLevel >= requiredLevel ? 15 : 0;
}

// +10 dentro del rango, +5 si excede el máximo hasta un 20%.
function calculateSalaryScore(candidate: Candidate, vacancy: Vacancy): number {
  const { expectedSalary } = candidate;
  const { salaryRangeMin, salaryRangeMax } = vacancy;

  if (expectedSalary >= salaryRangeMin && expectedSalary <= salaryRangeMax) {
    return 10;
  }

  const maxAcceptableSalary = salaryRangeMax * 1.2;

  return expectedSalary > salaryRangeMax && expectedSalary <= maxAcceptableSalary ? 5 : 0;
}

export function calculateCandidateScore(candidate: Candidate, vacancy: Vacancy): number {
  const rawScore =
    calculateSkillsScore(candidate, vacancy) +
    calculateExperienceScore(candidate, vacancy) +
    calculateSeniorityScore(candidate, vacancy) +
    calculateEnglishScore(candidate, vacancy) +
    calculateSalaryScore(candidate, vacancy);

  return Math.min(rawScore, 100);
}

export function rankCandidatesForVacancy(
  candidates: Candidate[],
  vacancy: Vacancy,
): Array<{ candidate: Candidate; score: number }> {
  return candidates
    .map((candidate) => ({ candidate, score: calculateCandidateScore(candidate, vacancy) }))
    .sort((a, b) => b.score - a.score);
}

export function groupCandidatesBySeniority(candidates: Candidate[]): Record<SeniorityLevel, Candidate[]> {
  const initialGroups: Record<SeniorityLevel, Candidate[]> = {
    Junior: [],
    "Semi-Senior": [],
    Senior: [],
    Lead: [],
    Executive: [],
  };

  return candidates.reduce((groups, candidate) => {
    groups[candidate.seniority].push(candidate);
    return groups;
  }, initialGroups);
}

export function countCandidatesByStatus(candidates: Candidate[]): Record<CandidateStatus, number> {
  const initialCounts: Record<CandidateStatus, number> = {
    Active: 0,
    "In process": 0,
    Hired: 0,
    Inactive: 0,
  };

  return candidates.reduce((counts, candidate) => {
    counts[candidate.status] += 1;
    return counts;
  }, initialCounts);
}

export function calculateAverageSalary(candidates: Candidate[]): number {
  if (candidates.length === 0) {
    return 0;
  }

  const totalSalary = candidates.reduce((sum, candidate) => sum + candidate.expectedSalary, 0);

  return Math.round((totalSalary / candidates.length) * 100) / 100;
}

export function findTopSkills(candidates: Candidate[], topN: number): Array<{ skill: string; count: number }> {
  const skillCounts = new Map<string, number>();

  candidates.forEach((candidate) => {
    candidate.skills.forEach((skill) => {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    });
  });

  return Array.from(skillCounts, ([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(topN, 0));
}

export function calculateVacancyFillRate(processes: SelectionProcess[]): number {
  if (processes.length === 0) {
    return 0;
  }

  const hiredCount = processes.filter((process) => process.stage === "Hired").length;
  const fillRate = (hiredCount / processes.length) * 100;

  return Math.round(fillRate * 100) / 100;
}
