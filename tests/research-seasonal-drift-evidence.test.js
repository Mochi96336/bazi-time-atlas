import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SEASONAL_DRIFT_26026_RESEARCH as evidence } from "../src/research/seasonal-drift-26026-research-data.js";

const [html, view, data, css] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../src/research-seasonal-drift-evidence-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research/seasonal-drift-26026-research-data.js", import.meta.url), "utf8"),
  readFile(new URL("../research-seasonal-drift-evidence.css", import.meta.url), "utf8")
]);

test("Research 02 keeps the fixed +24k story visible before the delta sandbox", () => {
  const astronomyStart = html.indexOf('id="research-astronomy"');
  const seasonalEvidenceStart = html.indexOf('id="seasonal-drift-evidence"');
  const dynamicPanelStart = html.indexOf('class="astronomy-panel"', astronomyStart);
  const researchEvidenceStart = html.indexOf('id="research-evidence"');
  assert.ok(
    astronomyStart >= 0 &&
    seasonalEvidenceStart > astronomyStart &&
    dynamicPanelStart > seasonalEvidenceStart &&
    researchEvidenceStart > dynamicPanelStart
  );
  assert.match(html, /主線案例 · 固定 2026 → 26026/);
  assert.match(html, /上面的 Δ 可以自由探索；以下回到 01 找出的 24,000 年候選/);
  assert.doesNotMatch(html, /seasonal-drift-case-gate|seasonal-drift-use-case|data-case-aligned/);
  assert.doesNotMatch(css, /seasonal-drift-case-gate|data-case-aligned/);
  assert.doesNotMatch(view, /syncCaseAlignment|caseButton|caseGateTitle|caseGateCopy/);
});

test("02 explicitly bridges from the free delta explorer back to the fixed +24k argument", () => {
  assert.match(html, /上面的 Δ 可以自由探索；以下回到 01 找出的 24,000 年候選/);
  assert.match(html, /固定比較 2026 → 26026/);
});

test("other-delta astronomy is a closed sandbox, not the owner of the main story", () => {
  assert.match(html, /<details id="secondary-astronomy-tools" class="secondary-astronomy-tools">/);
  assert.doesNotMatch(html, /<details id="secondary-astronomy-tools" class="secondary-astronomy-tools" open>/);
  assert.match(view, /探索工具 · 目前 Δ =/);
  assert.match(view, /不影響上方固定 24,000 年主線/);
  assert.doesNotMatch(view, /secondaryTools\.open = Boolean\(secondaryHashTarget\(\)\) \|\| !aligned/);
  assert.match(css, /\.secondary-astronomy-tools > summary/);
});

test("direct hashes can still reopen the folded delta sandbox", () => {
  assert.match(view, /function secondaryHashTarget\(\)/);
  assert.match(view, /secondaryTools\.contains\(target\)/);
  assert.match(view, /secondaryTools\.open = true/);
  assert.match(view, /addEventListener\("hashchange"/);
  assert.match(view, /addEventListener\("load"/);
});

test("seasonal evidence keeps mean drift separate from timing-equivalent orbit shape", () => {
  assert.match(data, /meanDriftDays:SUMMARY\.meanDriftDays/);
  assert.match(data, /peakToPeakDays:SUMMARY\.peakToPeakDays/);
  assert.match(view, /selectedShape\(\) \{\s*return selectedDrift\(\) - DATA\.meanDriftDays/);
  assert.match(html, /右側橢圓只畫 timing 反演的等效 shape/);
  assert.match(html, /共同時間位移硬畫成軌道變形/);
  assert.doesNotMatch(css, /data-mode="total"[\s\S]*\.seasonal-drift-orbit-panel\s*\{\s*display:none/);
  assert.match(css, /\.seasonal-orbit-bazi-boundary/);
  assert.match(css, /\.seasonal-orbit-bazi-month-arc/);
});

test("equivalent orbit converts apparent solar longitude to heliocentric Earth direction", () => {
  assert.match(view, /heliocentricEarthAngleDegrees/);
  assert.match(view, /solarLongitudeDegrees \+ 180/);
  assert.match(view, /solarLongitudeFromHeliocentricAngleDegrees/);
  assert.match(html, /太陽視黃經 \+180°/);
});

test("total view does not reveal the mean-drift decomposition before split mode", () => {
  assert.doesNotMatch(view, /seasonal-drift-phase-line/);
  assert.match(html, /全年平均位移/);
});

test("curve and orbit share one longitude cursor without calling it a physical Earth position", () => {
  assert.match(view, /updateFromCurvePointer/);
  assert.match(view, /updateFromOrbitPointer/);
  assert.match(view, /setIndex\(indexForLongitude\(longitude\),"orbit"\)/);
  assert.match(view, /longitudeForIndex\(state\.index\)/);
  assert.match(view, /scrub\.addEventListener\("input"/);
  assert.match(html, /拖俯視圖選時間，上方干支同步更新/);
  assert.match(view, /drawBaziBoundaries/);
  assert.match(view, /BAZI_JIE_BOUNDARIES/);
  assert.doesNotMatch(html, /拖地球也能選位置/);
});

test("total view explicitly visualizes distance from zero before shape decomposition", () => {
  assert.match(view, /class:"seasonal-drift-gap-line"/);
  assert.match(view, /gapLabel\.textContent = humanDrift/);
  assert.match(html, /八字節界/);
  assert.match(html, /12 \/ 12/);
  assert.match(html, /提前 10\.235–14\.177 天/);
  assert.match(css, /\.seasonal-drift-gap-line/);
});

test("orbit deformation is explicitly visual and reversible", () => {
  assert.match(data, /morphIntermediateYearsPhysical:false/);
  assert.match(view, /state\.exaggerate \? 10 : 1/);
  assert.match(html, /id="seasonal-drift-orbit-scale"/);
  assert.match(html, /示意放大 ×10/);
  assert.match(css, /#seasonal-drift-orbit-scale\[aria-pressed="false"\]/);
});

test("pinned seasonal evidence derives summary metrics from one drift array and carries provenance", () => {
  const mean=evidence.driftDays.reduce((sum,value)=>sum+value,0)/evidence.driftDays.length;
  const min=Math.min(...evidence.driftDays);
  const max=Math.max(...evidence.driftDays);
  assert.equal(evidence.driftDays.length,360);
  assert.ok(Math.abs(evidence.meanDriftDays-mean)<1e-12);
  assert.equal(evidence.minDriftDays,min);
  assert.equal(evidence.maxDriftDays,max);
  assert.ok(Math.abs(evidence.peakToPeakDays-(max-min))<1e-12);
  assert.equal(evidence.provenance.timeline.pullRequest,572);
  assert.equal(evidence.provenance.timeline.artifactDigest,"sha256:285e3cc1edb09f9bc07268a149cdfa137f41a56b0525229f759daba31c50ef3d");
  assert.equal(evidence.provenance.inverseEllipse.pullRequest,574);
});

test("Research 02 stays framed as a BaZi boundary question", () => {
  assert.match(html, /八字的節界回來了嗎？/);
  assert.match(html, /八字年柱在立春切換，月柱在十二個「節」切換/);
  assert.match(html, /12 個「節」界 × 同一太陽黃經/);
  assert.match(html, /立春同時也是年柱切換界/);
});

test("curve and orbit expose the same canonical Jie structure", () => {
  assert.match(view, /BAZI_JIE_BOUNDARIES\.forEach\(boundary =>/);
  assert.match(view, /seasonal-drift-jie-guide/);
  assert.match(view, /seasonal-drift-jie-dot/);
  assert.match(view, /root\.dataset\.baziMonthBranch = month\.branch/);
  assert.match(css, /\.seasonal-drift-jie-guide/);
  assert.match(css, /\.seasonal-drift-jie-dot/);
});
