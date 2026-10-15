import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SEASONAL_DRIFT_26026_RESEARCH as evidence } from "../src/research/seasonal-drift-26026-research-data.js";

const [html, view, data, css] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../src/research-seasonal-drift-prototype-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research/seasonal-drift-26026-research-data.js", import.meta.url), "utf8"),
  readFile(new URL("../research-seasonal-drift-prototype.css", import.meta.url), "utf8")
]);

test("Research 02 makes the fixed +24k case primary before dynamic astronomy tools", () => {
  const astronomyStart = html.indexOf('id="research-astronomy"');
  const prototypeStart = html.indexOf('id="seasonal-drift-prototype"');
  const dynamicPanelStart = html.indexOf('class="astronomy-panel"', astronomyStart);
  const evidenceStart = html.indexOf('id="research-evidence"');
  assert.ok(
    astronomyStart >= 0 &&
    prototypeStart > astronomyStart &&
    dynamicPanelStart > prototypeStart &&
    evidenceStart > dynamicPanelStart
  );
  assert.ok(html.includes("主案例 · +24,000 年離散閉合"));
  assert.match(html, /id="secondary-astronomy-tools"/);
  assert.match(html, /其他 Δ \/ 快速模型/);
  assert.match(html, /data-seasonal-drift-mode="total"/);
  assert.match(html, /data-seasonal-drift-mode="split"/);
});

test("secondary astronomy tools fold away only for the aligned +24k main case", () => {
  assert.match(view, /secondaryTools\.open = Boolean\(secondaryHashTarget\(\)\) \|\| !aligned/);
  assert.match(view, /secondaryTools\.dataset\.caseState/);
  assert.match(css, /\.secondary-astronomy-tools > summary/);
});

test("direct hashes reopen the folded secondary astronomy lane", () => {
  assert.match(view, /function secondaryHashTarget\(\)/);
  assert.match(view, /secondaryTools\.contains\(target\)/);
  assert.match(view, /secondaryTools\.open = Boolean\(secondaryHashTarget\(\)\) \|\| !aligned/);
  assert.match(view, /addEventListener\("hashchange"/);
  assert.match(view, /addEventListener\("load"/);
});

test("prototype only expands when the canonical Research state matches 2026 + 24k", () => {
  assert.match(html, /id="seasonal-drift-case-gate-title"/);
  assert.match(html, /id="seasonal-drift-use-case"/);
  assert.match(view, /baseYear === DATA\.baseYear && delta === 24000/);
  assert.match(view, /#discrete-derivation-steps \[data-delta-years="24000"\]/);
  assert.match(css, /data-case-aligned="false"[\s\S]*\.seasonal-drift-case-content\s*\{\s*display:none/);
});

test("prototype keeps mean drift separate from timing-equivalent orbit shape", () => {
  assert.match(data, /meanDriftDays:SUMMARY\.meanDriftDays/);
  assert.match(data, /peakToPeakDays:SUMMARY\.peakToPeakDays/);
  assert.match(view, /selectedShape\(\) \{\s*return selectedDrift\(\) - DATA\.meanDriftDays/);
  assert.match(html, /右側只畫 timing 反演的等效 shape/);
  assert.match(html, /全年平均位移硬畫成軌道變形/);
  assert.match(css, /data-mode="total"[\s\S]*\.seasonal-drift-orbit-panel\s*\{\s*display:none/);
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
  assert.match(html, /拖等效位置也能選黃經/);
  assert.doesNotMatch(html, /拖地球也能選位置/);
});

test("total view explicitly visualizes distance from zero before shape decomposition", () => {
  assert.match(view, /class:"seasonal-drift-gap-line"/);
  assert.match(view, /gapLabel\.textContent = humanDrift/);
  assert.match(html, /全年結果/);
  assert.match(html, /提前 10\.20–14\.22 天/);
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
