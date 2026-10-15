import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html,view,model,spine,fourPillarView,css]=await Promise.all([
  readFile(new URL("../recurrence.html",import.meta.url),"utf8"),
  readFile(new URL("../src/research-absolute-boundary-consequence-view.js",import.meta.url),"utf8"),
  readFile(new URL("../src/research/seasonal-absolute-boundary-consequence.js",import.meta.url),"utf8"),
  readFile(new URL("../src/research-narrative-spine-view.js",import.meta.url),"utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js",import.meta.url),"utf8"),
  readFile(new URL("../research-absolute-boundary-consequence.css",import.meta.url),"utf8")
]);

test("Research 03 publishes one fixed +24k conclusion before pillar determinacy",()=>{
  const conclusionScript=html.indexOf("research-absolute-boundary-consequence-view.js");
  const determinacyScript=html.indexOf("four-pillar-determinacy-view.js");
  assert.ok(conclusionScript>=0&&determinacyScript>conclusionScript);
  assert.match(view,/determinacy\.insertAdjacentElement\("beforebegin",panel\)/);
  assert.match(view,/publishFixedEvidence\(\)/);
  assert.match(view,/absoluteBoundaryReferenceJie="displaced"/);
  assert.match(view,/24,000 年不是完整「時間 → 八字」映射的精確週期/);
  assert.match(model,/deltaYears:DATA\.targetYear-DATA\.baseYear/);
});

test("Research 03 does not redraw the twelve-Jie evidence already owned by 02",()=>{
  assert.doesNotMatch(view,/absolute-boundary-strip|absolute-boundary-buttons|renderStrip|svgEl\(/);
  assert.doesNotMatch(view,/查看 12 節詳細數值|boundary-window union/);
  assert.doesNotMatch(css,/absolute-boundary-strip|absolute-boundary-buttons|absolute-boundary-window/);
  assert.match(view,/12 \/ 12 節界未重現/);
  assert.match(view,/證據已在 02 顯示，不在 03 重畫/);
});

test("fixed Research 03 pillar cards follow the shared selected seasonal state",()=>{
  assert.match(fourPillarView,/RESEARCH_TIME_SELECTION_EVENT/);
  assert.match(fourPillarView,/researchSeasonalTimeState/);
  assert.match(fourPillarView,/event\.detail\?\.owner!==["']seasonal["']/);
  assert.match(fourPillarView,/panel\.dataset\.mode="shared-seasonal"/);
  assert.match(fourPillarView,/年／月可判 · 日／時未定/);
  assert.match(fourPillarView,/pillar\.status==="research-resolved"/);
  assert.match(fourPillarView,/Math\.abs\(state\.comparison\.driftDays\)/);
  assert.doesNotMatch(fourPillarView,/shape-only-secondary|shape-only-determinacy-details|shape-only 輔助判定/);
});

test("Research outline ends in the recurrence conclusion rather than repeating the 02 evidence",()=>{
  for(const copy of ["24,000 離散候選","TT 提前 10–14 d","24,000 ≠ 完整週期"]){
    assert.ok(spine.includes(copy),`missing fixed-spine copy: ${copy}`);
  }
  assert.doesNotMatch(spine,/12 \/ 12 節界位移/);
  assert.doesNotMatch(spine,/dataset\.deltaYears|yearSequenceClosed|fourPillarResolvedCount/);
});

test("Research 03 states the distinction between same solar position and fixed elapsed calendar time",()=>{
  assert.match(view,/對齊太陽位置/);
  assert.match(view,/年／月可回到同柱/);
  assert.match(view,/對齊公曆／TT 相位/);
  assert.match(view,/日／時仍未定/);
  assert.match(view,/不代表每一個相隔 24,000 年的具體時刻都必然得到不同四柱/);
  assert.match(css,/\.research-conclusion-grid/);
});
