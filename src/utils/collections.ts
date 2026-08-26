/**
 * NEXOVA SOLUTIONS - utils/collections.ts
 * Filtros y ordenaciones sobre listas de candidatos.
 * Todas las funciones son puras: devuelven un array nuevo, nunca mutan el recibido.
 */

import { AvailabilityStatus, Candidate, SeniorityLevel } from "../types/models";

// ─── Filtros ─────────────────────────────────────────────────────────

/** Devuelve los candidatos que poseen TODAS las skills pedidas.
 *  La comparación es case-insensitive; una lista vacía devuelve una copia completa. */
export function filterCandidatesBySkills(candidates: Candidate[], requiredSkills: string[]): Candidate[] {
  if (requiredSkills.length === 0) {
    return [...candidates];
  }

  const normalizedRequiredSkills = requiredSkills.map((skill) => skill.toLowerCase());

  return candidates.filter((candidate) => {
    const normalizedCandidateSkills = candidate.skills.map((skill) => skill.toLowerCase());
    return normalizedRequiredSkills.every((requiredSkill) => normalizedCandidateSkills.includes(requiredSkill));
  });
}

/** Devuelve los candidatos con exactamente el nivel de seniority indicado. */
export function filterCandidatesBySeniority(candidates: Candidate[], seniority: SeniorityLevel): Candidate[] {
  return candidates.filter((candidate) => candidate.seniority === seniority);
}

/** Devuelve los candidatos cuya disponibilidad está en la lista aceptada.
 *  Lista vacía => copia completa (equivale a "cualquier disponibilidad"). */
export function filterCandidatesByAvailability(
  candidates: Candidate[],
  availability: AvailabilityStatus[],
): Candidate[] {
  if (availability.length === 0) {
    return [...candidates];
  }

  return candidates.filter((candidate) => availability.includes(candidate.availability));
}

// ─── Ordenaciones ────────────────────────────────────────────────────

/** Ordena por salario esperado sin mutar el original. */
export function sortCandidatesBySalary(candidates: Candidate[], order: "asc" | "desc"): Candidate[] {
  const direction = order === "asc" ? 1 : -1;

  return [...candidates].sort((a, b) => (a.expectedSalary - b.expectedSalary) * direction);
}

/** Ordena por años de experiencia sin mutar el original. */
export function sortCandidatesByExperience(candidates: Candidate[], order: "asc" | "desc"): Candidate[] {
  const direction = order === "asc" ? 1 : -1;

  return [...candidates].sort((a, b) => (a.yearsOfExperience - b.yearsOfExperience) * direction);
}

export type SortableCandidateField = "expectedSalary" | "currentSalary" | "yearsOfExperience";

export interface CandidateSortCriterion {
  field: SortableCandidateField;
  order: "asc" | "desc";
}

// Aplica los criterios en orden: el primero decide, los siguientes desempatan.
export function sortCandidatesByFields(candidates: Candidate[], criteria: CandidateSortCriterion[]): Candidate[] {
  return [...candidates].sort((a, b) => {
    for (const { field, order } of criteria) {
      const direction = order === "asc" ? 1 : -1;
      const difference = (a[field] - b[field]) * direction;

      if (difference !== 0) {
        return difference;
      }
    }

    return 0;
  });
}
