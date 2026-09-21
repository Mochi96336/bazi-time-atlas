import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [view, css, host, recurrenceGate] = await Promise.all([
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-discrete-density.css", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/check-recurrence-lab.mjs", import.meta.url), "utf8")
]);

function functionSlice(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `missing function slice ${name} → ${nextName}`);
  return source.slice(start, end);
}

const closureView = functionSlice(view, "ensureClosureDrilldown", "hashTargetsCycle");
const milestoneView = functionSlice(view, "ensureMilestoneDrilldown", "syncMilestoneMeta");

test("discrete presentation removes duplicate top scope copy", () => {
  assert.match(view, /\.recurrence-intro > \.scope-note/);
  assert.match(view, /\.remove\(\)/);
});

test("global period meaning is attached to the preset instead of a duplicate static readout", () => {
  assert.match(view, /button\[data-delta-years="24000"\]/);
  assert.match(view, /preset\.textContent = "全域 24,000"/);
  assert.match(view, /preset\.setAttribute\("aria-label", "三層全域閉合 24,000 年"\)/);
  assert.match(view, /preset\.dataset\.researchGlobalPeriodPreset = "1"/);
  assert.match(view, /dock\?\.querySelector\("\.global-period"\)/);
  assert.match(view, /duplicate\?\.remove\(\)/);
  assert.match(view, /dock\.classList\.add\("research-delta-consolidated"\)/);
  assert.match(css, /@media \(min-width:821px\)[\s\S]*?\.delta-dock\.research-delta-consolidated\s*\{[\s\S]*?grid-template-columns:\s*minmax\(130px,180px\) minmax\(0,1fr\)/);
});

test("local recurrence remains visible while derived closure interpretation is disclosed", () => {
  assert.match(view, /details\.id = "discrete-closure-details"/);
  assert.match(view, /local\.classList\.add\("research-local-recurrence-rail"\)/);
  assert.match(view, /label\.textContent = "局部年＋日首次重遇"/);
  assert.match(view, /note\.hidden = true/);
  assert.match(view, /grid\.insertAdjacentElement\("beforebegin", local\)/);
  assert.match(view, /details\.append\(summary, grid\)/);
  assert.doesNotMatch(closureView, /details\.open\s*=\s*true/);
});

test("60-day cycle is supporting evidence behind a closed native drilldown", () => {
  assert.match(view, /details\.id = "discrete-sexagenary-details"/);
  assert.match(view, /details\.dataset\.researchDrilldown = "discrete-sexagenary"/);
  assert.match(view, /六十日干支循環/);
  assert.match(view, /60 日後配對重新重合/);
  assert.match(view, /details\.append\(summary, cycle\)/);
  assert.doesNotMatch(view, /discrete-sexagenary-details[\s\S]*?\.open\s*=\s*true/);
  assert.match(view, /hashTargetsCycle\(cycle\)/);
  assert.match(view, /details\.open = true/);
  assert.match(css, /\.research-sexagenary-drilldown > \.research-cycle\s*\{[\s\S]*?margin-top:\s*0;[\s\S]*?border-top:\s*0;/);
  assert.match(css, /\.research-sexagenary-drilldown > \.research-cycle \.research-cycle-head\s*\{\s*display:\s*none;/);
});

test("milestone table is progressively disclosed without deleting its rows", () => {
  assert.match(view, /document\.createElement\("details"\)/);
  assert.match(view, /details\.id = "discrete-milestone-details"/);
  assert.match(view, /details\.append\(summary, table\)/);
  assert.match(view, /#milestone-rows > \.milestone-row/);
  assert.doesNotMatch(milestoneView, /details\.open\s*=\s*true/);
});

test("discrete drilldowns stay flat rather than becoming cards", () => {
  assert.match(css, /\.research-local-recurrence-rail\s*\{[\s\S]*?border-top:[^;]+;/);
  assert.doesNotMatch(css, /\.research-local-recurrence-rail\s*\{[\s\S]*?border-radius\s*:/);
  assert.doesNotMatch(css, /\.research-local-recurrence-rail\s*\{[\s\S]*?box-shadow\s*:/);
  assert.match(css, /\.research-discrete-drilldown\s*\{[\s\S]*?border-top:[^;]+;[\s\S]*?border-bottom:[^;]+;/);
  assert.doesNotMatch(css, /\.research-discrete-drilldown\s*\{[\s\S]*?border-radius\s*:/);
  assert.doesNotMatch(css, /\.research-discrete-drilldown\s*\{[\s\S]*?box-shadow\s*:/);
  assert.match(css, /\.research-closure-drilldown > \.closure-grid\s*\{[\s\S]*?margin-top:\s*0/);
  assert.match(css, /\.research-discrete-drilldown > \.milestone-table\s*\{[\s\S]*?margin-top:\s*0/);
});

test("browser contract treats legend as visible phase evidence and closure status as disclosed interpretation", () => {
  assert.match(recurrenceGate, /function expectSignedEvidenceCopy/);
  assert.doesNotMatch(recurrenceGate, /expectVisibleSignedCopy/);
  assert.match(recurrenceGate, /discrete-closure-details/);
  assert.match(recurrenceGate, /research-local-recurrence-rail/);
});

test("browser contract verifies the global period preset owns the semantic label", () => {
  assert.match(recurrenceGate, /function expectConsolidatedGlobalPeriod/);
  assert.match(recurrenceGate, /data-delta-years="24000"/);
  assert.match(recurrenceGate, /全域 24,000/);
  assert.match(recurrenceGate, /三層全域閉合 24,000 年/);
  assert.match(recurrenceGate, /global-period/);
});

test("research integration loads the discrete presentation layer", () => {
  assert.match(host, /import "\.\/research-discrete-density-view\.js";/);
});
