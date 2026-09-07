/**
 * NEXOVA SOLUTIONS - browser-demo.ts
 * Capa de presentación DOM para src/demo.html: convierte las secciones de
 * demo-runner.ts en botones y muestra el resultado de cada llamada en una
 * consola visual. Sin lógica de dominio propia.
 */

import { buildDemoSections, DemoResult, DemoSection } from "./demo-runner";

const PLACEHOLDER_CLASS = "console-placeholder";

// ─── Formato ─────────────────────────────────────────────────────────

/** Formatea un valor de resultado para mostrarlo como texto: primitivos tal
 *  cual, el resto (arrays, objetos, null) como JSON indentado. */
function formatValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

// ─── Render ──────────────────────────────────────────────────────────

/** Sustituye el contenido de la consola por un único mensaje de placeholder. */
function showConsolePlaceholder(consoleEl: HTMLElement, text: string): void {
  const placeholder = document.createElement("p");
  placeholder.className = PLACEHOLDER_CLASS;
  placeholder.textContent = text;
  consoleEl.replaceChildren(placeholder);
}

/** Añade una entrada de resultado a la consola, reemplazando el placeholder si es la primera. */
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

/** Punto de entrada: construye la UI a partir de las secciones de demo y cablea los listeners. */
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
