import { Candidate } from "../types/models";

export function findCandidateById(candidates: Candidate[], id: string): Candidate | null {
  const foundCandidate = candidates.find((candidate) => candidate.id === id);
  return foundCandidate ?? null;
}

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
