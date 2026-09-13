import test from "node:test";
import assert from "node:assert/strict";

import {
  CURSOR_ANGLE,
  FAN,
  GUIDE_RADII,
  RADII,
  RINGS,
  SEXAGENARY_RING_IDS,
  WHEEL_CENTER,
  assertWheelModel,
  ringModel
} from "../src/wheel/ring-model.js";
import {
  angleAt,
  annularSectorPath,
  fanSectorPath,
  normalizeDegrees,
  pointAt,
  shortestAngleDelta
} from "../src/wheel/polar-geometry.js";
import {
  DEFAULT_VIEWPORT,
  instrumentViewBox,
  viewBoxString
} from "../src/wheel/camera.js";
import {
  createRingState,
  detachRing,
  effectiveRotation,
  resetManualOffset,
  setManualOffset,
  setModelRotation,
  snappedOffset
} from "../src/wheel/ring-state.js";

test("five primary rings form one contiguous radial stack", () => {
  assert.equal(assertWheelModel(), true);
  assert.equal(RINGS.length, 5);
  assert.deepEqual(SEXAGENARY_RING_IDS, ["year", "month", "day"]);
  assert.deepEqual(GUIDE_RADII, [760, 834, 908, 982, 1072, 1182]);

  for (let i = 1; i < RINGS.length; i += 1) {
    assert.equal(RINGS[i].innerRadius, RINGS[i - 1].outerRadius);
  }
  assert.equal(RINGS[0].innerRadius, RADII.inner);
  assert.equal(RINGS.at(-1).outerRadius, RADII.zodiacOuter);
});

test("ring model already carries the future independent-drag contract", () => {
  for (const ring of RINGS) {
    assert.equal(ring.draggable, true, `${ring.id} should be draggable`);
    assert.equal(ring.defaultLinked, true, `${ring.id} should start linked to time`);
    assert.ok(ring.snapDegrees > 0, `${ring.id} needs a semantic snap interval`);
  }
  assert.equal(ringModel("year").snapDegrees, 6);
  assert.equal(ringModel("solar").snapDegrees, 15);
  assert.equal(ringModel("zodiac").snapDegrees, 30);
  assert.equal(ringModel("solar").phaseSource, "solar-longitude");
  assert.equal(ringModel("zodiac").phaseSource, "solar-longitude");
  assert.equal(ringModel("zodiac").linkedPhaseId, "solar");
});

test("linked and detached ring pose never mutates the model angle", () => {
  const state = createRingState("day");
  setModelRotation(state, 121.5);
  assert.equal(state.linked, true);
  assert.equal(effectiveRotation(state), 121.5);

  detachRing(state);
  setManualOffset(state, 17.25);
  assert.equal(state.modelRotation, 121.5);
  assert.equal(state.manualOffset, 17.25);
  assert.equal(state.linked, false);
  assert.equal(effectiveRotation(state), 138.75);

  resetManualOffset(state);
  assert.equal(state.modelRotation, 121.5);
  assert.equal(state.manualOffset, 0);
  assert.equal(state.linked, true);
  assert.equal(effectiveRotation(state), 121.5);

  assert.equal(snappedOffset("day", 17.2), 18);
  assert.equal(snappedOffset("solar", 22), 15);
  assert.equal(snappedOffset("zodiac", 22), 30);
});

test("polar geometry uses one SVG-world center and round-trips angles", () => {
  const angles = [-170, -90, -10, 0, 45, 179, 350];
  for (const angle of angles) {
    const point = pointAt(WHEEL_CENTER, 900, angle);
    const recovered = angleAt(WHEEL_CENTER, point);
    assert.ok(Math.abs(shortestAngleDelta(recovered, angle)) < 1e-10, `${angle}° round trip`);
  }
  assert.equal(normalizeDegrees(-10), 350);
  assert.equal(shortestAngleDelta(1, 359), 2);
  assert.equal(shortestAngleDelta(359, 1), -2);
});

test("paths are derived from the canonical center rather than CSS transforms", () => {
  const annulus = annularSectorPath(WHEEL_CENTER, RADII.inner, RADII.yearOuter, 0, 6);
  const fan = fanSectorPath(WHEEL_CENTER, RADII.zodiacOuter + 28, FAN.start, FAN.end);
  assert.match(annulus, /^M /);
  assert.match(annulus, /A 834 834/);
  assert.match(annulus, /A 760 760/);
  assert.match(fan, new RegExp(`^M ${WHEEL_CENTER.x.toFixed(3)} ${WHEEL_CENTER.y.toFixed(3)}`));
});

test("camera is a separate view over the world geometry", () => {
  const camera = instrumentViewBox({ center: WHEEL_CENTER, outerRadius: RADII.zodiacOuter });
  assert.deepEqual(camera, { x: 0, y: 58, width: 1200, height: 760 });
  assert.equal(viewBoxString(camera), "0.000 58.000 1200.000 760.000");
  assert.equal(DEFAULT_VIEWPORT.width, 1200);
  assert.equal(CURSOR_ANGLE, -90);
});
