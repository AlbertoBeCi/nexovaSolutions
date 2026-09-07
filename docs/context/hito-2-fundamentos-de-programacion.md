# CONTEXTO — Nexova

## Hito 2: Fundamentos de Programación
**Empresa:** Nexova — Consultoría de Recursos Humanos y Adquisición de Talento  
**Tu Rol:** Ingeniero de IA Junior, Equipo de Nexova AI  
**Responsable del Proyecto:** Javier Almeida, Gerente de Operaciones

### Acerca de Nexova
Nexova es una firma de consultoría de recursos humanos y adquisición de talento con sede en Valencia, España, y operaciones de expansión en Miami, Florida. La empresa opera tres líneas de negocio: headhunting ejecutivo, outsourcing de equipos de soporte al cliente para empresas tecnológicas, y formación corporativa. Eres parte del equipo de Ingeniería de IA recientemente formado para modernizar las operaciones de Nexova.

### Tu Asignación
Javier Almeida, el Gerente de Operaciones, necesita que construyas la lógica central de procesamiento de datos para el sistema de gestión de candidatos de Nexova. Los 40 consultores de selección actualmente procesan todo manualmente — leyendo CVs, puntuando candidatos, haciendo matching con vacantes, y rastreando etapas del proceso. Este hito se enfoca en construir las funciones TypeScript que alimentarán el motor automatizado de scoring de candidatos y matching de vacantes.

Esto es programación pura — sin IA, sin prompting. Javier necesita ver que puedes escribir código sólido y bien tipado que maneje lógica de negocio real correctamente.

### Lo que Estás Construyendo
Implementarás un conjunto de utilidades TypeScript para:
- Modelar datos de candidatos y vacantes usando interfaces
- Filtrar y buscar candidatos por habilidades, experiencia y disponibilidad
- Puntuar candidatos contra requisitos de vacantes
- Rankear candidatos para una posición dada
- Generar reportes de selección con métricas agregadas
- Validar datos antes de procesarlos

---

### Entidades de Negocio

#### Candidato (Candidate)
Un candidato en el sistema de Nexova representa una persona en la base de datos de talento.

**Interfaz: Candidate**
```typescript
type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Native";
type SeniorityLevel = "Junior" | "Semi-Senior" | "Senior" | "Lead" | "Executive";
type AvailabilityStatus = "Immediate" | "2 weeks" | "1 month" | "Not available";
type CandidateStatus = "Active" | "In process" | "Hired" | "Inactive";

interface Candidate {
  id: string; // Identificador único (ej: "C-2024-0451")
  fullName: string; // Nombre completo
  email: string; // Email de contacto
  phone: string; // Teléfono de contacto
  yearsOfExperience: number; // Años totales de experiencia profesional
  skills: string[]; // Array de habilidades (ej: ["TypeScript", "React", "Node.js"])
  englishLevel: EnglishLevel; // Nivel de inglés
  seniority: SeniorityLevel; // Nivel profesional
  currentSalary: number; // Salario actual en USD
  expectedSalary: number; // Salario esperado en USD
  availability: AvailabilityStatus; // Disponibilidad actual
  location: string; // Ciudad y país (ej: "Valencia, España")
  remoteOnly: boolean; // Solo acepta posiciones remotas
  status: CandidateStatus; // Estado actual en la base de datos
}
```

**Reglas de Validación:**
- `yearsOfExperience` debe ser `>= 0` y `<= 50`
- `currentSalary` y `expectedSalary` deben ser `> 0`
- El array `skills` debe contener al menos 1 habilidad
- `email` debe ser un formato de email válido (verificación básica: contiene @ y .)
- `phone` no debe estar vacío

#### Vacante (Vacancy)
Una vacante representa una posición abierta que Nexova está intentando cubrir para un cliente.

**Interfaz: Vacancy**
```typescript
type VacancyStatus = "Open" | "In progress" | "Closed" | "On hold";

interface Vacancy {
  id: string; // Identificador único (ej: "V-2024-0892")
  title: string; // Título del puesto (ej: "Senior Full-Stack Developer")
  companyName: string; // Nombre de la empresa cliente
  requiredSkills: string[]; // Habilidades técnicas requeridas
  preferredSkills: string[]; // Habilidades deseables
  minYearsExperience: number; // Experiencia mínima requerida
  maxYearsExperience: number; // Experiencia máxima relevante
  requiredEnglishLevel: EnglishLevel; // Nivel mínimo de inglés
  requiredSeniority: SeniorityLevel; // Nivel de seniority requerido
  salaryRangeMin: number; // Salario mínimo ofrecido (USD)
  salaryRangeMax: number; // Salario máximo ofrecido (USD)
  isRemote: boolean; // Posición remota
  location: string; // Ubicación de oficina si no es remota
  status: VacancyStatus; // Estado actual de la vacante
}
```

**Reglas de Validación:**
- `requiredSkills` debe contener al menos 1 habilidad
- `minYearsExperience` debe ser `>= 0`
- `maxYearsExperience` debe ser `>= minYearsExperience`
- `salaryRangeMax` debe ser `>= salaryRangeMin`
- Ambos valores de salario deben ser `> 0`

#### Proceso de Selección (SelectionProcess)
Rastrea el progreso de un candidato a través de un proceso de selección de vacante.

**Interfaz: SelectionProcess**
```typescript
type ProcessStage =
  | "Screening"
  | "Interview"
  | "Technical test"
  | "Final interview"
  | "Offer"
  | "Rejected"
  | "Hired";

interface SelectionProcess {
  id: string; // Identificador único (ej: "SP-2024-1523")
  candidateId: string; // Referencia al candidato
  vacancyId: string; // Referencia a la vacante
  stage: ProcessStage; // Etapa actual
  score: number; // Puntaje de match (0-100)
  notes: string; // Notas del consultor
  createdAt: Date; // Fecha de inicio del proceso
  updatedAt: Date; // Fecha de última actualización
}
```

---

### Funciones Requeridas

#### 1. Operaciones de Colecciones (`src/utils/collections.ts`)
- `filterCandidatesBySkills(candidates: Candidate[], requiredSkills: string[]): Candidate[]`
  - Retorna candidatos que tienen TODAS las habilidades requeridas (case-insensitive).
- `filterCandidatesBySeniority(candidates: Candidate[], seniority: SeniorityLevel): Candidate[]`
  - Retorna candidatos con el nivel de seniority especificado.
- `filterCandidatesByAvailability(candidates: Candidate[], availability: AvailabilityStatus[]): Candidate[]`
  - Retorna candidatos cuya disponibilidad coincida con cualquiera de los estados proporcionados.
- `sortCandidatesBySalary(candidates: Candidate[], order: "asc" | "desc"): Candidate[]`
  - Retorna candidatos ordenados por salario esperado. Sin mutar el array original.
- `sortCandidatesByExperience(candidates: Candidate[], order: "asc" | "desc"): Candidate[]`
  - Retorna candidatos ordenados por años de experiencia. Sin mutar el array original.

#### 2. Operaciones de Búsqueda (`src/utils/search.ts`)
- `findCandidateById(candidates: Candidate[], id: string): Candidate | null`
  - Búsqueda lineal por ID.
- `findCandidateByEmail(candidates: Candidate[], email: string): Candidate | null`
  - Búsqueda lineal por email (case-insensitive).
- `binarySearchCandidateBySalary(sortedCandidates: Candidate[], targetSalary: number): number`
  - Búsqueda binaria por salario esperado (asume orden ascendente). Retorna el índice o -1.

#### 3. Scoring y Matching (`src/utils/transformations.ts`)
- `calculateCandidateScore(candidate: Candidate, vacancy: Vacancy): number`
  - Calcula puntaje (0-100):
    - **Habilidades (40 pts):** +40 todas requeridas, +20 si >= 50% requeridas, +10 por cada preferida (máx +20).
    - **Experiencia (20 pts):** +20 en rango, +10 si 1-2 años fuera, 0 si > 2 años.
    - **Seniority (15 pts):** +15 match exacto, +7 si +/- 1 nivel.
    - **Inglés (15 pts):** +15 si cumple o excede.
    - **Salario (10 pts):** +10 en rango, +5 si hasta 20% encima del máx.
- `rankCandidatesForVacancy(candidates: Candidate[], vacancy: Vacancy): Array<{candidate: Candidate, score: number}>`
  - Retorna candidatos ordenados por puntaje (más alto primero).
- `groupCandidatesBySeniority(candidates: Candidate[]): Record<SeniorityLevel, Candidate[]>`
  - Agrupa candidatos por nivel de seniority.

#### 4. Agregaciones y Reportes (`src/utils/transformations.ts`)
- `countCandidatesByStatus(candidates: Candidate[]): Record<CandidateStatus, number>`
- `calculateAverageSalary(candidates: Candidate[]): number` (redondear a 2 decimales)
- `findTopSkills(candidates: Candidate[], topN: number): Array<{skill: string, count: number}>`
- `calculateVacancyFillRate(processes: SelectionProcess[]): number` (porcentaje "Hired", 2 decimales)

#### 5. Validaciones (`src/utils/validations.ts`)
- `validateCandidate(candidate: Candidate): { valid: boolean, errors: string[] }`
- `validateVacancy(vacancy: Vacancy): { valid: boolean, errors: string[] }`
- `isValidEmail(email: string): boolean` (básico: `@` y `.`)

---

### Datos de Ejemplo

**Candidatos:**
```typescript
const sampleCandidates: Candidate[] = [
  {
    id: "C-2024-0451",
    fullName: "María González",
    email: "maria.gonzalez@email.com",
    phone: "+56912345678",
    yearsOfExperience: 5,
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    englishLevel: "B2",
    seniority: "Semi-Senior",
    currentSalary: 3500,
    expectedSalary: 4200,
    availability: "1 month",
    location: "Valencia, España",
    remoteOnly: false,
    status: "Active",
  },
  // ... otros candidatos
];
```

**Vacante:**
```typescript
const sampleVacancy: Vacancy = {
  id: "V-2024-0892",
  title: "Senior Full-Stack Developer",
  companyName: "TechCorp Solutions",
  requiredSkills: ["TypeScript", "React", "Node.js"],
  preferredSkills: ["PostgreSQL", "Docker"],
  minYearsExperience: 4,
  maxYearsExperience: 8,
  requiredEnglishLevel: "B2",
  requiredSeniority: "Senior",
  salaryRangeMin: 5000,
  salaryRangeMax: 7000,
  isRemote: true,
  location: "Remote",
  status: "Open",
};
```

---

### Criterios de Aceptación
1. **Type Safety:** Interfaces y tipos correctos.
2. **Corrección:** Output esperado para cada input.
3. **Casos Límite:** Manejo de vacíos, nulos e inválidos.
4. **Sin Mutaciones:** No modificar arrays originales.
5. **Funciones Puras:** Sin variables globales.

> "Dame código limpio en el que pueda confiar, y construiremos el resto encima." — Javier Almeida, Gerente de Operaciones

