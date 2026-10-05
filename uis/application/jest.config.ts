import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest carga next.config y resuelve el alias "@/*" de tsconfig.json.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "<rootDir>/jest.environment.cjs",
  // Solo se mide la logica del cliente (lib/), no las paginas ni los tipos.
  collectCoverageFrom: ["lib/**/*.ts", "types/incident.ts", "!lib/__tests__/**"],
  testMatch: ["<rootDir>/lib/__tests__/**/*.test.ts"],
};

export default createJestConfig(config);
