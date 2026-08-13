import { buildDemoSections, DemoResult, DemoSection } from "./demo-runner";

const PLACEHOLDER_CLASS = "console-placeholder";

function formatValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function showConsolePlaceholder(consoleEl: HTMLElement, text: string): void {
  const placeholder = document.createElement("p");
  placeholder.className = PLACEHOLDER_CLASS;
  placeholder.textContent = text;
  consoleEl.replaceChildren(placeholder);
}

function logToConsole(consoleEl: HTMLElement, label: string, value: unknown): void {
  if (consoleEl.querySelector(`.${PLACEHOLDER_CLASS}`)) {
    consoleEl.replaceChildren();
  }

  const entry = document.createElement("div");
  entry.className = "console-entry";

  const labelEl = document.createElement("p");
  labelEl.className = "console-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("pre");
  valueEl.className = "console-value";
  valueEl.textContent = formatValue(value);

  entry.append(labelEl, valueEl);
  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function createActionButton(result: DemoResult, consoleEl: HTMLElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-button";
  button.textContent = result.label;
  button.addEventListener("click", () => logToConsole(consoleEl, result.label, result.value));
  return button;
}

function createSectionGroup(section: DemoSection, consoleEl: HTMLElement): HTMLElement {
  const group = document.createElement("section");
  group.className = "button-group";

  const heading = document.createElement("h2");
  heading.textContent = section.title;
  group.appendChild(heading);

  const row = document.createElement("div");
  row.className = "button-row";
  section.results.forEach((result) => row.appendChild(createActionButton(result, consoleEl)));
  group.appendChild(row);

  return group;
}

function renderApp(): void {
  const actionsEl = document.getElementById("actions");
  const consoleEl = document.getElementById("console-output");
  const clearButton = document.getElementById("clear-console");

  if (!actionsEl || !consoleEl || !clearButton) {
    return;
  }

  actionsEl.replaceChildren();
  buildDemoSections().forEach((section) => actionsEl.appendChild(createSectionGroup(section, consoleEl)));

  showConsolePlaceholder(consoleEl, "Haz clic en un botón para ver el resultado aquí.");

  clearButton.addEventListener("click", () => {
    showConsolePlaceholder(consoleEl, "Consola limpia. Haz clic en un botón para ver el resultado aquí.");
  });
}

renderApp();
