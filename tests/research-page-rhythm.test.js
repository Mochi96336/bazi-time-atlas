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
test("phase fan and unified 360-point wave stay unfolded while methods remain disclosed",()=>{
  assert.match(discreteView,/function markPhaseFanMainline\(\)/);
  assert.match(discreteView,/dataset\.researchMainline = "phase-fan"/);
  assert.doesNotMatch(discreteView,/discrete-phase-fan-details|ensurePhaseFanDrilldown/);
  const plate=html.indexOf('class="seasonal-drift-wave-composition"');
  const detail=html.indexOf('id="seasonal-drift-decomposition"');
  assert.ok(plate>0&&plate<detail);
  assert.ok(html.lastIndexOf("<details",plate)<html.lastIndexOf("</details>",plate));
  assert.match(html,/<details id="seasonal-drift-decomposition"/);
  assert.match(html,/<details id="secondary-astronomy-tools"/);
  assert.match(html,/class="model-boundary research-evidence-appendix"/);
});
test("single advance curve includes a same-scale mean reference and remains interactive",()=>{
  assert.match(seasonalView,/function drawCurve\(\)/);
  assert.match(seasonalView,/const advances=DATA\.driftDays\.map\(value=>-value\)/);
  assert.match(seasonalView,/const meanY=totalY\(meanAdvance\)/);
  assert.match(seasonalView,/zeroCaption\.textContent="0 = 完全重合"/);
  assert.match(seasonalView,/set\("seasonal-drift-wave-active-residual","全年平均提前 "/);
  assert.doesNotMatch(seasonalView,/const meanCaption=/);
  assert.match(seasonalView,/updateFromCurvePointer\(event\)/);
  assert.match(seasonalView,/class:"seasonal-drift-deviation-stick"/);
  assert.doesNotMatch(seasonalView,/seasonal-residual-path/);
  assert.match(seasonalView,/curveSvg\.dataset\.ready="true"/);
  assert.match(html,/常駐顯示全部 360 個黃經位置/);
  assert.doesNotMatch(html,/id="seasonal-drift-residual-strip-svg"/);
});
test("balanced production rhythm uses whitespace rather than a second palette",()=>{
  assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css,/rgba?\(/);
  for(const token of ["--research-space-20","--research-line-subtle","--research-text-secondary","--research-diagram-context","--research-current","--research-focus"])assert.ok(css.includes(token));
  assert.match(css,/\.discrete-to-astronomy,[\s\S]*?\.astronomy-to-evidence[\s\S]*?padding:var\(--research-space-20\) 0/);
  assert.match(css,/\.astronomy-to-evidence\{[^}]*margin-top:var\(--research-space-16\);[^}]*padding-block:var\(--research-space-12\)/);
  assert.match(css,/@media\(max-width:680px\)[\s\S]*?\.astronomy-to-evidence\{[^}]*margin-top:var\(--research-space-12\);[^}]*padding-block:var\(--research-space-12\)/);
  assert.doesNotMatch(css,/#research-evidence \.research-alignment-fork article\{[^}]*background:transparent/);
  assert.doesNotMatch(css,/#research-evidence \.determinacy-panel\[data-diagram-grammar="pillar-verdict"\] \.determinacy-card\{[^}]*background:transparent/);
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
