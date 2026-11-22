// Repair C5: CSS debt may only go down. Each stylesheet's !important count,
// distinct hex colors and sub-12 px HTML font sizes must stay at or below the
// committed baseline; new stylesheets start at zero !important and zero small
// fonts. Refresh the baseline after a cleanup with:
//   node scripts/css-debt-metrics.mjs --write
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cssDebtMetrics } from "../scripts/css-debt-metrics.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseline = JSON.parse(readFileSync(new URL("./fixtures/css-debt-baseline.json", import.meta.url), "utf8"));
const current = cssDebtMetrics(root);

test("no stylesheet adds !important, hex colors or sub-12px fonts beyond the baseline", () => {
  const regressions = [];
  for (const [file, metrics] of Object.entries(current)) {
    const allowed = baseline[file] ?? { important:0, hexColors:Infinity, smallFonts:0 };
    for (const key of ["important", "hexColors", "smallFonts"]) {
      if (metrics[key] > allowed[key]) regressions.push(`${file} ${key} ${allowed[key]} → ${metrics[key]}`);
    }
  }
  assert.deepEqual(regressions, [], "CSS debt grew; fix it or (after a deliberate cleanup) refresh the baseline");
});

test("Research stylesheets keep zero HTML font sizes below 12 px", () => {
  const offenders = Object.entries(current)
    .filter(([file]) => /^(research-|recurrence\.css|astronomical-residuals|four-pillar-determinacy|near-recurrence)/.test(file))
    .filter(([, metrics]) => metrics.smallFonts > 0)
    .map(([file, metrics]) => `${file}:${metrics.smallFonts}`);
  assert.deepEqual(offenders, []);
});

test("tokens.css declares the cascade layer order before any token", () => {
  const tokens = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  assert.match(tokens, /@layer tokens, base, components, page, overrides;[\s\S]*@layer tokens \{/);
});
