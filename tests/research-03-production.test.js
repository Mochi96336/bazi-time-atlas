import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cssSource } from "./helpers/css-source.js";

const [html,consequenceView,consequenceCss,determinacyView,determinacyCss]=await Promise.all([
  readFile(new URL("../recurrence.html",import.meta.url),"utf8"),
  readFile(new URL("../src/research-absolute-boundary-consequence-view.js",import.meta.url),"utf8"),
  Promise.resolve(cssSource("research-absolute-boundary-consequence.css")),
  readFile(new URL("../src/four-pillar-determinacy-view.js",import.meta.url),"utf8"),
  Promise.resolve(cssSource("four-pillar-determinacy.css"))
]);

test("Research 03 production uses selected pillar + reference-frame hierarchy",()=>{
  assert.match(html,/data-diagram-grammar="pillar-verdict"/);
  assert.match(consequenceView,/dataset\.diagramGrammar="alignment-fork"/);
  assert.match(consequenceView,/比「太陽走到同一個位置」/);
  assert.match(consequenceView,/固定往後 24,000 個公曆年/);
  assert.match(consequenceCss,/\.research-alignment-fork/);
  assert.match(determinacyCss,/data-diagram-grammar="pillar-verdict"/);
});

test("Research 03 production distinguishes supported from unresolved pillars",()=>{
  assert.match(determinacyView,/"research-resolved":"可回到同柱"/);
  assert.match(determinacyView,/"not-resolved-by-shape-model":"未能判定"/);
  assert.match(determinacyView,/年／月可回同柱 · 日／時未能判定/);
  assert.doesNotMatch(determinacyView,/"not-resolved-by-shape-model":"不同"/);
  assert.match(consequenceView,/日柱、時柱是「不知道」，不是「一定不同」/);
});

test("Research 03 production CSS drops the retired three-column conclusion grid",()=>{
  assert.doesNotMatch(consequenceCss,/research-conclusion-grid|data-conclusion=/);
});

test("Research 03 production does not redraw Research 02 evidence",()=>{
  assert.doesNotMatch(consequenceView,/svgEl|absolute-boundary-strip|renderStrip/);
  assert.match(consequenceView,/（02 的圖；/);
});

test("Research 02/03 explanations retain explicit reference frames and visual hierarchy",async()=>{
  const css=await Promise.resolve(cssSource("research-evidence-reading.css"));
  assert.match(html,/href="\.\/research-sections\.css"/);
  assert.match(html,/到達時刻（TT，均勻流動的天文時間）相減，再扣掉整整 24,000 個公曆年/);
  assert.match(html,/同一太陽黃經下年／月可依條件回同柱/);
  assert.match(html,/日／時仍未能判定/);
  assert.match(css,/#research-astronomy \.seasonal-drift-summary \.seasonal-drift-stat small/);
  assert.match(css,/#research-evidence \.determinacy-panel \.determinacy-card p/);
  assert.doesNotMatch(css,/linear-gradient|radial-gradient|rotate\(/);
});

test("Research 01–03 composition uses readable adjacent verdicts instead of tall empty cells",async()=>{
  const css=await Promise.resolve(cssSource("research-story-hierarchy.css"));
  const fixture=await readFile(new URL("../scripts/fixtures/research-03-production-visual.html",import.meta.url),"utf8");
  assert.match(html,/href="\.\/research-sections\.css"/);
  assert.match(html,/十二個節都沒有回到 0 天，所以 24,000 年不能直接當成八字的週期/);
  assert.match(css,/\.determinacy-card \{\s*min-height:0;/);
  assert.match(css,/\.determinacy-card \.determinacy-status \{\s*margin-top:10px;\s*padding-top:0;/);
  assert.match(css,/\.discrete-derivation-step\[data-milestone="structural"\] \{\s*min-height:0;/);
  assert.match(fixture,/cardHeight>205\|\|statusGap>32/);
  assert.doesNotMatch(css,/linear-gradient|radial-gradient|box-shadow/);
});

// Research redesign R4: 03 leads with the pillar verdict (its one figure);
// the two reference frames explain it on demand right after it.
test("Research 03 leads with the pillar verdict and explains both reference frames on demand",async()=>{
  const view=await readFile(new URL("../src/research-absolute-boundary-consequence-view.js",import.meta.url),"utf8");
  const fixture=await readFile(new URL("../scripts/fixtures/research-03-production-visual.html",import.meta.url),"utf8");
  assert.match(view,/const why=document\.querySelector\("#research-evidence-why"\);\s*if\(why\)why\.append\(panel\);/);
  assert.doesNotMatch(view,/determinacy\.insertAdjacentElement\("beforebegin",panel\)/);
  assert.match(fixture,/Reference frame explanation must follow the pillar verdict/);
  assert.match(view,/日柱、時柱是「不知道」/);
});

test("Research 01 stops repeating its mobile path; Research 03 mobile evidence uses one readable column",async()=>{
  const css=await Promise.resolve(cssSource("research-story-hierarchy.css"));
  const fixture=await readFile(new URL("../scripts/fixtures/research-03-production-visual.html",import.meta.url),"utf8");
  assert.match(css,/#research-discrete > \.research-discrete-scope \{ display:none; \}/);
  assert.match(css,/#research-lab \.research-discrete-thesis\[data-diagram-grammar="condition-ladder"\] \.research-condition-route \{\s*display:none;/);
  assert.match(css,/#research-evidence \.research-alignment-fork \{\s*grid-template-columns:minmax\(0,1fr\);/);
  assert.match(css,/#research-evidence \.determinacy-panel\[data-diagram-grammar="pillar-verdict"\] \.determinacy-grid \{\s*grid-template-columns:minmax\(0,1fr\);/);
  assert.match(css,/#research-evidence \.research-alignment-fork small \{[\s\S]*?font-size:13px;/);
  assert.match(fixture,/Research 03 mobile reasons are unreadable or cramped/);
});

test("Research conclusions state the TT time baseline and deep-time validation boundary at the point of claim",async()=>{
  const html=await readFile(new URL("../recurrence.html",import.meta.url),"utf8");
  const view=await readFile(new URL("../src/research-absolute-boundary-consequence-view.js",import.meta.url),"utf8");
  const visual02=await readFile(new URL("../scripts/fixtures/research-02-production-visual.html",import.meta.url),"utf8");
  const check02=await readFile(new URL("../scripts/visual-check-research-02-production.mjs",import.meta.url),"utf8");
  const check03=await readFile(new URL("../scripts/visual-check-research-03-production.mjs",import.meta.url),"utf8");
  assert.match(html,/到達時刻（TT，均勻流動的天文時間）相減，再扣掉整整 24,000 個公曆年（8,765,820 天）/);
  assert.match(html,/日柱加公曆要 8,000 年/);
  assert.match(html,/26026 年的框架還沒有獨立驗證，所以是模型推算/);
  assert.match(html,/模型內：並非固定時間下的精確節界回歸/);
  assert.match(view,/targetYearFrameIndependentlyValidated="false"/);
  assert.match(view,/深時間模型推算，26026 年框架尚未獨立驗證/);
  assert.match(visual02,/selectJie\(45,"立夏"\)/);
  assert.match(visual02,/selectJie\(315,"立春"\)/);
  for(const width of [320,390,480,481,660,1440]){
    assert.match(check02,new RegExp('width:'+width+'(?:,|})'));
    assert.match(check03,new RegExp('width:'+width+'(?:,|})'));
  }
});
