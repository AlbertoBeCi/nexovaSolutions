import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest carga next.config y resuelve el alias "@/*" de tsconfig.json.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "<rootDir>/jest.environment.cjs",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Solo se mide la logica de los clientes (src/lib y src/services), no las paginas.
  collectCoverageFrom: ["src/lib/**/*.ts", "src/services/**/*.ts", "!**/__tests__/**"],
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
};

export default createJestConfig(config);
