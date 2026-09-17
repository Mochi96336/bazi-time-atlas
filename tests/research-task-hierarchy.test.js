import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, taskCss, cycleCss, cycleJs] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../research-tasks.css", import.meta.url), "utf8"),
  readFile(new URL("../research-sexagenary-cycle.css", import.meta.url), "utf8"),
  readFile(new URL("../src/research-sexagenary-cycle.js", import.meta.url), "utf8")
]);

const discreteStart = html.indexOf('id="research-discrete"');
const astronomyStart = html.indexOf('id="research-astronomy"');
const evidenceStart = html.indexOf('id="research-evidence"');
const discrete = html.slice(discreteStart, astronomyStart);
const astronomy = html.slice(astronomyStart, evidenceStart);
const evidence = html.slice(evidenceStart);

test("Research keeps three ordered evidence owners without task-card navigation", () => {
  assert.ok(discreteStart >= 0);
  assert.ok(astronomyStart > discreteStart);
  assert.ok(evidenceStart > astronomyStart);
  assert.doesNotMatch(html, /class="research-task-nav"/);
  assert.match(html, />離散閉合</);
  assert.match(html, />天文差異</);
  assert.match(html, />四柱證據</);
  assert.doesNotMatch(html, /先回答：|再問：|最後才問：|Why 24,000\?|Exact ≠ astronomical/);
});

test("discrete task owns the instrument, exact closure evidence, and structural 60-day cycle", () => {
  assert.match(discrete, /id="recurrence-instrument"/);
  assert.match(discrete, /class="closure-grid"/);
  assert.match(discrete, /id="research-sexagenary-cycle"/);
  assert.match(discrete, /id="research-sexagenary-wheel"/);
  assert.match(discrete, /class="milestone-table"/);
  assert.doesNotMatch(discrete, /class="astronomy-panel"/);
  assert.doesNotMatch(discrete, /id="four-pillar-determinacy"/);
});

test("restored 60-day chart keeps the old wide-chart to narrow-readout proportion without reviving the legacy page", () => {
  assert.match(cycleCss, /grid-template-columns:\s*minmax\(0,\s*1\.5fr\)\s+minmax\(240px,\s*\.56fr\)/);
  assert.match(cycleJs, /sexagenaryCycle\.forEach/);
  assert.match(cycleJs, /heavenlyStems\.forEach/);
  assert.match(cycleJs, /earthlyBranches\.forEach/);
  assert.match(html, /research-sexagenary-cycle\.css/);
  assert.match(html, /research-sexagenary-cycle\.js/);
  assert.doesNotMatch(html, /id="sexagenary-wheel"/);
});

test("astronomy task owns residual detail and astronomical near-recurrence ranking", () => {
  assert.match(astronomy, /class="astronomy-panel"/);
  assert.match(astronomy, /id="astronomy-term-grid"/);
  assert.match(astronomy, /class="near-search-panel"/);
  assert.doesNotMatch(astronomy, /id="four-pillar-determinacy"/);
});

test("evidence task owns determinacy and the model appendix", () => {
  assert.match(evidence, /id="four-pillar-determinacy"/);
  assert.match(evidence, /class="model-boundary research-evidence-appendix"/);
  assert.doesNotMatch(evidence, /class="near-search-panel"/);
});

test("section chrome stays flat and compact on phone", () => {
  assert.doesNotMatch(taskCss, /research-task-nav/);
  assert.match(taskCss, /\.research-task-head\s*\{[\s\S]*display:flex/);
  assert.match(taskCss, /\.research-task-head \.eyebrow,[\s\S]*display:none/);
  assert.doesNotMatch(taskCss, /border-radius/);
});
