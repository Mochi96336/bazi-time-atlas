import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, taskCss, cycleCss, cycleJs, nearCss, determinacyCss, targetClockCss, proofJs] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../research-tasks.css", import.meta.url), "utf8"),
  readFile(new URL("../research-sexagenary-cycle.css", import.meta.url), "utf8"),
  readFile(new URL("../src/research-sexagenary-cycle.js", import.meta.url), "utf8"),
  readFile(new URL("../near-recurrence.css", import.meta.url), "utf8"),
  readFile(new URL("../four-pillar-determinacy.css", import.meta.url), "utf8"),
  readFile(new URL("../recurrence-target-clock.css", import.meta.url), "utf8"),
  readFile(new URL("../src/day-hour-proof-chain-view.js", import.meta.url), "utf8")
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
  assert.match(html, /class="research-outline"[^>]*aria-label="研究項目"/);
  assert.match(html, /href="#research-discrete"[^>]*>[\s\S]*?01[\s\S]*?離散閉合/);
  assert.match(html, /href="#research-astronomy"[^>]*>[\s\S]*?02[\s\S]*?天文差異/);
  assert.match(html, /href="#research-evidence"[^>]*>[\s\S]*?03[\s\S]*?四柱證據/);
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

test("astronomy task owns residual detail and keeps near-recurrence ranking terse", () => {
  assert.match(astronomy, /class="astronomy-panel"/);
  assert.match(astronomy, /id="astronomy-term-grid"/);
  assert.match(astronomy, /class="near-search-panel"/);
  assert.match(astronomy, /<strong>近回歸排名<\/strong>/);
  assert.doesNotMatch(astronomy, /離散全閉合後，哪次天文形狀最接近？|只評估 24,000 年整數倍/);
  assert.match(nearCss, /\.near-search-copy\s*\{[\s\S]*display:flex/);
  assert.doesNotMatch(nearCss, /near-search-copy h2|near-search-copy p/);
  assert.doesNotMatch(astronomy, /id="four-pillar-determinacy"/);
});

test("evidence task keeps authority but removes repeated report-style preambles", () => {
  assert.match(evidence, /id="four-pillar-determinacy"/);
  assert.match(evidence, /class="determinacy-label">可判定範圍/);
  assert.match(evidence, /class="model-boundary research-evidence-appendix"/);
  assert.doesNotMatch(evidence, /目前能證到哪裡|矩陣只列模型已有證據的柱位/);
  assert.doesNotMatch(evidence, /class="near-search-panel"/);
  assert.match(determinacyCss, /\.determinacy-panel\s*\{[\s\S]*border-radius:0;[\s\S]*background:transparent;/);
  assert.match(determinacyCss, /\.proof-chain-head p\s*\{\s*display:none;\s*\}/);
  assert.match(determinacyCss, /\.epoch-audit-head p\s*\{\s*display:none;\s*\}/);
});

test("research-only fixed-zone warning stays authoritative without occupying the default page", () => {
  assert.match(targetClockCss, /\.target-instant-controls > p\s*\{[\s\S]*display:none;/);
  assert.match(targetClockCss, /\.target-instant-controls\[data-enabled="true"\] > p\s*\{\s*display:block;\s*\}/);
  assert.match(proofJs, /proleptic Gregorian \+ 固定 UT1 offset/);
  assert.match(proofJs, /不是西元遠未來 UTC、DST 或政治時區預測/);
});

test("section chrome stays flat and compact on phone", () => {
  assert.doesNotMatch(taskCss, /research-task-nav/);
  assert.match(taskCss, /\.research-outline\s*\{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(taskCss, /\.research-outline a\s*\{[\s\S]*min-height:34px/);
  assert.doesNotMatch(taskCss, /\.research-outline[^}]*border-radius/);
  assert.match(taskCss, /\.research-task-head\s*\{[\s\S]*display:flex/);
  assert.match(taskCss, /\.research-task-head \.eyebrow,[\s\S]*display:none/);
  assert.doesNotMatch(taskCss, /border-radius/);
});