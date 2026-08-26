/**
 * NEXOVA SOLUTIONS - utils/search.ts
 * Búsquedas puntuales de candidatos: por id, por email y por salario
 * (esta última requiere la lista pre-ordenada, ver binarySearchCandidateBySalary).
 */

import { Candidate } from "../types/models";

/** Busca un candidato por id exacto. */
export function findCandidateById(candidates: Candidate[], id: string): Candidate | null {
  const foundCandidate = candidates.find((candidate) => candidate.id === id);
  return foundCandidate ?? null;
}

/** Busca un candidato por email, comparando en minúsculas. */
export function findCandidateByEmail(candidates: Candidate[], email: string): Candidate | null {
  const normalizedEmail = email.toLowerCase();
  const foundCandidate = candidates.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
  return foundCandidate ?? null;
}

// Asume sortedCandidates ya ordenado ascendente por expectedSalary.
export function binarySearchCandidateBySalary(sortedCandidates: Candidate[], targetSalary: number): number {
  let low = 0;
  let high = sortedCandidates.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midSalary = sortedCandidates[mid].expectedSalary;

    if (midSalary === targetSalary) {
      return mid;
    }

    if (midSalary < targetSalary) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return -1;
}
