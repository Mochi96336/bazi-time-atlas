import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cssSource } from "./helpers/css-source.js";

const [html,view,model,fourPillarView,css]=await Promise.all([
  readFile(new URL("../recurrence.html",import.meta.url),"utf8"),
  readFile(new URL("../src/research-absolute-boundary-consequence-view.js",import.meta.url),"utf8"),
  readFile(new URL("../src/research/seasonal-absolute-boundary-consequence.js",import.meta.url),"utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js",import.meta.url),"utf8"),
  Promise.resolve(cssSource("research-absolute-boundary-consequence.css"))
]);

test("Research 03 explains the two reference frames right after the fixed +24k pillar verdict",()=>{
  const conclusionScript=html.indexOf("research-absolute-boundary-consequence-view.js");
  const determinacyScript=html.indexOf("four-pillar-determinacy-view.js");
  assert.ok(conclusionScript>=0&&determinacyScript>conclusionScript);
  assert.match(html,/class="determinacy-verdict"[\s\S]*固定 \+24,000 公曆年[\s\S]*模型內：並非固定時間下的精確節界回歸/);
  assert.ok(html.indexOf('id="four-pillar-determinacy"')<html.indexOf('id="research-evidence-why"'));
  assert.match(view,/if\(why\)why\.append\(panel\)/);
  assert.match(view,/publishFixedEvidence\(\)/);
  assert.match(view,/absoluteBoundaryReferenceJie="displaced"/);
  assert.match(view,/年柱、月柱一樣，為什麼還不算週期？/);
  assert.match(model,/deltaYears:DATA\.targetYear-DATA\.baseYear/);
});

test("Research 03 does not redraw the twelve-Jie evidence already owned by 02",()=>{
  assert.doesNotMatch(view,/absolute-boundary-strip|absolute-boundary-buttons|renderStrip|svgEl\(/);
  assert.doesNotMatch(view,/查看 12 節詳細數值|boundary-window union/);
  assert.doesNotMatch(css,/absolute-boundary-strip|absolute-boundary-buttons|absolute-boundary-window/);
  assert.match(view,/十二個節都提早/);
  assert.match(view,/（02 的圖；/);
});

test("fixed Research 03 pillar cards follow the shared selected seasonal state",()=>{
  assert.match(fourPillarView,/RESEARCH_TIME_SELECTION_EVENT/);
  assert.match(fourPillarView,/researchSeasonalTimeState/);
  assert.match(fourPillarView,/event\.detail\?\.owner!==["']seasonal["']/);
  assert.match(fourPillarView,/panel\.dataset\.mode="shared-seasonal"/);
  assert.match(fourPillarView,/年／月可回同柱 · 日／時未能判定/);
  assert.match(fourPillarView,/pillar\.status==="research-resolved"/);
  assert.match(fourPillarView,/Math\.abs\(state\.comparison\.driftDays\)/);
  assert.doesNotMatch(fourPillarView,/shape-only-secondary|shape-only-determinacy-details|shape-only 輔助判定/);
});

test("Research 03 states the distinction without repeating the same verdict twice",()=>{
  assert.match(view,/比「太陽走到同一個位置」/);
  assert.match(view,/年柱、月柱可以一樣/);
  assert.match(view,/比「日曆上的同一天」/);
  assert.match(view,/日柱、時柱是「不知道」，不是「一定不同」/);
  assert.match(view,/不能反過來說 24,000 年後的四柱一定不一樣/);
  assert.doesNotMatch(view,/absolute-boundary-verdict|回答研究題目|24,000 ≠ 整套映射精確週期/);
  assert.doesNotMatch(css,/\.absolute-boundary-verdict/);
  assert.match(css,/\.research-alignment-fork/);
});

test("Research 03 visible pillar labels stay Chinese",()=>{
  assert.match(html,/class="eyebrow">四柱結論<\/div>/);
  for(const label of ["年","月","日","時"]){
    assert.match(html,new RegExp(`<header><span>${label}<\\/span><strong>${label}柱<\\/strong><\\/header>`));
  }
  assert.doesNotMatch(html,/Four-pillar recurrence|<span>Year<\/span>|<span>Month<\/span>|<span>Day<\/span>|<span>Hour<\/span>/);
});
