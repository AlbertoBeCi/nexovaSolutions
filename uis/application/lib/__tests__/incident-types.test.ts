import {
  INCIDENT_BRANCHES,
  INCIDENT_BRANCH_LABELS,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_ORIGINS,
  INCIDENT_ORIGIN_LABELS,
  INCIDENT_STATUSES,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TRANSITIONS,
  isFinalStatus,
  isIncidentBranch,
  isIncidentCategory,
  isIncidentOrigin,
  isIncidentStatus,
  nextStatusOptions,
} from "@/types/incident";

describe("transiciones (espejo de incident_constants.py)", () => {
  it("coinciden exactamente con las del backend", () => {
    expect(INCIDENT_TRANSITIONS).toEqual({
      open: ["in_progress", "discarded"],
      in_progress: ["resolved", "discarded"],
      resolved: [],
      discarded: [],
    });
  });

  it.each([
    ["open", false], ["in_progress", false], ["resolved", true], ["discarded", true],
  ] as const)("isFinalStatus(%s) = %s", (status, expected) => {
    expect(isFinalStatus(status)).toBe(expected);
  });

  it("nextStatusOptions devuelve las salidas de cada estado", () => {
    expect(nextStatusOptions("open")).toEqual(["in_progress", "discarded"]);
    expect(nextStatusOptions("resolved")).toEqual([]);
  });

  it("ninguna transición apunta al mismo estado ni a un estado desconocido", () => {
    for (const status of INCIDENT_STATUSES) {
      for (const target of INCIDENT_TRANSITIONS[status]) {
        expect(target).not.toBe(status);
        expect(INCIDENT_STATUSES).toContain(target);
      }
    }
  });
});

describe("diccionarios de etiquetas", () => {
  it.each([
    ["categorías", INCIDENT_CATEGORIES, INCIDENT_CATEGORY_LABELS],
    ["estados", INCIDENT_STATUSES, INCIDENT_STATUS_LABELS],
    ["orígenes", INCIDENT_ORIGINS, INCIDENT_ORIGIN_LABELS],
    ["sedes", INCIDENT_BRANCHES, INCIDENT_BRANCH_LABELS],
  ] as const)("%s: cada código tiene una etiqueta en español distinta del código", (_n, codes, labels) => {
    expect(Object.keys(labels).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      const label = (labels as Record<string, string>)[code];
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(code);
      expect(label).not.toContain("_");
    }
  });
});

describe("type guards", () => {
  it.each([
    [isIncidentStatus, "open", "OPEN"],
    [isIncidentCategory, "sla_breach", "sla"],
    [isIncidentOrigin, "customer", "Customer"],
    [isIncidentBranch, "remote", "headquarters"],
  ])("%p acepta valores válidos y rechaza el resto", (guard, good, bad) => {
    expect(guard(good)).toBe(true);
    expect(guard(bad)).toBe(false);
    expect(guard(null)).toBe(false);
    expect(guard("")).toBe(false);
  });
});
