import { Candidate, Vacancy } from "../types/models";

export function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

export function validateCandidate(candidate: Candidate): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (candidate.yearsOfExperience < 0 || candidate.yearsOfExperience > 50) {
    errors.push("yearsOfExperience debe estar entre 0 y 50");
  }

  if (candidate.currentSalary <= 0) {
    errors.push("currentSalary debe ser mayor que 0");
  }

  if (candidate.expectedSalary <= 0) {
    errors.push("expectedSalary debe ser mayor que 0");
  }

  if (candidate.skills.length === 0) {
    errors.push("skills debe contener al menos 1 habilidad");
  }

  if (!isValidEmail(candidate.email)) {
    errors.push("email no tiene un formato válido");
  }

  if (candidate.phone.trim().length === 0) {
    errors.push("phone no debe estar vacío");
  }

  return { valid: errors.length === 0, errors };
}

export function validateVacancy(vacancy: Vacancy): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (vacancy.requiredSkills.length === 0) {
    errors.push("requiredSkills debe contener al menos 1 habilidad");
  }

  if (vacancy.minYearsExperience < 0) {
    errors.push("minYearsExperience debe ser mayor o igual a 0");
  }

  if (vacancy.maxYearsExperience < vacancy.minYearsExperience) {
    errors.push("maxYearsExperience debe ser mayor o igual a minYearsExperience");
  }

  if (vacancy.salaryRangeMin <= 0 || vacancy.salaryRangeMax <= 0) {
    errors.push("salaryRangeMin y salaryRangeMax deben ser mayores que 0");
  }

  if (vacancy.salaryRangeMax < vacancy.salaryRangeMin) {
    errors.push("salaryRangeMax debe ser mayor o igual a salaryRangeMin");
  }

  return { valid: errors.length === 0, errors };
}
