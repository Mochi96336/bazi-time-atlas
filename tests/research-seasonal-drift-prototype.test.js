import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, view, data, css] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../src/research-seasonal-drift-prototype-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research/seasonal-drift-26026-research-data.js", import.meta.url), "utf8"),
  readFile(new URL("../research-seasonal-drift-prototype.css", import.meta.url), "utf8")
]);

test("Research 02 owns one linked 24k seasonal reader", () => {
  const astronomyStart = html.indexOf('id="research-astronomy"');
  const prototypeStart = html.indexOf('id="seasonal-drift-prototype"');
  const evidenceStart = html.indexOf('id="research-evidence"');
  assert.ok(astronomyStart >= 0 && prototypeStart > astronomyStart && evidenceStart > prototypeStart);
  assert.match(html, /data-seasonal-drift-mode="total"/);
  assert.match(html, /data-seasonal-drift-mode="split"/);
  assert.match(html, /id="seasonal-drift-curve"/);
  assert.match(html, /id="seasonal-drift-orbit"/);
  assert.match(html, /拖任一邊，另一邊會跟著走/);
});

test("prototype keeps common phase separate from ellipse shape", () => {
  assert.match(data, /commonPhaseDays:-12\.205535425/);
  assert.match(data, /peakToPeakDays:4\.022387715056539/);
  assert.match(view, /selectedShape\(\) \{\s*return selectedDrift\(\) - DATA\.commonPhaseDays/);
  assert.match(html, /右邊橢圓只解釋 shape；共同 phase 不用軌道形變硬塞/);
});

test("curve and orbit share one longitude cursor", () => {
  assert.match(view, /updateFromCurvePointer/);
  assert.match(view, /updateFromOrbitPointer/);
  assert.match(view, /setIndex\(indexForLongitude\(longitude\),"orbit"\)/);
  assert.match(view, /longitudeForIndex\(state\.index\)/);
  assert.match(view, /scrub\.addEventListener\("input"/);
});

test("orbit deformation is explicitly visual and reversible", () => {
  assert.match(data, /morphIntermediateYearsPhysical:false/);
  assert.match(view, /state\.exaggerate \? 10 : 1/);
  assert.match(html, /id="seasonal-drift-orbit-scale"/);
  assert.match(html, /形變 ×10/);
  assert.match(css, /#seasonal-drift-orbit-scale\[aria-pressed="false"\]/);
});
