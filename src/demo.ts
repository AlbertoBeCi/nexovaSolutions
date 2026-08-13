import { buildDemoSections } from "./demo-runner";

for (const section of buildDemoSections()) {
  console.log(`\n=== ${section.title} ===`);
  for (const result of section.results) {
    console.log(`${result.label}:`, result.value);
  }
}
