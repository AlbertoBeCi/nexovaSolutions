#!/usr/bin/env node
/**
 * revision-textos-ui — verificador automático (criterios 1 y 5).
 * Uso: node .agents/skills/revision-textos-ui/scripts/check-ui-texts.mjs [ruta...]
 * Sin args revisa "uis/". Exit 0 = PASS, exit 1 = FAIL.
 * Sin dependencias. Los criterios 2, 3, 4 y 6 son revisión manual (ver SKILL.md).
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const roots = process.argv.slice(2);
const targets = roots.length ? roots : ["uis"];

const RAW_TOKENS = [
  "received", "in_progress", "selected", "discarded",
  "pending", "review", "personal_interview", "technical_interview", "offer_presented",
];
// Literal como string entre comillas: "received" / 'in_progress' / `pending`
const rawLiteralRe = new RegExp(`["'\`](${RAW_TOKENS.join("|")})["'\`]`);
const LABELS_FILE = `types${sep}candidate.ts`;

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const files = [];
for (const t of targets) {
  if (!existsSync(t)) {
    console.error(`aviso: no existe ${t}`);
    continue;
  }
  statSync(t).isDirectory() ? walk(t, files) : files.push(t);
}

let fail = 0;

// ── Criterio 1: literales crudos de estado/etapa fuera de candidate.ts ──
const offenders = [];
for (const f of files) {
  if (f.endsWith(LABELS_FILE)) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (rawLiteralRe.test(line) && !/\b(statusLabels|stageLabels|CandidateStatus|CandidateStage|keyof|as const)\b/.test(line)) {
      offenders.push(`${relative(".", f)}:${i + 1}  ${line.trim()}`);
    }
  });
}
if (offenders.length) {
  fail++;
  console.log(`  [FAIL] 1. literales crudos de estado/etapa en JSX/código:`);
  offenders.forEach((o) => console.log(`         ${o}`));
} else {
  console.log(`  [PASS] 1. sin literales crudos de estado/etapa fuera de candidate.ts`);
}

// ── Criterio 5: JSON-LD Organization en uis/website ──
const scanningWebsite = targets.some((t) => t.replace(/\\/g, "/").includes("uis/website")) ||
  targets.some((t) => t === "uis" || t === "uis/");
if (scanningWebsite) {
  const websiteFiles = files.filter((f) => f.replace(/\\/g, "/").includes("uis/website"));
  const blob = websiteFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  const hasLd = blob.includes("application/ld+json");
  const hasOrg = /["']@type["']\s*:\s*["']Organization["']/.test(blob);
  if (hasLd && hasOrg) {
    console.log(`  [PASS] 5. uis/website incluye JSON-LD Organization`);
  } else {
    fail++;
    console.log(`  [FAIL] 5. uis/website: falta <script type="application/ld+json"> con "@type":"Organization"`);
  }
}

console.log(`Resultado: ${fail ? `FAIL (${fail} criterio${fail > 1 ? "s" : ""})` : "PASS"}`);
process.exit(fail ? 1 : 0);
