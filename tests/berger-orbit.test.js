import test from "node:test";
import assert from "node:assert/strict";
import {
  BERGER_MODEL,
  bergerOrbitalParameters,
  normalizedSolarLongitudeOffsetDays,
  solarTermShapeResiduals
} from "../src/recurrence/berger-orbit.js";

function close(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

test("Berger 1978 parameters match the reference vectors used by the atlas", () => {
  const now = bergerOrbitalParameters(2026);
  const future = bergerOrbitalParameters(26026);

  close(now.eccentricity, 0.0166930945, 1e-10, "2026 eccentricity");
  close(now.perihelionLongitudeDegrees, 283.3409369, 1e-7, "2026 perihelion longitude");
  close(future.eccentricity, 0.0034047372, 1e-10, "26026 eccentricity");
  close(future.perihelionLongitudeDegrees, 16.9110746, 1e-7, "26026 perihelion longitude");
});

test("normalized solar-term shape is anchored at spring equinox rather than civil dates", () => {
  const qingMing = normalizedSolarLongitudeOffsetDays(2026, 15);
  const liChun = normalizedSolarLongitudeOffsetDays(2026, 315);
  assert.ok(qingMing > 15 && qingMing < 16);
  assert.ok(liChun > 318 && liChun < 319);
});

test("1980-year local discrete recurrence is not an orbital-shape closure", () => {
  const residual = solarTermShapeResiduals(2026, 4006);
  close(residual.maxAbsHours, 41.35524915, 1e-6, "1980-year max residual hours");
  assert.ok(residual.minHours < 0);
  assert.ok(residual.maxHours > 0);
  assert.equal(residual.closed, false);
});

test("24000-year discrete closure still leaves a large solar-term shape residual", () => {
  const residual = solarTermShapeResiduals(2026, 26026);
  close(residual.maxAbsHours, 95.10937540, 1e-6, "24000-year max residual hours");
  close(residual.terms.find(term => term.name === "寒露").residualHours, 95.10937540, 1e-6, "寒露 residual");
  close(residual.terms.find(term => term.name === "清明").residualHours, 1.36346778, 1e-6, "清明 residual");
  assert.equal(residual.closed, false);
});

test("same-year comparison is the only exact shape identity in this comparator", () => {
  const residual = solarTermShapeResiduals(2026, 2026);
  assert.equal(residual.maxAbsHours, 0);
  assert.equal(residual.rmsHours, 0);
  assert.equal(residual.closed, true);
});

test("model refuses years outside its declared precision range", () => {
  assert.equal(BERGER_MODEL.validityYearsFromEpoch, 1_000_000);
  assert.throws(() => bergerOrbitalParameters(1_002_000), /outside Berger 1978/);
});
