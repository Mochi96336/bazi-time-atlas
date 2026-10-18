import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [html,css,discreteView,seasonalView,dayHourView,consequenceView]=await Promise.all([
  readFile(new URL("../recurrence.html",import.meta.url),"utf8"),
  readFile(new URL("../research-page-rhythm.css",import.meta.url),"utf8"),
  readFile(new URL("../src/research-discrete-density-view.js",import.meta.url),"utf8"),
  readFile(new URL("../src/research-seasonal-drift-evidence-view.js",import.meta.url),"utf8"),
  readFile(new URL("../src/day-hour-proof-chain-view.js",import.meta.url),"utf8"),
  readFile(new URL("../src/research-absolute-boundary-consequence-view.js",import.meta.url),"utf8")
]);
test("production Research loads the rhythm layer after component styles",()=>{
  const rhythm=html.indexOf("research-page-rhythm.css");
  for(const dependency of ["research-seasonal-drift-evidence.css","research-absolute-boundary-consequence.css","research-time-state.css"])
    assert.ok(html.indexOf(dependency)<rhythm,dependency+" must load before rhythm");
});
test("core phase and residual figures stay unfolded while support remains disclosed",()=>{
  assert.match(discreteView,/function markPhaseFanMainline\(\)/);
  assert.match(discreteView,/dataset\.researchMainline = "phase-fan"/);
  assert.doesNotMatch(discreteView,/discrete-phase-fan-details|ensurePhaseFanDrilldown/);
  const residual=html.indexOf('class="seasonal-drift-residual-strip"');
  const decomposition=html.indexOf('id="seasonal-drift-decomposition"');
  assert.ok(residual>0&&residual<decomposition);
  assert.ok(html.lastIndexOf("<details",residual)<html.lastIndexOf("</details>",residual));
  assert.match(html,/<details id="seasonal-drift-decomposition"/);
  assert.match(html,/<details id="secondary-astronomy-tools"/);
  assert.match(html,/class="model-boundary research-evidence-appendix"/);
});
test("production residual strip uses the 12-Jie evidence and stays interactive",()=>{
  assert.match(seasonalView,/function drawResidualStrip\(\)/);
  assert.match(seasonalView,/JIE_SUMMARY\.rows\.map/);
  assert.match(seasonalView,/meanAdvance=-DATA\.meanDriftDays/);
  assert.match(seasonalView,/residual:\(-row\.driftDays\)-meanAdvance/);
  assert.match(seasonalView,/activateBoundary\(row\.longitudeDegrees,"residual-strip"\)/);
  assert.match(seasonalView,/zeroLabel\.textContent="0 = 全年平均"/);
  assert.match(seasonalView,/residualStripSvg\.dataset\.ready="true"/);
  assert.match(html,/扣掉全年共同位移後/);
  assert.match(html,/常駐殘差帶看十二節相對全年平均/);
});
test("balanced production rhythm uses whitespace rather than a second palette",()=>{
  assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css,/rgba?\(/);
  for(const token of ["--research-space-20","--research-line-subtle","--research-text-secondary","--research-diagram-context","--research-current","--research-focus"])assert.ok(css.includes(token));
  assert.match(css,/\.discrete-to-astronomy,[\s\S]*?\.astronomy-to-evidence[\s\S]*?padding:var\(--research-space-20\) 0/);
  assert.match(css,/\.astronomy-to-evidence\{[^}]*margin-top:var\(--research-space-16\);[^}]*padding-block:var\(--research-space-12\)/);
  assert.match(css,/@media\(max-width:680px\)[\s\S]*?\.astronomy-to-evidence\{[^}]*margin-top:var\(--research-space-12\);[^}]*padding-block:var\(--research-space-12\)/);
  assert.match(css,/#research-evidence \.research-alignment-fork article\{[^}]*background:transparent/);
});
test("02 to 03 keeps an explicit chapter transition",()=>{
  const transition=html.indexOf('class="astronomy-to-evidence"');
  const evidence=html.indexOf('id="research-evidence"');
  assert.ok(transition>0&&transition<evidence);
  assert.match(html,/十二節已證明沒有回到原時刻/);
  assert.match(html,/那麼對八字，可以說到哪裡？/);
});

test("03 keeps the alignment fork on the core line before proof and source support",()=>{
  assert.match(dayHourView,/const conclusionPanel = document\.querySelector\("#absolute-boundary-consequence"\)/);
  assert.match(dayHourView,/\(conclusionPanel \?\? determinacyPanel\)\.insertAdjacentElement\("afterend", panel\)/);
  assert.match(consequenceView,/看上方四柱判定帶/);
});
