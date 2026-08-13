import { candidates, selectionProcesses, vacancies } from "./data/create-objects";
import {
  filterCandidatesByAvailability,
  filterCandidatesBySeniority,
  filterCandidatesBySkills,
  sortCandidatesByExperience,
  sortCandidatesBySalary,
} from "./utils/collections";
import { binarySearchCandidateBySalary, findCandidateByEmail, findCandidateById } from "./utils/search";
import {
  calculateAverageSalary,
  calculateCandidateScore,
  calculateVacancyFillRate,
  countCandidatesByStatus,
  findTopSkills,
  groupCandidatesBySeniority,
  rankCandidatesForVacancy,
} from "./utils/transformations";
import { isValidEmail, validateCandidate, validateVacancy } from "./utils/validations";
import { Candidate, Vacancy } from "./types/models";

const invalidCandidate: Candidate = {
  ...candidates[1],
  id: "C-2024-9999",
  email: "correo-sin-arroba.com",
  phone: "",
  skills: [],
  expectedSalary: 0,
};

const invalidVacancy: Vacancy = {
  ...vacancies[1],
  id: "V-2024-9999",
  requiredSkills: [],
  maxYearsExperience: -1,
  salaryRangeMax: 10000,
  salaryRangeMin: 20000,
};

console.log("=== collections.ts ===");
console.log("filterCandidatesBySkills [TypeScript, React]:", filterCandidatesBySkills(candidates, ["TypeScript", "React"]));
console.log("filterCandidatesBySeniority [Senior]:", filterCandidatesBySeniority(candidates, "Senior"));
console.log(
  "filterCandidatesByAvailability [Immediate, 2 weeks]:",
  filterCandidatesByAvailability(candidates, ["Immediate", "2 weeks"]),
);
console.log("sortCandidatesBySalary [asc]:", sortCandidatesBySalary(candidates, "asc"));
console.log("sortCandidatesBySalary [desc]:", sortCandidatesBySalary(candidates, "desc"));
console.log("sortCandidatesByExperience [asc]:", sortCandidatesByExperience(candidates, "asc"));
console.log("sortCandidatesByExperience [desc]:", sortCandidatesByExperience(candidates, "desc"));

console.log("\n=== search.ts ===");
console.log("findCandidateById [C-2024-0453]:", findCandidateById(candidates, "C-2024-0453"));
console.log("findCandidateById [inexistente]:", findCandidateById(candidates, "C-2024-0000"));
console.log("findCandidateByEmail [elena.ruiz@example.com]:", findCandidateByEmail(candidates, "elena.ruiz@example.com"));

const candidatesSortedBySalary = sortCandidatesBySalary(candidates, "asc");
console.log(
  "binarySearchCandidateBySalary [48000]:",
  binarySearchCandidateBySalary(candidatesSortedBySalary, 48000),
);
console.log(
  "binarySearchCandidateBySalary [999999, no existe]:",
  binarySearchCandidateBySalary(candidatesSortedBySalary, 999999),
);

console.log("\n=== transformations.ts ===");
console.log(
  "calculateCandidateScore [Laura Gómez vs Senior Full-Stack Developer]:",
  calculateCandidateScore(candidates[0], vacancies[0]),
);
console.log("rankCandidatesForVacancy [Senior Full-Stack Developer]:", rankCandidatesForVacancy(candidates, vacancies[0]));
console.log("groupCandidatesBySeniority:", groupCandidatesBySeniority(candidates));
console.log("countCandidatesByStatus:", countCandidatesByStatus(candidates));
console.log("calculateAverageSalary:", calculateAverageSalary(candidates));
console.log("findTopSkills [top 3]:", findTopSkills(candidates, 3));
console.log("calculateVacancyFillRate:", calculateVacancyFillRate(selectionProcesses));

console.log("\n=== validations.ts ===");
console.log("isValidEmail [laura.gomez@example.com]:", isValidEmail("laura.gomez@example.com"));
console.log("isValidEmail [correo-invalido]:", isValidEmail("correo-invalido"));
console.log("validateCandidate [válido, Laura Gómez]:", validateCandidate(candidates[0]));
console.log("validateCandidate [inválido]:", validateCandidate(invalidCandidate));
console.log("validateVacancy [válida, Senior Full-Stack Developer]:", validateVacancy(vacancies[0]));
console.log("validateVacancy [inválida]:", validateVacancy(invalidVacancy));
