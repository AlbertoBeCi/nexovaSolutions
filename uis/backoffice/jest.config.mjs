import nextJest from "next/jest.js";

export default nextJest({ dir: "./" })({
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.tsx"],
});
