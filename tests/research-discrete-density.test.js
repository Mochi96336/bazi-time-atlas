import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [view, css, host, recurrenceGate] = await Promise.all([
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-discrete-density.css", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/check-recurrence-lab.mjs", import.meta.url), "utf8")
]);

test("discrete presentation removes duplicate top scope copy", () => {
  assert.match(view, /\.recurrence-intro > \.scope-note/);
  assert.match(view, /\.remove\(\)/);
});

test("local recurrence remains visible while derived closure interpretation is disclosed", () => {
  assert.match(view, /details\.id = "discrete-closure-details"/);
  assert.match(view, /local\.classList\.add\("research-local-recurrence-rail"\)/);
  assert.match(view, /label\.textContent = "局部年＋日首次重遇"/);
  assert.match(view, /note\.hidden = true/);
  assert.match(view, /grid\.insertAdjacentElement\("beforebegin", local\)/);
  assert.match(view, /details\.append\(summary, grid\)/);
  assert.doesNotMatch(view, /details\.open\s*=\s*true/);
});

test("milestone table is progressively disclosed without deleting its rows", () => {
  assert.match(view, /document\.createElement\("details"\)/);
  assert.match(view, /details\.id = "discrete-milestone-details"/);
  assert.match(view, /details\.append\(summary, table\)/);
  assert.match(view, /#milestone-rows > \.milestone-row/);
  assert.doesNotMatch(view, /details\.open\s*=\s*true/);
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

test("research integration loads the discrete presentation layer", () => {
  assert.match(host, /import "\.\/research-discrete-density-view\.js";/);
});
