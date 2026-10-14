import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html,view,model,spine,css]=await Promise.all([
  readFile(new URL("../recurrence.html",import.meta.url),"utf8"),
  readFile(new URL("../src/research-absolute-boundary-consequence-view.js",import.meta.url),"utf8"),
  readFile(new URL("../src/research/seasonal-absolute-boundary-consequence.js",import.meta.url),"utf8"),
  readFile(new URL("../src/research-narrative-spine-view.js",import.meta.url),"utf8"),
  readFile(new URL("../research-absolute-boundary-consequence.css",import.meta.url),"utf8")
]);

test("Research 03 loads absolute boundary consequence before legacy determinacy",()=>{
  const absoluteScript=html.indexOf("research-absolute-boundary-consequence-view.js");
  const determinacyScript=html.indexOf("four-pillar-determinacy-view.js");
  assert.ok(absoluteScript>=0&&determinacyScript>absoluteScript);
  assert.match(view,/determinacy\.insertAdjacentElement\("beforebegin",panel\)/);
  assert.match(view,/absoluteBoundaryYearMonthRecurrence="displaced"/);
});

test("absolute consequence is gated on the canonical 2026 +24k state",()=>{
  assert.match(view,/baseYear\(\)===CONSEQUENCE\.baseYear/);
  assert.match(view,/Number\(instrument\?\.dataset\.deltaYears\)===CONSEQUENCE\.deltaYears/);
  assert.match(view,/root\.hidden=!active/);
  assert.match(model,/deltaYears:DATA\.targetYear-DATA\.baseYear/);
});

test("legacy determinacy is visibly demoted to shape-only when absolute evidence is active",()=>{
  assert.match(view,/shape-only-secondary/);
  assert.match(view,/shape-only 輔助判定/);
  assert.match(view,/共同 phase 已扣除/);
  assert.match(view,/shape-only-determinacy-details/);
  assert.match(view,/demoteDeterminacy\(\)/);
  assert.match(view,/restoreDeterminacy\(\)/);
  assert.match(css,/\.determinacy-panel\.shape-only-secondary/);
  assert.match(css,/\.shape-only-determinacy-details/);
});

test("Research spine prefers absolute +24k verdicts",()=>{
  assert.match(spine,/absoluteBoundary === "year-26026-research"/);
  assert.match(spine,/提前 10–14 d/);
  assert.match(spine,/absoluteYearMonth === "displaced"/);
  assert.match(spine,/年／月界未重現/);
});
