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

test("Research 03 loads absolute boundary consequence before legacy determinacy",()=>{
  const absoluteScript=html.indexOf("research-absolute-boundary-consequence-view.js");
  const determinacyScript=html.indexOf("four-pillar-determinacy-view.js");
  assert.ok(absoluteScript>=0&&determinacyScript>absoluteScript);
  assert.match(view,/determinacy\.insertAdjacentElement\("beforebegin",panel\)/);
  assert.match(view,/absoluteBoundaryReferenceJie="displaced"/);
});

test("absolute consequence is gated on the canonical 2026 +24k state",()=>{
  assert.match(view,/baseYear\(\)===CONSEQUENCE\.baseYear/);
  assert.match(view,/Number\(instrument\?\.dataset\.deltaYears\)===CONSEQUENCE\.deltaYears/);
  assert.match(view,/root\.hidden=!active/);
  assert.match(model,/deltaYears:DATA\.targetYear-DATA\.baseYear/);
});

test("legacy determinacy owns its own shape-only demotion when absolute evidence is active",()=>{
  assert.doesNotMatch(view,/demoteDeterminacy|restoreDeterminacy/);
  assert.match(fourPillarView,/shape-only-secondary/);
  assert.match(fourPillarView,/shape-only 輔助判定/);
  assert.match(fourPillarView,/全年平均位移已扣除/);
  assert.match(fourPillarView,/shape-only-determinacy-details/);
  assert.match(fourPillarView,/ensureShapeOnlyDetails\(\)/);
  assert.match(fourPillarView,/restoreShapeOnlyDetails\(\)/);
  assert.match(css,/\.determinacy-panel\.shape-only-secondary/);
  assert.match(css,/\.shape-only-determinacy-details/);
});

test("Research spine prefers absolute +24k verdicts",()=>{
  assert.match(spine,/absoluteBoundary === "year-26026-research"/);
  assert.match(spine,/TT 提前 10–14 d/);
  assert.match(spine,/absoluteReferenceJie === "displaced"/);
  assert.match(spine,/TT 節界未重現/);
});

test("Research 03 explicitly withholds a civil-time pillar verdict",()=>{
  assert.match(view,/不是西元 26026 某個真實民用年月日時的四柱判決/);
  assert.match(view,/不能直接升格成西元 26026 某個真實民用年月日時的年／月柱結論/);
  assert.match(view,/boundary-window union/);
  assert.match(css,/\.absolute-boundary-metrics/);
});
