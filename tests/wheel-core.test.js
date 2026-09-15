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
  cameraModeForWidth,
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

test("five primary rings encode increasing temporal scale without freezing presentation thickness", () => {
  assert.equal(assertWheelModel(), true);
  assert.deepEqual(RINGS.map(ring => ring.id), ["hour", "day", "solar", "month", "year"]);
  assert.equal(RINGS.length, 5);
  assert.deepEqual(SEXAGENARY_RING_IDS, ["hour", "day", "month", "year"]);
  assert.deepEqual(GUIDE_RADII, [
    RADII.inner,
    RADII.hourOuter,
    RADII.dayOuter,
    RADII.solarTermOuter,
    RADII.solarOuter,
    RADII.monthOuter,
    RADII.yearOuter
  ]);

  for (let i = 1; i < RINGS.length; i += 1) {
    assert.equal(RINGS[i].innerRadius, RINGS[i - 1].outerRadius);
    assert.ok(RINGS[i].innerRadius > RINGS[i - 1].innerRadius, `${RINGS[i].id} should remain outside ${RINGS[i - 1].id}`);
  }
  assert.equal(RINGS[0].innerRadius, RADII.inner);
  assert.equal(RINGS.at(-1).outerRadius, RADII.outer);

  // Radial position carries temporal scale. Thickness is intentionally a visual
  // composition parameter and may change independently of cycle duration.
  const thicknesses = RINGS.map(ring => ring.outerRadius - ring.innerRadius);
  thicknesses.forEach((thickness, index) => {
    assert.ok(thickness > 0, `${RINGS[index].id} needs positive visual thickness`);
  });

  assert.equal(ringModel("hour").cycleScale, "~5 days");
  assert.equal(ringModel("day").cycleScale, "60 days");
  assert.equal(ringModel("solar").cycleScale, "1 year");
  assert.equal(ringModel("month").cycleScale, "~5 years");
  assert.equal(ringModel("year").cycleScale, "60 years");

  const zodiac = ringModel("zodiac");
  assert.equal(zodiac.phaseKind, "derived");
  assert.equal(zodiac.innerRadius, RADII.solarTermOuter);
  assert.equal(zodiac.outerRadius, RADII.solarOuter);
  assert.ok(zodiac.innerRadius > ringModel("solar").innerRadius);
  assert.equal(zodiac.outerRadius, ringModel("solar").outerRadius);
  assert.equal(zodiac.linkedPhaseId, "solar");
});

test("five primary rings carry drag contracts while zodiac remains derived metadata", () => {
  for (const ring of RINGS) {
    assert.equal(ring.draggable, true, `${ring.id} should be draggable`);
    assert.equal(ring.defaultLinked, true, `${ring.id} should start linked to time`);
    assert.ok(ring.snapDegrees > 0, `${ring.id} needs a semantic snap interval`);
  }
  assert.equal(ringModel("hour").snapDegrees, 6);
  assert.equal(ringModel("hour").phaseSource, "hour-pillar");
  assert.equal(ringModel("year").snapDegrees, 6);
  assert.equal(ringModel("solar").snapDegrees, 15);
  assert.equal(ringModel("solar").phaseSource, "solar-longitude");
  assert.equal(ringModel("zodiac").snapDegrees, 30);
  assert.equal(ringModel("zodiac").phaseSource, "solar-longitude");
  assert.equal(ringModel("zodiac").linkedPhaseId, "solar");
  assert.equal(ringModel("zodiac").draggable, undefined);
});

test("radial hit testing selects primary rings and never exposes zodiac as a separate target", () => {
  for (const ring of RINGS) {
    const radius = (ring.innerRadius + ring.outerRadius) / 2;
    const point = pointAt(WHEEL_CENTER, radius, -90);
    assert.equal(ringAtWorldPoint(point)?.id, ring.id);
  }
  const zodiacRadius = (ringModel("zodiac").innerRadius + ringModel("zodiac").outerRadius) / 2;
  assert.equal(ringAtWorldPoint(pointAt(WHEEL_CENTER, zodiacRadius, -90))?.id, "solar");
  assert.equal(ringAtWorldPoint(pointAt(WHEEL_CENTER, RADII.inner - 5, -90)), null);
  assert.equal(ringAtWorldPoint(pointAt(WHEEL_CENTER, RADII.outer + 5, -90)), null);
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

test("paths are derived from canonical geometry rather than CSS transforms", () => {
  const hourAnnulus = annularSectorPath(WHEEL_CENTER, RADII.inner, RADII.hourOuter, 0, 6);
  const fan = fanSectorPath(WHEEL_CENTER, RADII.outer + 28, FAN.start, FAN.end);
  assert.match(hourAnnulus, /^M /);
  assert.match(hourAnnulus, new RegExp(`A ${RADII.hourOuter} ${RADII.hourOuter}`));
  assert.match(hourAnnulus, new RegExp(`A ${RADII.inner} ${RADII.inner}`));
  assert.match(fan, new RegExp(`^M ${WHEEL_CENTER.x.toFixed(3)} ${WHEEL_CENTER.y.toFixed(3)}`));
});

function assertValidCamera(camera, expectedMode) {
  assert.equal(camera.mode, expectedMode);
  assert.ok(Number.isFinite(camera.zoom) && camera.zoom > 0);
  assert.ok(Number.isFinite(camera.topMargin));
  for (const key of ["x", "y", "width", "height"]) {
    assert.ok(Number.isFinite(camera.viewBox[key]), `${expectedMode} viewBox.${key} should be finite`);
  }
  assert.ok(camera.viewBox.width > 0, `${expectedMode} camera width should be positive`);
  assert.ok(camera.viewBox.height > 0, `${expectedMode} camera height should be positive`);
  assert.match(viewBoxString(camera.viewBox), /^-?\d+\.\d{3} -?\d+\.\d{3} \d+\.\d{3} \d+\.\d{3}$/);
}

test("responsive camera chooses a valid composition by breakpoint without freezing aesthetic framing", () => {
  assert.equal(cameraModeForWidth(1440), "desktop");
  assert.equal(cameraModeForWidth(820), "compact");
  assert.equal(cameraModeForWidth(481), "compact");
  assert.equal(cameraModeForWidth(480), "mobile");
  assert.equal(cameraModeForWidth(390), "mobile");

  const desktop = responsiveInstrumentCamera({ center: WHEEL_CENTER, outerRadius: RADII.outer, viewportWidth: 1440 });
  const compact = responsiveInstrumentCamera({ center: WHEEL_CENTER, outerRadius: RADII.outer, viewportWidth: 700 });
  const mobile = responsiveInstrumentCamera({ center: WHEEL_CENTER, outerRadius: RADII.outer, viewportWidth: 390 });

  assertValidCamera(desktop, "desktop");
  assertValidCamera(compact, "compact");
  assertValidCamera(mobile, "mobile");

  // Responsive framing is intentionally presentation-owned. The semantic
  // contract is a valid camera over the same world geometry, not a frozen
  // x/y/width/height tuple from the pre-reset composition.
  assert.equal(CURSOR_ANGLE, -90);
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
