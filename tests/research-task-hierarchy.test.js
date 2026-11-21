import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cssSource, isLinked } from "./helpers/css-source.js";

const [html, taskCss, cycleCss, cycleJs, nearCss, determinacyCss, targetClockCss, proofJs, evidenceJs, evidenceCss, discreteCss, discreteJs, astronomyCss, residualCss, recurrenceCss, spineJs] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  Promise.resolve(cssSource("research-tasks.css")),
  Promise.resolve(cssSource("research-sexagenary-cycle.css")),
  readFile(new URL("../src/research-sexagenary-cycle.js", import.meta.url), "utf8"),
  Promise.resolve(cssSource("near-recurrence.css")),
  Promise.resolve(cssSource("four-pillar-determinacy.css")),
  Promise.resolve(cssSource("recurrence-target-clock.css")),
  readFile(new URL("../src/day-hour-proof-chain-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-evidence-drilldown-view.js", import.meta.url), "utf8"),
  Promise.resolve(cssSource("research-evidence-drilldown.css")),
  Promise.resolve(cssSource("research-discrete-density.css")),
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  Promise.resolve(cssSource("research-astronomy-drilldown.css")),
  Promise.resolve(cssSource("astronomical-residuals.css")),
  Promise.resolve(cssSource("recurrence.css")),
  readFile(new URL("../src/research-narrative-spine-view.js", import.meta.url), "utf8")
]);

const discreteStart = html.indexOf('id="research-discrete"');
const astronomyStart = html.indexOf('id="research-astronomy"');
const evidenceStart = html.indexOf('id="research-evidence"');
const discrete = html.slice(discreteStart, astronomyStart);
const astronomy = html.slice(astronomyStart, evidenceStart);
const evidence = html.slice(evidenceStart);
// Review 2026-11-21: the discrete tools and the other-Δ sandbox live in the lab.
const labStart = html.indexOf('id="research-lab"');
const lab = html.slice(labStart, html.indexOf('id="research-glossary"'));

test("Research keeps three ordered evidence owners without task-card navigation", () => {
  // #500 navigation is an intentional LAST cascade layer. Moving the same
  // CSS link above recurrence layout shrinks the original mobile comparison
  // row below the 844px fold without changing any Research source file.
  assert.ok(html.indexOf('href="./navigation-workspace.css"') >
    html.indexOf('href="./research-free-day-wheel.css"'),
    "latest navigation stylesheet must stay last in Research CSS cascade");
  assert.ok(discreteStart >= 0);
  assert.ok(astronomyStart > discreteStart);
  assert.ok(evidenceStart > astronomyStart);
  assert.doesNotMatch(html, /class="research-task-nav"/);
  // Research redesign R1: the outline is an answer route map — each step is
  // the result of its section, not a topic label.
  assert.match(html, /class="research-outline research-answer-map"[^>]*aria-label="研究項目：三步答案"/);
  assert.match(html, /href="#research-discrete"[^>]*>[\s\S]*?01[\s\S]*?24,000 年/);
  assert.match(html, /href="#research-astronomy"[^>]*>[\s\S]*?02[\s\S]*?差 10–14 天/);
  assert.match(html, /href="#research-evidence"[^>]*>[\s\S]*?03[\s\S]*?年月 ✓ 日時 ？/);
  assert.match(html, /八字多久會重複一次？/);
  assert.match(html, /class="lede research-answer">目前找不到<a class="research-term" href="#term-pillars">四柱<\/a>完整重複的週期。/);
  assert.doesNotMatch(html, /research-alignment-map/);
  assert.doesNotMatch(html, /Recurrence laboratory|<h1>回歸研究<\/h1>|離散週期重新對齊/);
  assert.match(html, /id="research-spine-discrete">曆法上三個循環全部對上<\/small>/);
  assert.match(html, /id="research-spine-astronomy">但真正的節氣沒有回來<\/small>/);
  assert.match(html, /id="research-spine-evidence">所以 24,000 年不是四柱的週期<\/small>/);
  assert.match(html, /class="research-task-relation">固定 24,000 年候選 → 12 節界校驗<\/span>/);
  assert.match(html, /class="research-task-relation">12 \/ 12 節界位移 → 四柱可判範圍<\/span>/);
  assert.doesNotMatch(html, /先回答：|再問：|最後才問：|Why 24,000\?|Exact ≠ astronomical/);
});


test("Research narrative spine summarizes the fixed argument rather than the current delta sandbox", () => {
  assert.match(html, /research-narrative-spine-view\.js/);
  for (const copy of ["曆法上三個循環全部對上", "但真正的節氣沒有回來", "所以 24,000 年不是四柱的週期"]) {
    assert.ok(spineJs.includes(copy), `missing fixed-spine outcome: ${copy}`);
  }
  assert.doesNotMatch(spineJs, /instrument\.dataset|boolDataset|fourPillarResolvedCount|astronomyValidity/);
});

test("the lab owns one current-state rail, the year strip, derivation, and structural 60-day cycle", () => {
  const reading01 = html.slice(discreteStart, astronomyStart);
  assert.match(reading01, /id="research-discrete-title">粗略週期從哪裡來？/);
  assert.match(reading01, /下一步：真正的節氣也回到原位了嗎？/);
  assert.match(reading01, /id="research-cycle-dials"/);
  assert.doesNotMatch(reading01, /id="recurrence-instrument"|id="research-discrete-tools"/);
  const discrete = lab;
  assert.match(discrete, /id="recurrence-instrument"/);
  assert.match(discrete, /class="recurrence-readout research-current-state"/);
  assert.match(discrete, /id="research-discrete-thesis"/);
  assert.match(discrete, /id="research-year-strip"/);
  assert.match(discrete, /id="research-sexagenary-cycle"/);
  assert.match(discrete, /id="research-sexagenary-wheel"/);
  assert.match(discrete, /class="discrete-derivation"/);
  assert.match(discrete, /id="research-discrete-tools" class="research-discrete-tools"/);
  assert.match(discrete, /id="research-year-strip-title">年度時間條/);
  assert.match(discrete, /id="research-year-full-cycle"/);
  assert.match(discrete, /id="research-year-selected-day"/);
  assert.match(discrete, /立春天文事件 · 顯示基準 UT1\+8 固定時差/);
  assert.match(discrete, /id="research-cycle-comparison"/);
  assert.ok(discrete.indexOf('id="research-discrete-thesis"') < discrete.indexOf('id="research-year-strip"'));
  assert.ok(discrete.indexOf('id="research-year-strip"') < discrete.indexOf('id="research-cycle-comparison"'));
  // The fan leads the lab and precedes the tools.
  assert.ok(discrete.indexOf('id="recurrence-instrument"') < discrete.indexOf('id="research-discrete-tools"'));
  assert.ok(discrete.indexOf('id="research-discrete-tools"') < discrete.indexOf('id="research-cycle-comparison"'));
  assert.doesNotMatch(discrete,/research-cycles-card|同一日期，兩個六十循環/);
  assert.ok(discrete.indexOf('id="research-cycle-comparison"') < discrete.indexOf('class="discrete-derivation"'));
  assert.ok(discrete.indexOf('class="discrete-derivation"') < discrete.indexOf('id="research-sexagenary-cycle"'));
  assert.doesNotMatch(discrete, /class="closure-grid"|class="milestone-table"|id="milestone-rows"/);
  // the lab's other-Δ sandbox follows all of the discrete tools
  assert.ok(discrete.indexOf('class="astronomy-panel"') > discrete.indexOf('id="research-sexagenary-cycle"'));
  assert.doesNotMatch(discrete, /id="four-pillar-determinacy"/);
});

test("Research 01 keeps the three-cycle phase fan permanently visible", () => {
  assert.match(discreteJs, /id = "discrete-phase-fan-details"/);
  assert.match(discreteJs, /research-phase-fan-panel/);
  assert.match(discreteJs, /document\.createElement\("section"\)/);
  assert.doesNotMatch(discreteJs, /document\.createElement\("details"\);\s*details\.id = "discrete-phase-fan-details"/);
  assert.match(discreteJs, /離散相位扇/);
  assert.match(discreteJs, /revealPhaseFanHash/);
  assert.match(discreteCss, /\.research-phase-fan-panel > header/);
  assert.doesNotMatch(html, /<details[^>]*id="discrete-phase-fan-details"/);
});

test("restored 60-day chart keeps the old wide-chart to narrow-readout proportion without reviving the legacy page", () => {
  assert.match(cycleCss, /grid-template-columns:\s*minmax\(0,\s*1\.5fr\)\s+minmax\(240px,\s*\.56fr\)/);
  assert.match(cycleJs, /sexagenaryCycle\.forEach/);
  assert.match(cycleJs, /heavenlyStems\.forEach/);
  assert.match(cycleJs, /earthlyBranches\.forEach/);
  assert.match(cycleJs, /research-cycle-center-value.*item\.ordinal/s);
  assert.match(html, /六十日序[\s\S]*10 天干 · 12 地支配對/);
  assert.ok(isLinked(html, "research-sexagenary-cycle.css"));
  assert.match(html, /research-sexagenary-cycle\.js/);
  assert.doesNotMatch(html, /id="sexagenary-wheel"/);
});

test("astronomy task answers where the +24k candidate fails and keeps the sandbox terse", () => {
  assert.match(astronomy, /id="research-astronomy-title">八字的節界回來了嗎？/);
  assert.match(lab, /class="astronomy-panel"/);
  assert.match(lab, /季節形狀 · 春分歸零/);
  assert.match(lab, /季節相位 · 公曆框架/);
  assert.match(lab, /春分相對公曆的絕對位移另算/);
  assert.match(lab, /id="astronomy-term-grid"/);
  assert.doesNotMatch(astronomy, /class="astronomy-panel"/);
  assert.match(astronomy, /class="near-search-panel"/);
  assert.match(astronomy, /<strong>長時間回歸搜尋<\/strong>/);
  assert.doesNotMatch(astronomy, /離散全閉合後，哪次天文形狀最接近？|只評估 24,000 年整數倍/);
  assert.match(nearCss, /\.near-search-copy\s*\{[\s\S]*display:flex/);
  assert.doesNotMatch(nearCss, /near-search-copy h2|near-search-copy p/);
  assert.doesNotMatch(astronomy, /id="four-pillar-determinacy"/);
});

test("evidence task answers what the fixed result means for BaZi without overclaiming", () => {
  assert.match(evidence, /id="research-evidence-title">對八字意味著什麼？/);
  assert.match(evidence, /id="four-pillar-determinacy"/);
  assert.match(evidence, /class="determinacy-label">四柱可判範圍/);
  assert.match(evidence, /class="model-boundary research-evidence-appendix"/);
  assert.doesNotMatch(evidence, /目前能證到哪裡|矩陣只列模型已有證據的柱位/);
  assert.doesNotMatch(evidence, /class="near-search-panel"/);
  assert.match(determinacyCss, /\.determinacy-panel\s*\{[\s\S]*border-radius:0;[\s\S]*background:transparent;/);
  assert.match(determinacyCss, /\.proof-chain-head p\s*\{\s*display:none;\s*\}/);
  assert.match(determinacyCss, /\.epoch-audit-head p\s*\{\s*display:none;\s*\}/);
});

test("research-only fixed-zone warning stays authoritative without occupying the default page", () => {
  assert.match(targetClockCss, /\.target-instant-controls > p\s*\{[\s\S]*display:none;/);
  assert.match(targetClockCss, /\.target-instant-controls\[data-enabled="true"\] > p\s*\{\s*display:block;\s*\}/);
  assert.match(proofJs, /proleptic Gregorian \+ 固定 UT1 offset/);
  assert.match(proofJs, /不是西元遠未來 UTC、DST 或政治時區預測/);
});



test("evidence defaults to outcome-first disclosure while research links can reveal the proof controls", () => {
  assert.match(evidenceJs, /id:"proof-chain-support-details"/);
  assert.match(evidenceJs, /label:"日／時柱證明"/);
  assert.match(evidenceJs, /openForConventionQuery:true/);
  assert.match(evidenceJs, /RESEARCH_CONVENTION_QUERY_KEYS/);
  for (const key of ["targetClock", "targetTime", "ut1Offset", "dayBoundary", "clockBasis", "lon"]) {
    assert.ok(evidenceJs.includes(`"${key}"`), `missing research convention query key: ${key}`);
  }
  assert.match(evidenceJs, /id:"epoch-audit-support-details"/);
  assert.match(evidenceJs, /label:"天文來源能力"/);
  assert.match(evidenceJs, /revealHash\(details, panel\)/);
  assert.match(evidenceJs, /queryRevealApplied/);
  const epochConfig = evidenceJs.match(/id:"epoch-audit-support-details"[\s\S]*?\n  \}\);/)?.[0] ?? "";
  assert.doesNotMatch(epochConfig, /openForConventionQuery:true/);

  assert.match(evidenceCss, /\.research-evidence-support\s*,[\s\S]*\.research-evidence-drilldown\s*\{/);
  assert.match(evidenceCss, /\.research-evidence-support > \.proof-chain-panel,[\s\S]*margin-top:\s*0;[\s\S]*border-top:\s*0;/);
  assert.match(evidenceCss, /@media \(max-width:480px\)[\s\S]*\.research-evidence-support,[\s\S]*min-height:\s*42px/);
});

test("section chrome stays flat and compact on phone", () => {
  assert.doesNotMatch(taskCss, /research-task-nav/);
  assert.match(taskCss, /\.research-outline\s*\{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(taskCss, /\.research-outline a\s*\{[\s\S]*min-height:42px/);
  assert.match(taskCss, /\.research-outline small\s*\{[\s\S]*grid-area:outcome/);
  assert.match(taskCss, /\.research-question-intro h1\s*\{[\s\S]*font-size:clamp\(25px,2\.8vw,40px\)/);
  assert.match(taskCss, /\.research-alignment-map\s*\{[\s\S]*display:grid/);
  assert.match(taskCss, /\.research-question-intro\s*\{[\s\S]*grid-template-columns:minmax\(0,1\.12fr\) minmax\(360px,\.88fr\)/);
  assert.match(taskCss, /\.research-question-aside\s*\{[\s\S]*justify-self:end/);
  assert.match(taskCss, /\.research-outline\s*\{[\s\S]*width:min\(1080px,calc\(100% - 4px\)\)/);
  assert.match(taskCss, /@media \(max-width:900px\)[\s\S]*\.research-question-intro\s*\{[\s\S]*grid-template-columns:1fr/);
  assert.match(taskCss, /@media \(max-width:480px\)[\s\S]*\.research-outline\s*\{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(taskCss, /@media \(max-width:480px\)[\s\S]*\.research-outline a\s*\{[\s\S]*min-height:42px/);
  assert.doesNotMatch(taskCss, /\.research-outline[^}]*border-radius/);
  assert.match(taskCss, /\.research-task-head\s*\{[\s\S]*display:flex/);
  assert.match(taskCss, /\.research-task-head \.eyebrow,[\s\S]*display:none/);
  assert.doesNotMatch(taskCss, /border-radius/);
});

test("mobile Research outcomes keep a readable interaction floor without inflating hidden evidence", () => {
  assert.match(
    discreteCss,
    /@media \(max-width:480px\)[\s\S]*\.research-discrete-drilldown > summary\s*\{[\s\S]*min-height:\s*42px;[\s\S]*padding:\s*8px 1px;[\s\S]*\.research-discrete-drilldown > summary strong\s*\{[\s\S]*font-size:\s*12px;/
  );
  assert.match(
    astronomyCss,
    /@media \(max-width:480px\)[\s\S]*\.research-astronomy-rms-rail > span\s*\{\s*font-size:\s*12px;\s*\}[\s\S]*\.research-astronomy-drilldown > summary\s*\{\s*min-height:\s*42px;\s*font-size:\s*12px;\s*\}/
  );
  assert.match(
    evidenceCss,
    /@media \(max-width:480px\)[\s\S]*\.research-evidence-support > summary,[\s\S]*min-height:\s*42px;[\s\S]*\.research-evidence-support > summary strong,[\s\S]*font-size:\s*12px;/
  );
  assert.match(
    determinacyCss,
    /@media \(max-width:480px\)[\s\S]*\.determinacy-card p\s*\{\s*font-size:\s*12px;\s*\}[\s\S]*\.determinacy-foot\s*\{\s*font-size:\s*12px;\s*\}/
  );
  assert.match(
    residualCss,
    /@media \(max-width:480px\)[\s\S]*\.month-boundary-stat small\s*\{\s*font-size:\s*12px;\s*\}[\s\S]*\.pillar-impact-item small\s*\{\s*font-size:\s*12px;\s*\}[\s\S]*\.full-pillar-attribution\s*\{\s*font-size:\s*12px;\s*\}/
  );
});

test("mobile Research primary interactions meet the same tap-target floor as disclosure rails", () => {
  assert.match(
    recurrenceCss,
    /@media \(max-width:480px\)[\s\S]*\.base-date input\s*\{[^}]*min-height:42px;[\s\S]*\.delta-dock input\[type="number"\]\s*\{\s*min-height:42px;\s*\}[\s\S]*\.candidate-buttons button\s*\{\s*min-height:42px;[\s\S]*\.delta-slider-wrap input\s*\{\s*min-height:32px;\s*\}[\s\S]*\.model-boundary summary\s*\{\s*min-height:42px;/
  );
  assert.match(nearCss, /@media \(max-width:480px\)[\s\S]*\.near-ranking-row\s*\{\s*min-height:44px;\s*\}/);
});
test("Research 02 fixed-case proof is separated from 01 delta and has keyboard-safe Jie selection",async()=>{
  const js=await readFile(new URL("../src/research-seasonal-drift-evidence-view.js",import.meta.url),"utf8");
  const css=await Promise.resolve(cssSource("research-story-hierarchy.css"));
  assert.match(astronomy,/id="research-case-transition"/);
  assert.match(astronomy,/比較的是 2026 年和 24,000 年後的 26026 年/);
  assert.match(astronomy,/class="research-model-scope"/);
  assert.match(astronomy,/26026 年的框架還沒有獨立驗證/);
  assert.match(astronomy,/id="seasonal-drift-orbit-details"/);
  // the "why" orbit figure is read before the consequence sentence that leads to 03
  assert.ok(astronomy.indexOf('id="seasonal-drift-orbit-details"') <
    astronomy.indexOf('class="seasonal-drift-evidence-note"'));
  assert.match(astronomy,/id="seasonal-boundary-select"/);
  assert.match(js,/boundarySelect\.addEventListener\("change"/);
  assert.match(js,/event\.target instanceof HTMLSelectElement/);
  assert.match(css,/\.research-case-transition/);
});
