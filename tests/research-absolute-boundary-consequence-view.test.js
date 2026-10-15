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

test("Research 03 publishes the fixed +24k boundary consequence before legacy determinacy",()=>{
  const absoluteScript=html.indexOf("research-absolute-boundary-consequence-view.js");
  const determinacyScript=html.indexOf("four-pillar-determinacy-view.js");
  assert.ok(absoluteScript>=0&&determinacyScript>absoluteScript);
  assert.match(view,/determinacy\.insertAdjacentElement\("beforebegin",panel\)/);
  assert.match(view,/publishFixedEvidence\(\)/);
  assert.match(view,/absoluteBoundaryReferenceJie="displaced"/);
  assert.doesNotMatch(view,/baseYear\(|aligned\(|deltaYears\)===CONSEQUENCE\.deltaYears|root\.hidden=!active/);
  assert.match(model,/deltaYears:DATA\.targetYear-DATA\.baseYear/);
});

test("legacy determinacy owns its own shape-only demotion under the fixed main evidence",()=>{
  assert.doesNotMatch(view,/demoteDeterminacy|restoreDeterminacy/);
  assert.match(fourPillarView,/shape-only-secondary/);
  assert.match(fourPillarView,/shape-only 輔助判定/);
  assert.match(fourPillarView,/全年平均位移已扣除/);
  assert.match(fourPillarView,/shape-only-determinacy-details/);
  assert.match(fourPillarView,/const deltaYears = absolutePrimary \? 24000 : explorerDeltaYears/);
  assert.match(fourPillarView,/const discreteYearSequenceClosed = absolutePrimary \? true : liveYearSequenceClosed/);
  assert.match(fourPillarView,/const discreteDayClosed = absolutePrimary \? true : liveDayClosed/);
  assert.match(fourPillarView,/data\.argumentDeltaYears|dataset\.argumentDeltaYears/);
  assert.match(css,/\.shape-only-determinacy-details/);
});

test("Research outline summarizes the fixed argument rather than the current delta",()=>{
  for(const copy of ["24,000 離散候選","TT 提前 10–14 d","12 / 12 節界位移"]){
    assert.ok(spine.includes(copy),`missing fixed-spine copy: ${copy}`);
  }
  assert.doesNotMatch(spine,/dataset\.deltaYears|yearSequenceClosed|fourPillarResolvedCount/);
});

test("Research 03 explicitly withholds a civil-time pillar verdict",()=>{
  assert.match(view,/不是西元 26026 某個真實民用年月日時的四柱判決/);
  assert.match(view,/不能直接升格成西元 26026 某個真實民用年月日時的年／月柱結論/);
  assert.match(view,/boundary-window union/);
  assert.match(css,/\.absolute-boundary-metrics/);
});
