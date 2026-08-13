import { candidates, invalidCandidate, invalidVacancy, selectionProcesses, vacancies } from "./data/create-objects";
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

export interface DemoResult {
  label: string;
  value: unknown;
}

export interface DemoSection {
  title: string;
  results: DemoResult[];
}

// Calcula los resultados de todas las funciones de dominio, sin console.log ni DOM,
// para que tanto demo.ts (consola) como browser-demo.ts (interfaz web) los reutilicen.
export function buildDemoSections(): DemoSection[] {
  const candidatesSortedBySalary = sortCandidatesBySalary(candidates, "asc");
  const vacancyRanking = rankCandidatesForVacancy(candidates, vacancies[0]);

  return [
    {
      title: "collections.ts",
      results: [
        {
          label: "filterCandidatesBySkills [TypeScript, React]",
          value: filterCandidatesBySkills(candidates, ["TypeScript", "React"]),
        },
        { label: "filterCandidatesBySeniority [Senior]", value: filterCandidatesBySeniority(candidates, "Senior") },
        {
          label: "filterCandidatesByAvailability [Immediate, 2 weeks]",
          value: filterCandidatesByAvailability(candidates, ["Immediate", "2 weeks"]),
        },
        { label: "sortCandidatesBySalary [asc]", value: sortCandidatesBySalary(candidates, "asc") },
        { label: "sortCandidatesBySalary [desc]", value: sortCandidatesBySalary(candidates, "desc") },
        { label: "sortCandidatesByExperience [asc]", value: sortCandidatesByExperience(candidates, "asc") },
        { label: "sortCandidatesByExperience [desc]", value: sortCandidatesByExperience(candidates, "desc") },
      ],
    },
    {
      title: "search.ts",
      results: [
        { label: "findCandidateById [C-2024-0453]", value: findCandidateById(candidates, "C-2024-0453") },
        { label: "findCandidateById [inexistente]", value: findCandidateById(candidates, "C-2024-0000") },
        {
          label: "findCandidateByEmail [elena.ruiz@example.com]",
          value: findCandidateByEmail(candidates, "elena.ruiz@example.com"),
        },
        {
          label: "binarySearchCandidateBySalary [48000]",
          value: binarySearchCandidateBySalary(candidatesSortedBySalary, 48000),
        },
        {
          label: "binarySearchCandidateBySalary [999999, no existe]",
          value: binarySearchCandidateBySalary(candidatesSortedBySalary, 999999),
        },
      ],
    },
    {
      title: "transformations.ts",
      results: [
        {
          label: "calculateCandidateScore [Laura Gómez vs Senior Full-Stack Developer]",
          value: calculateCandidateScore(candidates[0], vacancies[0]),
        },
        {
          label: "rankCandidatesForVacancy [Senior Full-Stack Developer]",
          value: vacancyRanking,
        },
        {
          label: "Mejor candidato para [Senior Full-Stack Developer] (mayor score)",
          value: vacancyRanking[0],
        },
        { label: "groupCandidatesBySeniority", value: groupCandidatesBySeniority(candidates) },
        { label: "countCandidatesByStatus", value: countCandidatesByStatus(candidates) },
        { label: "calculateAverageSalary", value: calculateAverageSalary(candidates) },
        { label: "findTopSkills [top 3]", value: findTopSkills(candidates, 3) },
        { label: "calculateVacancyFillRate", value: calculateVacancyFillRate(selectionProcesses) },
      ],
    },
    {
      title: "validations.ts",
      results: [
        { label: "isValidEmail [laura.gomez@example.com]", value: isValidEmail("laura.gomez@example.com") },
        { label: "isValidEmail [correo-invalido]", value: isValidEmail("correo-invalido") },
        { label: "validateCandidate [válido, Laura Gómez]", value: validateCandidate(candidates[0]) },
        { label: "validateCandidate [inválido]", value: validateCandidate(invalidCandidate) },
        { label: "validateVacancy [válida, Senior Full-Stack Developer]", value: validateVacancy(vacancies[0]) },
        { label: "validateVacancy [inválida]", value: validateVacancy(invalidVacancy) },
      ],
    },
  ];
}
