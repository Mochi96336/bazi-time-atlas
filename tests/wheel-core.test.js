import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  CAMERA_ZOOM,
  DEFAULT_VIEWPORT,
  cameraModeForWidth,
  horizontallyZoomedViewBox,
  instrumentViewBox,
  responsiveInstrumentCamera,
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
import { ringAtWorldPoint } from "../src/wheel/ring-drag-controller.js";

const atlasCss = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
const boundaryCss = readFileSync(new URL("../kinetic-boundaries.css", import.meta.url), "utf8");

test("six primary rings form one contiguous radial stack without moving the established outer five", () => {
  assert.equal(assertWheelModel(), true);
  assert.equal(RINGS.length, 6);
  assert.deepEqual(SEXAGENARY_RING_IDS, ["hour", "year", "month", "day"]);
  assert.deepEqual(GUIDE_RADII, [686, 760, 834, 908, 982, 1072, 1182]);

  for (let i = 1; i < RINGS.length; i += 1) {
    assert.equal(RINGS[i].innerRadius, RINGS[i - 1].outerRadius);
  }
  assert.equal(RINGS[0].innerRadius, RADII.inner);
  assert.equal(RINGS.at(-1).outerRadius, RADII.zodiacOuter);

  assert.equal(RADII.hourOuter, 760, "hour ring should grow inward from the former envelope");
  assert.equal(ringModel("year").innerRadius, 760, "existing year ring must stay at its previous radius");
  assert.equal(RADII.yearOuter, 834);
  assert.equal(RADII.monthOuter, 908);
  assert.equal(RADII.dayOuter, 982);
  assert.equal(RADII.solarOuter, 1072);
  assert.equal(RADII.zodiacOuter, 1182);
});

test("ring model carries linked/free drag contracts for all six layers", () => {
  for (const ring of RINGS) {
    assert.equal(ring.draggable, true, `${ring.id} should be draggable`);
    assert.equal(ring.defaultLinked, true, `${ring.id} should start linked to time`);
    assert.ok(ring.snapDegrees > 0, `${ring.id} needs a semantic snap interval`);
  }
  assert.equal(ringModel("hour").snapDegrees, 6);
  assert.equal(ringModel("hour").phaseSource, "hour-pillar");
  assert.equal(ringModel("year").snapDegrees, 6);
  assert.equal(ringModel("solar").snapDegrees, 15);
  assert.equal(ringModel("zodiac").snapDegrees, 30);
  assert.equal(ringModel("solar").phaseSource, "solar-longitude");
  assert.equal(ringModel("zodiac").phaseSource, "solar-longitude");
  assert.equal(ringModel("zodiac").linkedPhaseId, "solar");
});

test("radial hit testing selects every ring without DOM bounding boxes", () => {
  for (const ring of RINGS) {
    const radius = (ring.innerRadius + ring.outerRadius) / 2;
    const point = pointAt(WHEEL_CENTER, radius, -90);
    assert.equal(ringAtWorldPoint(point)?.id, ring.id);
  }
  assert.equal(ringAtWorldPoint(pointAt(WHEEL_CENTER, RADII.inner - 5, -90)), null);
  assert.equal(ringAtWorldPoint(pointAt(WHEEL_CENTER, RADII.zodiacOuter + 5, -90)), null);
});

test("linked and detached ring pose never mutates the model angle", () => {
  const state = createRingState("hour");
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

  assert.equal(snappedOffset("hour", 17.2), 18);
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
  const hourAnnulus = annularSectorPath(WHEEL_CENTER, RADII.inner, RADII.hourOuter, 0, 6);
  const fan = fanSectorPath(WHEEL_CENTER, RADII.zodiacOuter + 28, FAN.start, FAN.end);
  assert.match(hourAnnulus, /^M /);
  assert.match(hourAnnulus, /A 760 760/);
  assert.match(hourAnnulus, /A 686 686/);
  assert.match(fan, new RegExp(`^M ${WHEEL_CENTER.x.toFixed(3)} ${WHEEL_CENTER.y.toFixed(3)}`));
});

test("camera is a separate view over the world geometry", () => {
  const camera = instrumentViewBox({ center: WHEEL_CENTER, outerRadius: RADII.zodiacOuter });
  assert.deepEqual(camera, { x: 0, y: 58, width: 1200, height: 760 });
  assert.equal(viewBoxString(camera), "0.000 58.000 1200.000 760.000");
  assert.equal(DEFAULT_VIEWPORT.width, 1200);
  assert.equal(CURSOR_ANGLE, -90);
});

test("responsive camera replaces the old CSS fake zoom with centered viewBox crops", () => {
  assert.equal(cameraModeForWidth(1440), "desktop");
  assert.equal(cameraModeForWidth(820), "compact");
  assert.equal(cameraModeForWidth(481), "compact");
  assert.equal(cameraModeForWidth(480), "mobile");
  assert.equal(cameraModeForWidth(390), "mobile");

  const desktop = responsiveInstrumentCamera({ center: WHEEL_CENTER, outerRadius: RADII.zodiacOuter, viewportWidth: 1440 });
  assert.equal(desktop.mode, "desktop");
  assert.equal(desktop.zoom, 1);
  assert.deepEqual(desktop.viewBox, { x: 0, y: 58, width: 1200, height: 760 });

  const compact = responsiveInstrumentCamera({ center: WHEEL_CENTER, outerRadius: RADII.zodiacOuter, viewportWidth: 700 });
  assert.equal(compact.mode, "compact");
  assert.equal(compact.zoom, CAMERA_ZOOM.compact);
  assert.ok(Math.abs(compact.viewBox.x - 145.4545454545) < 1e-9);
  assert.ok(Math.abs(compact.viewBox.width - 909.0909090909) < 1e-9);
  assert.equal(compact.viewBox.y, 58);
  assert.equal(compact.viewBox.height, 760);

  const mobile = responsiveInstrumentCamera({ center: WHEEL_CENTER, outerRadius: RADII.zodiacOuter, viewportWidth: 390 });
  assert.equal(mobile.mode, "mobile");
  assert.equal(mobile.zoom, CAMERA_ZOOM.mobile);
  assert.ok(Math.abs(mobile.viewBox.x - 339.1304347826) < 1e-9);
  assert.ok(Math.abs(mobile.viewBox.width - 521.7391304348) < 1e-9);
  assert.equal(mobile.viewBox.y, 58);
  assert.equal(mobile.viewBox.height, 760);

  const doubled = horizontallyZoomedViewBox({ x: 10, y: 20, width: 1000, height: 500 }, 2);
  assert.deepEqual(doubled, { x: 260, y: 20, width: 500, height: 500 });
});

test("CSS owns layout only; ring pivots and wheel zoom belong to wheel-core", () => {
  const combined = `${atlasCss}\n${boundaryCss}`;
  assert.doesNotMatch(combined, /\.ring-track\s*\{[^}]*transform(?:-origin)?\s*:/s);

  const wheelBlocks = [...combined.matchAll(/#kinetic-wheel\s*\{([^}]*)\}/g)].map(match => match[1]);
  assert.equal(wheelBlocks.length, 1, "#kinetic-wheel should have one layout-only CSS rule");
  assert.match(wheelBlocks[0], /width:\s*100%/);
  assert.match(wheelBlocks[0], /height:\s*100%/);
  assert.doesNotMatch(wheelBlocks[0], /(?:left|right|top|bottom|transform|aspect-ratio)\s*:/);
});
