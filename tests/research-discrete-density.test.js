import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  view,
  css,
  host,
  recurrenceGate,
  recurrenceHtml,
  recurrenceCss,
  recurrenceView,
  yearStripView,
  dayHourView,
  targetInstantAuthority,
  seasonalBoundaryAuthority,
  seasonalCivilProjection,
  cycleView,
  cycleCss
] = await Promise.all([
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-discrete-density.css", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/check-recurrence-lab.mjs", import.meta.url), "utf8"),
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../recurrence.css", import.meta.url), "utf8"),
  readFile(new URL("../src/recurrence-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-year-strip-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/day-hour-proof-chain-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/recurrence/target-instant-instrument.js", import.meta.url), "utf8"),
  readFile(new URL("../src/recurrence/seasonal-boundary-authority.js", import.meta.url), "utf8"),
  readFile(new URL("../src/recurrence/seasonal-civil-projection.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-sexagenary-cycle.js", import.meta.url), "utf8"),
  readFile(new URL("../research-sexagenary-cycle.css", import.meta.url), "utf8")
]);

test("discrete presentation removes duplicate top scope copy", () => {
  assert.match(view, /\.recurrence-intro > \.scope-note/);
  assert.match(view, /\.remove\(\)/);
});

test("selected date owns the top rail; Δ controls move to the lower derivation rail", async () => {
  const stripStart=recurrenceHtml.indexOf('id="research-year-strip"');
  const selectedStart=recurrenceHtml.indexOf('id="research-target-date-form"');
  const trackStart=recurrenceHtml.indexOf('class="research-year-track"');
  const comparisonStart=recurrenceHtml.indexOf('id="research-cycle-comparison"');
  const instrumentStart=recurrenceHtml.indexOf('id="recurrence-instrument"');
  const derivationStart=recurrenceHtml.indexOf('class="discrete-derivation"');
  const sliderStart=recurrenceHtml.indexOf('id="delta-slider"');
  const controlsStart=recurrenceHtml.indexOf('id="research-controls"');
  const dockStart=recurrenceHtml.indexOf('<section class="delta-dock"');
  const baseStart=recurrenceHtml.indexOf('class="base-date research-base-date"');
  const candidatesStart=recurrenceHtml.indexOf('id="candidate-buttons"');
  assert.ok(stripStart>=0 && selectedStart>stripStart && trackStart>selectedStart,
    "selected date must stay inside the original year-strip header");
  assert.ok(comparisonStart>trackStart && instrumentStart>comparisonStart && derivationStart>instrumentStart,
    "year-strip evidence must precede the fan and lower Δ derivation");
  const derivationMarkup=recurrenceHtml.slice(derivationStart);
  assert.ok(derivationMarkup.includes('id="delta-slider"') &&
    derivationMarkup.includes('id="research-controls"') &&
    derivationMarkup.includes('class="delta-dock research-shift-toolbar"'),
    "lower derivation must retain the public Δ slider and optional shift toolbar");
  assert.ok(baseStart>dockStart && candidatesStart>dockStart,
    "baseline and hidden canonical candidates must remain owned by the optional toolbar");
  assert.match(recurrenceHtml,/id="research-target-date-input"/);
  assert.match(recurrenceHtml,/id="research-target-date-apply"/);
  assert.match(recurrenceHtml,/id="research-controls" class="research-controls-compact research-derivation-controls"/);
  assert.match(recurrenceHtml,/id="research-jump-instant-form"/);
  assert.match(recurrenceHtml,/id="research-jump-instant"/);
  assert.match(recurrenceHtml,/id="research-delta-step"/);
  assert.match(recurrenceHtml,/id="research-delta-step-minus"/);
  assert.match(recurrenceHtml,/id="research-delta-step-plus"/);
  assert.match(recurrenceHtml,/id="research-base-editor"/);
  assert.doesNotMatch(recurrenceHtml.slice(selectedStart,trackStart),/id="research-controls"|id="base-year"|id="delta-number"/);
  assert.ok(recurrenceHtml.slice(derivationStart,controlsStart).includes('id="delta-slider"'));
  for(const id of ["base-year","base-month","base-day","delta-number","candidate-buttons"])
    assert.ok(recurrenceHtml.slice(controlsStart).includes(`id="${id}"`));
  const layout=await readFile(new URL("../research-compact-surface.css",import.meta.url),"utf8");
  assert.match(layout,/\.research-task-primary \.research-year-strip\s*\{[\s\S]*?width:100%;max-width:none/);
  assert.match(layout,/\.research-year-head \.research-date-picker\s*\{[\s\S]*?display:flex/);
  assert.match(layout,/\.research-delta-public-slider\s*\{[\s\S]*?grid-area:slider/);
  assert.match(layout,/\.research-delta-public-slider input\[type="range"\][\s\S]*?height:32px/);
  assert.match(recurrenceHtml,/id="delta-slider-output"[^>]*>0 年<\/output>/);
  assert.match(recurrenceView,/setText\("delta-slider-output"/);
  assert.match(recurrenceView,/--delta-progress/);
  assert.match(layout,/-webkit-appearance:none/);
  assert.match(layout,/::-webkit-slider-thumb/);
  assert.match(layout,/grid-template-columns:minmax\(180px,1fr\) auto/);
  assert.match(layout,/\.discrete-derivation \.research-derivation-controls > \.delta-dock[\s\S]*?position:absolute/);
  assert.match(layout,/\.delta-dock\.research-shift-toolbar[\s\S]*?display:flex[\s\S]*?min-height:46px/);
  assert.match(layout,/\.research-shift-toolbar > form[\s\S]*?flex:1 1 300px/);
  assert.match(layout,/\.research-base-editor > \.research-base-date[\s\S]*?position:absolute/);
  assert.match(layout,/\.research-shift-toolbar > \[hidden\][\s\S]*?display:none!important/);
  assert.match(layout,/background:#0a0f12/);
  assert.match(layout,/border:1px solid rgba\(196,207,215,\.14\)/);
  assert.match(layout,/\.discrete-derivation \.research-derivation-controls > summary[\s\S]*?min-height:34px/);
  assert.match(layout,/\.discrete-derivation-steps\s*\{[\s\S]*?repeat\(5,minmax\(0,1fr\)\)/);
  assert.equal((css.match(/width:\s*min\(980px,100%\)/g)||[]).length,0);
  assert.ok(recurrenceCss.includes(".delta-dock {"));
});


test("R11 Other displacement is useful without duplicating the public milestone rail",()=>{
  assert.match(recurrenceHtml,/placeholder="YYYY\/MM\/DD HH:MM"/);
  for (const value of ["60","400","1200","8000","24000"]) {
    assert.match(recurrenceHtml,new RegExp(`<option value="${value}"`));
  }
  assert.match(recurrenceHtml,/id="candidate-buttons"[^>]*hidden/);
  assert.match(recurrenceHtml,/class="global-period" hidden/);
  assert.match(recurrenceView,/function shiftBySelectedStep\(direction\)/);
  assert.match(recurrenceView,/currentDelta \+ direction \* step/);
  assert.match(recurrenceView,/projectExplicitResearchTargetDate\(currentBase,currentDelta,parsed\.date\)/);
  assert.match(recurrenceView,/target-instant-enabled/);
  assert.match(recurrenceView,/targetTime/);
  assert.match(recurrenceView,/setText\("research-base-summary"/);
});

test("default single-date readout and responsive fan preserve paired comparisons",async()=>{
  const compare=await readFile(new URL("../src/research-cycle-comparison-view.js",import.meta.url),"utf8");
  const layout=await readFile(new URL("../research-compact-surface.css",import.meta.url),"utf8");
  assert.match(recurrenceHtml,/id="research-cycles-target-label"/);
  assert.match(compare,/deltaYears === 0/);
  assert.match(compare,/selectedTargetInstantBound !== "true"/);
  assert.match(compare,/panel\.dataset\.readoutMode = singleDate \? "single" : "comparison"/);
  assert.ok(layout.includes('data-readout-mode="single"') &&
    layout.includes('research-cycle-inline-row[data-side="base"] {display:none}'));
  assert.match(layout,/height:clamp\(315px,calc\(70vw \+ 85px\),385px\)/);
  assert.match(layout,/top:74px;[\s\S]*?height:calc\(100% - 74px\)/);
  assert.match(recurrenceHtml,/class="research-fan-graphic"/);
});

test("year-day local recurrence is promoted into the visible derivation rail",()=>{
  assert.match(recurrenceView,/DERIVATION_STRUCTURAL_DELTAS = Object\.freeze\(\[0, 400, 1200, 8000, 24_000\]\)/);
  assert.match(recurrenceView,/visibleDerivationDeltas\(localYears\)/);
  assert.match(recurrenceView,/\.\.\.\(Number\.isInteger\(localYears\) \? \[localYears\] : \[\]\)/);
  assert.match(recurrenceView,/data\.milestone|dataset\.milestone/);
  assert.match(recurrenceView,/local-year-day/);
  assert.match(recurrenceView,/60 年序＋60 日序首次重遇；公曆 400 年相位不必歸零/);
  assert.match(recurrenceView,/deltaYears === 0[\s\S]*?\? recurrenceState\(currentBase,0\)/);
  assert.match(recurrenceView,/deltaYears === 0 \? "0 年"/);
  assert.match(recurrenceView,/選定日期本身 · 三個離散相位的基準點/);
  assert.match(recurrenceHtml,/id="discrete-derivation-steps"/);
  assert.match(css,/grid-template-columns:minmax\(82px,\.55fr\) repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css,/\.discrete-derivation-step\.is-local-recurrence/);
  assert.match(css,/@media\(max-width:820px\)[\s\S]*?grid-auto-flow:column;[\s\S]*?overflow-x:auto/);
  assert.doesNotMatch(recurrenceHtml,/summary><span>Δ/);
});

test("R7 compresses the fan header space without removing its legend",async()=>{
  const layout=await readFile(new URL("../research-compact-surface.css",import.meta.url),"utf8");
  assert.match(layout,/@media\(min-width:821px\)[\s\S]*?research-fan-graphic[\s\S]*?height:clamp\(445px,32vw,465px\)/);
  assert.match(layout,/@media\(min-width:821px\)[\s\S]*?#recurrence-wheel[\s\S]*?top:-90px/);
  assert.match(layout,/recurrence-legend[\s\S]*?display:flex/);
  assert.match(layout,/phase-gauge-caption strong,[\s\S]*?display:inline/);
  assert.match(recurrenceHtml,/class="recurrence-legend"/);
  assert.match(recurrenceHtml,/class="phase-gauge-caption"/);
});

test("fan explains its own rings, datum and astronomy layer without a separate tutorial", () => {
  assert.match(recurrenceHtml,/0 = 與基準同相位/);
  assert.match(recurrenceView,/label\.textContent = "基準 · 0"/);
  assert.match(recurrenceView,/displayLabel:"公曆 · 400 年"/);
  assert.match(recurrenceView,/displayLabel:"年序 · 60 年"/);
  assert.match(recurrenceView,/displayLabel:"日序 · 60 日"/);
  assert.match(recurrenceView,/astronomyLabel\.textContent = "十二節 · 天文殘差"/);
  assert.match(recurrenceView,/return-marker-zero-node/);
  assert.match(recurrenceCss,/\.phase-ring-name\s*\{/);
  assert.match(recurrenceCss,/\.astronomy-layer-label\s*\{/);
  assert.match(recurrenceCss,/\.return-marker-zero-node\s*\{/);
});

test("global period meaning remains attached to the 24000 preset", () => {
  assert.match(view, /button\[data-delta-years="24000"\]/);
  assert.match(view, /preset\.textContent = "全域 24,000"/);
  assert.match(view, /三個離散相位同時歸零 24,000 年/);
  assert.match(view, /duplicate\?\.remove\(\)/);
  assert.match(css, /\.delta-dock\.research-delta-consolidated/);
});

test("current closure state is one compact rail instead of a card wall or disclosure", () => {
  assert.match(recurrenceHtml, /class="recurrence-readout research-current-state"/);
  assert.match(recurrenceHtml, /data-closure="gregorian"[\s\S]*id="gregorian-status"/);
  assert.match(recurrenceHtml, /data-closure="year"[\s\S]*id="year-status"/);
  assert.match(recurrenceHtml, /data-closure="day"[\s\S]*id="day-status"/);
  assert.match(css, /\.recurrence-readout\.research-current-state\s*\{[\s\S]*?grid-template-columns:/);
  assert.doesNotMatch(recurrenceHtml, /class="closure-grid"|discrete-closure-details|research-local-recurrence-rail/);
  assert.doesNotMatch(view, /ensureClosureDrilldown|discrete-closure-details/);
  assert.match(recurrenceGate, /compact current-state rail/);
});

test("milestone detail table is fully removed while the derivation stays visible", () => {
  assert.doesNotMatch(recurrenceHtml, /class="milestone-table"|id="milestone-rows"|相位明細/);
  assert.doesNotMatch(view, /ensureMilestoneDrilldown|discrete-milestone-details|milestone-rows/);
  assert.doesNotMatch(recurrenceView, /milestoneRows|milestone-row/);
  for (const delta of ["400", "1200", "8000", "24,000"]) {
    assert.ok(recurrenceView.includes(delta), `missing derivation delta ${delta}`);
  }
  assert.match(recurrenceHtml, /class="discrete-derivation"/);
});

test("year strip owns the visible 1/1, Li Chun, selected date, year end, and next-same-date cue", () => {
  assert.match(recurrenceHtml, /id="research-year-strip"/);
  assert.match(recurrenceHtml, />1\/1</);
  assert.match(recurrenceHtml, /id="research-year-li-chun-title">立春 · — → —<\/strong>/);
  assert.match(recurrenceHtml, /id="research-year-base-title">選定日 · —年<\/strong>/);
  assert.match(recurrenceHtml, />12\/31</);
  assert.match(recurrenceHtml, /id="research-year-strip-basis">立春天文事件 · 顯示基準 UT1\+8 固定時差/);
  assert.match(recurrenceHtml, /id="research-year-li-chun-unavailable-copy">節氣天文 epoch 尚未解析/);
  assert.match(recurrenceHtml, /id="research-year-next-date"/);
  assert.match(recurrenceHtml, /id="research-year-elapsed-days"/);
  assert.match(recurrenceHtml, /aria-label="選定日到下一年同月同日"/);
  assert.doesNotMatch(recurrenceHtml, /aria-label="基準日到下一年同月同日"/);
  assert.match(recurrenceHtml, /Δ 年 mod 60 的名義序號；不決定立春前後的年柱/);
  assert.doesNotMatch(recurrenceHtml, /跨過下一個立春年界後，進入下一個干支年序/);
  assert.match(recurrenceHtml, /research-year-strip-view\.js/);
});

test("year strip follows the currently selected target date instead of the recurrence base date", () => {
  assert.match(recurrenceView, /instrument\.dataset\.targetDate = state\.targetValid \? formatDate\(state\.targetDate\) : "invalid"/);
  assert.match(yearStripView, /parseDate\(instrument\.dataset\.targetDate\)/);
  assert.match(yearStripView, /attributeName === "data-target-date"/);
  assert.match(yearStripView, /data-selected-target-instant-basis/);
  assert.match(yearStripView, /data-selected-target-instant-bound/);
  assert.match(yearStripView, /data-selected-target-instant-julian-day/);
  assert.doesNotMatch(yearStripView, /parseDate\(instrument\.dataset\.baseDate\)/);
});

test("year strip composes seasonal epoch and civil-projection authorities without a legacy civil bypass", () => {
  assert.match(yearStripView, /gregorianOrdinal/);
  assert.match(yearStripView, /recurrenceState/);
  assert.match(yearStripView, /validateGregorianDate/);
  assert.match(yearStripView, /resolveResearchSeasonalBoundary/);
  assert.match(yearStripView, /projectSeasonalBoundaryToCivil/);
  assert.doesNotMatch(yearStripView, /solarTermEventForCivilYear/);
  assert.match(yearStripView, /sexagenaryYearPillarForLiChunYear/);
  assert.match(yearStripView, /sexagenaryYearPillarForLiChunYear\(selectedDate\.year - 1\)/);
  assert.match(yearStripView, /sexagenaryYearPillarForLiChunYear\(selectedDate\.year\)/);
  assert.match(yearStripView, /liChunTransition = freeze\(\{ before:beforeYearPillar, after:afterYearPillar \}\)/);
  assert.match(yearStripView, /strip\.dataset\.liChunBoundaryStatus/);
  assert.match(yearStripView, /strip\.dataset\.liChunProjectionStatus/);
  assert.match(yearStripView, /strip\.dataset\.selectedYearPillar/);
  assert.match(yearStripView, /research-year-li-chun-unavailable-copy/);
  assert.match(yearStripView, /source-covered-runtime-missing/);
  assert.match(yearStripView, /absolute-source-unavailable/);
  assert.doesNotMatch(yearStripView, /2\/4|02-04|year\s*%\s*4/);
});

test("year strip consumes shared target-instant authority while seasonal epoch and projection stay independently typed", () => {
  assert.match(dayHourView, /publishSelectedTargetInstant\(instrument\.dataset, targetInstant\)/);
  assert.match(targetInstantAuthority, /selectedTargetInstantBasis/);
  assert.match(targetInstantAuthority, /selectedTargetInstantJulianDay/);
  assert.match(yearStripView, /readSelectedTargetInstant\(instrument\.dataset\)/);
  assert.match(yearStripView, /TARGET_INSTANT_BASIS/);
  assert.match(yearStripView, /compareTargetInstantToBoundary/);
  assert.doesNotMatch(yearStripView, /target-instant-controls|target-instant-time|target-instant-offset/);
  assert.match(seasonalBoundaryAuthority, /reviewed-production-direct-event/);
  assert.match(seasonalBoundaryAuthority, /source-covered-runtime-missing/);
  assert.match(seasonalCivilProjection, /status:"estimated"/);
  assert.match(seasonalCivilProjection, /deep-time-earth-rotation-uncertainty/);
  assert.doesNotMatch(yearStripView, /resolveLiChunYearSideFromTargetInstant/);
});

test("year strip keeps date-only and uncertain deep-time Li Chun membership fail closed", () => {
  assert.match(yearStripView, /selectedCivilLiChunRelation/);
  assert.match(yearStripView, /"boundary-day"/);
  assert.match(yearStripView, /"boundary-uncertain"/);
  assert.match(yearStripView, /strip\.dataset\.liChunInstantResolution/);
  assert.match(yearStripView, /target-instant-unbound/);
  assert.match(yearStripView, /earth-rotation-uncertain/);
  assert.match(yearStripView, /立春日需時刻判定/);
  assert.match(yearStripView, /立春區間內仍不確定/);
});

test("mobile year strip moves edge-adjacent base labels onto a second lane", () => {
  assert.match(yearStripView, /strip\.dataset\.baseEdge = state\.selectedPosition < 20 \? "start" : state\.selectedPosition > 80 \? "end" : "none"/);
  assert.match(css, /@media \(max-width:480px\)[\s\S]*?data-base-edge="start"[\s\S]*?research-year-track \{ height: 118px;/);
  assert.match(css, /data-base-edge="end"[\s\S]*?research-year-base > strong \{ top: 76px;/);
  assert.match(css, /data-base-edge="end"[\s\S]*?research-year-base > small \{ top: 92px;/);
  assert.match(css, /data-base-edge="start"[\s\S]*?research-year-base > strong,[\s\S]*?transform: none;/);
  assert.match(css, /data-base-edge="end"[\s\S]*?research-year-base > strong,[\s\S]*?transform: translateX\(-100%\)/);
});

test("60-day cycle remains supporting evidence behind one flat drilldown", () => {
  assert.match(view, /details\.id = "discrete-sexagenary-details"/);
  assert.match(view, /details\.dataset\.researchDrilldown = "discrete-sexagenary"/);
  assert.match(view, /六十干支圖/);
  assert.match(view, /10 天干 × 12 地支 → 60 配對/);
  assert.match(css, /\.research-sexagenary-drilldown > \.research-cycle\s*\{[\s\S]*?border-top:\s*0;/);
  assert.match(view,/transition\.insertAdjacentElement\("afterend", details\)/);
});

test("60-day wheel shortcut stays on one line and opens its disclosure", async () => {
  const layout=await readFile(new URL("../research-compact-surface.css",import.meta.url),"utf8");
  assert.match(recurrenceHtml,/class="research-cycle-inline-lookup"[^>]*href="#discrete-sexagenary-details">六十日轉盤 ↗<\/a>/);
  assert.match(layout,/\.research-cycle-inline-lookup\s*\{[\s\S]*?display:inline-flex;[\s\S]*?white-space:nowrap;/);
  assert.match(view,/target === details \|\| target === cycle/);
  assert.match(view,/lookup\.addEventListener\("click"[\s\S]*?details\.open = true/);
  assert.match(view,/history\.pushState\(null, "", nextHash\)/);
  assert.match(view,/details\.scrollIntoView\(\{ block:"start" \}\)/);
});

test("60-day wheel is the selector: direct sector click, pointer scrub, and keyboard arrows remain", () => {
  assert.doesNotMatch(recurrenceHtml, /research-cycle-prev|research-cycle-next|前一位|後一位/);
  assert.match(cycleView, /hit\.addEventListener\("click", \(\) => setActive\(index\)\)/);
  assert.match(cycleView, /export function cycleIndexFromLocalPoint/);
  assert.match(cycleView, /addEventListener\("pointerdown"/);
  assert.match(cycleView, /addEventListener\("pointermove"/);
  assert.match(cycleView, /setPointerCapture/);
  assert.match(cycleView, /event\.key === "ArrowLeft"/);
  assert.match(cycleView, /event\.key === "ArrowRight"/);
  assert.match(cycleCss, /#research-sexagenary-wheel\s*\{[\s\S]*?touch-action:\s*none;/);
});

test("reading order leads with paired names and phase wheel, then delta derivation before the 60-day source", () => {
  const comparisonStart = recurrenceHtml.indexOf('id="research-cycle-comparison"');
  const stateStart = recurrenceHtml.indexOf('class="recurrence-readout research-current-state"');
  const stripStart = recurrenceHtml.indexOf('id="research-year-strip"');
  const cycleStart = recurrenceHtml.indexOf('id="research-sexagenary-cycle"');
  const derivationStart = recurrenceHtml.indexOf('class="discrete-derivation"');
  assert.ok(stripStart >= 0 && comparisonStart > stripStart &&
    stateStart > comparisonStart && derivationStart > stateStart && cycleStart > derivationStart);
  assert.doesNotMatch(recurrenceHtml,/class="research-cycles-card/);
  assert.match(recurrenceHtml,/id="research-year-jiazi-ticks"/);
  assert.match(recurrenceView, /三個離散曆法相位全歸零；不是四柱重現必須等待的條件/);
  assert.match(recurrenceHtml, /年序 0 ＋ 日序 0 即成立；公曆 400 年相位不必歸零/);
  assert.ok(recurrenceHtml.includes('class="phase-gauge-caption"') && recurrenceHtml.includes("0 = 與基準同相位"));
});

test("research integration still loads the discrete presentation layer", () => {
  assert.match(host, /import "\.\/research-discrete-density-view\.js";/);
});
