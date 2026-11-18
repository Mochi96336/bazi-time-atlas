import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html,consequenceView,consequenceCss,determinacyView,determinacyCss]=await Promise.all([
  readFile(new URL("../recurrence.html",import.meta.url),"utf8"),
  readFile(new URL("../src/research-absolute-boundary-consequence-view.js",import.meta.url),"utf8"),
  readFile(new URL("../research-absolute-boundary-consequence.css",import.meta.url),"utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js",import.meta.url),"utf8"),
  readFile(new URL("../four-pillar-determinacy.css",import.meta.url),"utf8")
]);

test("Research 03 production uses selected pillar + reference-frame hierarchy",()=>{
  assert.match(html,/data-diagram-grammar="pillar-verdict"/);
  assert.match(consequenceView,/dataset\.diagramGrammar="alignment-fork"/);
  assert.match(consequenceView,/對齊同一太陽黃經/);
  assert.match(consequenceView,/固定推進 24,000 公曆年/);
  assert.match(consequenceCss,/\.research-alignment-fork/);
  assert.match(determinacyCss,/data-diagram-grammar="pillar-verdict"/);
});

test("Research 03 production distinguishes supported from unresolved pillars",()=>{
  assert.match(determinacyView,/"research-resolved":"可回到同柱"/);
  assert.match(determinacyView,/"not-resolved-by-shape-model":"未能判定"/);
  assert.match(determinacyView,/年／月可回同柱 · 日／時未能判定/);
  assert.doesNotMatch(determinacyView,/"not-resolved-by-shape-model":"不同"/);
  assert.match(consequenceView,/日／時仍是「未能判定」/);
});

test("Research 03 production CSS drops the retired three-column conclusion grid",()=>{
  assert.doesNotMatch(consequenceCss,/research-conclusion-grid|data-conclusion=/);
});

test("Research 03 production does not redraw Research 02 evidence",()=>{
  assert.doesNotMatch(consequenceView,/svgEl|absolute-boundary-strip|renderStrip/);
  assert.match(consequenceView,/證據已在 02 顯示，不在 03 重畫/);
});

test("Research 02/03 explanations retain explicit reference frames and visual hierarchy",async()=>{
  const css=await readFile(new URL("../research-evidence-reading.css",import.meta.url),"utf8");
  assert.match(html,/href="\.\/research-evidence-reading\.css"/);
  assert.match(html,/以 0 天表示節界重合/);
  assert.match(html,/同一太陽黃經下年／月可回同柱/);
  assert.match(html,/仍不足以判定日／時/);
  assert.match(css,/#research-astronomy \.seasonal-drift-summary \.seasonal-drift-stat small/);
  assert.match(css,/#research-evidence \.determinacy-panel \.determinacy-card p/);
  assert.doesNotMatch(css,/linear-gradient|radial-gradient|rotate\(/);
});
