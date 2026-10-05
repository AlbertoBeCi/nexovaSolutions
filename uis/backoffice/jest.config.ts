import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest carga next.config y resuelve el alias "@/*" de tsconfig.json.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "<rootDir>/jest.environment.cjs",
  // Solo se mide la logica de los clientes (src/lib y src/services), no las paginas.
  collectCoverageFrom: ["src/lib/**/*.ts", "src/services/**/*.ts", "!**/__tests__/**"],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
};

export default createJestConfig(config);
