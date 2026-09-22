import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [view, css, host, recurrenceGate, recurrenceHtml, recurrenceCss] = await Promise.all([
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-discrete-density.css", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/check-recurrence-lab.mjs", import.meta.url), "utf8"),
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../recurrence.css", import.meta.url), "utf8")
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

test("time displacement has one control owner before the recurrence instrument", () => {
  const dockStart = recurrenceHtml.indexOf('<section class="delta-dock"');
  const candidateStart = recurrenceHtml.indexOf('id="candidate-buttons"');
  const instrumentStart = recurrenceHtml.indexOf('id="recurrence-instrument"');
  const toolbarStart = recurrenceHtml.indexOf('<div class="recurrence-toolbar">');
  const instrumentEnd = recurrenceHtml.indexOf("</section>", instrumentStart);
  assert.ok(dockStart >= 0 && candidateStart > dockStart && instrumentStart > candidateStart && toolbarStart > instrumentStart && instrumentEnd > toolbarStart);
  assert.doesNotMatch(
    recurrenceHtml.slice(toolbarStart, instrumentEnd),
    /id="candidate-buttons"/
  );
  assert.match(
    recurrenceHtml.slice(dockStart),
    /id="delta-number"[\s\S]*?id="candidate-buttons"[\s\S]*?id="delta-slider"/
  );
  assert.match(
    recurrenceCss,
    /\.delta-dock\s*\{[\s\S]*?margin:\s*0 0 12px;[\s\S]*?grid-template-areas:"number presets presets" "slider slider global";/
  );
  assert.match(
    recurrenceCss,
    /@media \(max-width:820px\)[\s\S]*?grid-template-areas:"number" "presets" "slider" "global";/
  );
});

test("global period meaning is attached to the preset instead of a duplicate static readout", () => {
  assert.match(view, /button\[data-delta-years="24000"\]/);
  assert.match(view, /preset\.textContent = "全域 24,000"/);
  assert.match(view, /preset\.setAttribute\("aria-label", "三個離散相位同時歸零 24,000 年"\)/);
  assert.match(view, /preset\.dataset\.researchGlobalPeriodPreset = "1"/);
  assert.match(view, /dock\?\.querySelector\("\.global-period"\)/);
  assert.match(view, /duplicate\?\.remove\(\)/);
  assert.match(view, /dock\.classList\.add\("research-delta-consolidated"\)/);
  assert.match(css, /@media \(min-width:821px\)[\s\S]*?\.delta-dock\.research-delta-consolidated\s*\{[\s\S]*?grid-template-columns:\s*minmax\(130px,180px\) minmax\(0,1fr\)/);
});

test("local recurrence remains visible while derived closure interpretation is disclosed", () => {
  assert.match(view, /details\.id = "discrete-closure-details"/);
  assert.match(view, /local\.classList\.add\("research-local-recurrence-rail"\)/);
  assert.match(view, /label\.textContent = "局部年序＋日序首次重遇"/);
  assert.match(view, /note\.hidden = true/);
  assert.match(view, /grid\.insertAdjacentElement\("beforebegin", local\)/);
  assert.match(view, /details\.append\(summary, grid\)/);
  assert.doesNotMatch(closureView, /details\.open\s*=\s*true/);
});

test("60-day cycle is supporting evidence behind a closed native drilldown", () => {
  assert.match(view, /details\.id = "discrete-sexagenary-details"/);
  assert.match(view, /details\.dataset\.researchDrilldown = "discrete-sexagenary"/);
  assert.match(view, /60 日序來源/);
  assert.match(view, /10 天干 \/ 12 地支 → 60 配對/);
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


test("visible derivation explains why 24000 years is the discrete candidate before supporting drilldowns", () => {
  assert.match(recurrenceHtml, /class="discrete-derivation"/);
  assert.match(recurrenceHtml, /id="discrete-derivation-steps"/);
  assert.match(recurrenceHtml, /三個離散相位同時歸零，只建立四柱重現候選/);
  const derivationStart = recurrenceHtml.indexOf('class="discrete-derivation"');
  const milestoneStart = recurrenceHtml.indexOf('class="milestone-table"');
  const cycleStart = recurrenceHtml.indexOf('id="research-sexagenary-cycle"');
  assert.ok(derivationStart >= 0 && milestoneStart > derivationStart && cycleStart > milestoneStart);
  assert.match(recurrenceCss, /\.phase-gauge-caption[\s\S]*0 =/);
});
