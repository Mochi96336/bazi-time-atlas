import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  assert.match(html, /主案例 · 固定 \\+24,000 年 · 不受上方 Δ 影響/);
  assert.match(html, /其他 Δ · 快速形狀模型/);
  assert.match(html, /data-seasonal-drift-mode="total"/);
  assert.match(html, /data-seasonal-drift-mode="split"/);
});

test("prototype keeps common phase separate from timing-equivalent orbit shape", () => {
  assert.match(data, /commonPhaseDays:-12\.205535425/);
  assert.match(data, /peakToPeakDays:4\.022387715056539/);
  assert.match(view, /selectedShape\(\) \{\s*return selectedDrift\(\) - DATA\.commonPhaseDays/);
  assert.match(html, /右側只畫 timing 反演的等效 shape/);
  assert.match(html, /共同位移硬畫成軌道變形/);
  assert.match(css, /data-mode="total"[\s\S]*#seasonal-drift-orbit[\s\S]*opacity:\.2/);
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
