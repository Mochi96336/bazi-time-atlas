import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  view,
  css,
  host,
  recurrenceGate,
  recurrenceHtml,
  recurrenceCss,
  recurrenceView,
  yearStripView,
  cycleView,
  cycleCss
] = await Promise.all([
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-discrete-density.css", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/check-recurrence-lab.mjs", import.meta.url), "utf8"),
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../recurrence.css", import.meta.url), "utf8"),
  readFile(new URL("../src/recurrence-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-year-strip-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-sexagenary-cycle.js", import.meta.url), "utf8"),
  readFile(new URL("../research-sexagenary-cycle.css", import.meta.url), "utf8")
]);

test("discrete presentation removes duplicate top scope copy", () => {
  assert.match(view, /\.recurrence-intro > \.scope-note/);
  assert.match(view, /\.remove\(\)/);
});

test("time displacement has one control owner before the recurrence instrument", () => {
  const dockStart = recurrenceHtml.indexOf('<section class="delta-dock"');
  const candidateStart = recurrenceHtml.indexOf('id="candidate-buttons"');
  const instrumentStart = recurrenceHtml.indexOf('id="recurrence-instrument"');
  const toolbarStart = recurrenceHtml.indexOf('<div class="recurrence-toolbar">');
  const instrumentEnd = recurrenceHtml.indexOf("</section>", instrumentStart);
  assert.ok(dockStart >= 0 && candidateStart > dockStart && instrumentStart > candidateStart && toolbarStart > instrumentStart && instrumentEnd > toolbarStart);
  assert.doesNotMatch(recurrenceHtml.slice(toolbarStart, instrumentEnd), /id="candidate-buttons"/);
  assert.match(recurrenceHtml.slice(dockStart), /id="delta-number"[\s\S]*?id="candidate-buttons"[\s\S]*?id="delta-slider"/);
  assert.match(recurrenceCss, /\.delta-dock\s*\{[\s\S]*?margin:\s*0 0 12px;/);
});

test("global period meaning remains attached to the 24000 preset", () => {
  assert.match(view, /button\[data-delta-years="24000"\]/);
  assert.match(view, /preset\.textContent = "全域 24,000"/);
  assert.match(view, /三個離散相位同時歸零 24,000 年/);
  assert.match(view, /duplicate\?\.remove\(\)/);
  assert.match(css, /\.delta-dock\.research-delta-consolidated/);
});

test("current closure state is one compact rail instead of a card wall or disclosure", () => {
  assert.match(recurrenceHtml, /class="recurrence-readout research-current-state"/);
  assert.match(recurrenceHtml, /data-closure="gregorian"[\s\S]*id="gregorian-status"/);
  assert.match(recurrenceHtml, /data-closure="year"[\s\S]*id="year-status"/);
  assert.match(recurrenceHtml, /data-closure="day"[\s\S]*id="day-status"/);
  assert.match(css, /\.recurrence-readout\.research-current-state\s*\{[\s\S]*?grid-template-columns:/);
  assert.doesNotMatch(recurrenceHtml, /class="closure-grid"|discrete-closure-details|research-local-recurrence-rail/);
  assert.doesNotMatch(view, /ensureClosureDrilldown|discrete-closure-details/);
  assert.match(recurrenceGate, /compact current-state rail/);
});

test("milestone detail table is fully removed while the derivation stays visible", () => {
  assert.doesNotMatch(recurrenceHtml, /class="milestone-table"|id="milestone-rows"|相位明細/);
  assert.doesNotMatch(view, /ensureMilestoneDrilldown|discrete-milestone-details|milestone-rows/);
  assert.doesNotMatch(recurrenceView, /milestoneRows|milestone-row/);
  for (const delta of ["400", "1200", "8000", "24,000"]) {
    assert.ok(recurrenceView.includes(delta), `missing derivation delta ${delta}`);
  }
  assert.match(recurrenceHtml, /class="discrete-derivation"/);
});

test("year strip owns the visible 1/1, Li Chun, base date, year end, and next-same-date cue", () => {
  assert.match(recurrenceHtml, /id="research-year-strip"/);
  assert.match(recurrenceHtml, />1\/1</);
  assert.match(recurrenceHtml, />立春</);
  assert.match(recurrenceHtml, />基準日</);
  assert.match(recurrenceHtml, />12\/31</);
  assert.match(recurrenceHtml, /id="research-year-next-date"/);
  assert.match(recurrenceHtml, /id="research-year-elapsed-days"/);
  assert.match(recurrenceHtml, /跨過下一個立春年界後，進入下一個干支年序/);
  assert.match(recurrenceHtml, /research-year-strip-view\.js/);
});

test("year strip composes existing authorities and fails closed outside exact Li Chun coverage", () => {
  assert.match(yearStripView, /gregorianOrdinal/);
  assert.match(yearStripView, /recurrenceState/);
  assert.match(yearStripView, /validateGregorianDate/);
  assert.match(yearStripView, /solarTermEventForCivilYear/);
  assert.match(yearStripView, /solarTermEventForCivilYear\(year, "立春"\)/);
  assert.match(yearStripView, /catch \{[\s\S]*?return null;/);
  assert.match(yearStripView, /liChunMarker\.hidden = true/);
  assert.match(yearStripView, /liChunUnavailable\.hidden = false/);
  assert.doesNotMatch(yearStripView, /2\/4|02-04|year\s*%\s*4/);
});

test("60-day cycle remains supporting evidence behind one flat drilldown", () => {
  assert.match(view, /details\.id = "discrete-sexagenary-details"/);
  assert.match(view, /details\.dataset\.researchDrilldown = "discrete-sexagenary"/);
  assert.match(view, /60 日序來源/);
  assert.match(view, /10 天干 \/ 12 地支 → 60 配對/);
  assert.match(css, /\.research-sexagenary-drilldown > \.research-cycle\s*\{[\s\S]*?border-top:\s*0;/);
});

test("60-day wheel is the selector: direct sector click, pointer scrub, and keyboard arrows remain", () => {
  assert.doesNotMatch(recurrenceHtml, /research-cycle-prev|research-cycle-next|前一位|後一位/);
  assert.match(cycleView, /hit\.addEventListener\("click", \(\) => setActive\(index\)\)/);
  assert.match(cycleView, /export function cycleIndexFromLocalPoint/);
  assert.match(cycleView, /addEventListener\("pointerdown"/);
  assert.match(cycleView, /addEventListener\("pointermove"/);
  assert.match(cycleView, /setPointerCapture/);
  assert.match(cycleView, /event\.key === "ArrowLeft"/);
  assert.match(cycleView, /event\.key === "ArrowRight"/);
  assert.match(cycleCss, /#research-sexagenary-wheel\s*\{[\s\S]*?touch-action:\s*none;/);
});

test("visible reading order is current state then year strip then derivation then supporting cycle", () => {
  const stateStart = recurrenceHtml.indexOf('class="recurrence-readout research-current-state"');
  const stripStart = recurrenceHtml.indexOf('id="research-year-strip"');
  const derivationStart = recurrenceHtml.indexOf('class="discrete-derivation"');
  const cycleStart = recurrenceHtml.indexOf('id="research-sexagenary-cycle"');
  assert.ok(stateStart >= 0 && stripStart > stateStart && derivationStart > stripStart && cycleStart > derivationStart);
  assert.match(recurrenceHtml, /三個離散相位同時歸零，只建立四柱重現候選/);
  assert.match(recurrenceHtml, /class="phase-gauge-caption"[\s\S]*0 = 閉合/);
});

test("research integration still loads the discrete presentation layer", () => {
  assert.match(host, /import "\.\/research-discrete-density-view\.js";/);
});
