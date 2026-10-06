import test from "node:test";
import assert from "node:assert/strict";
import {
  BERGER_MODEL,
  bergerOrbitalParameters,
  normalizedSolarLongitudeOffsetDays,
  solarTermShapeResiduals
} from "../src/recurrence/berger-orbit.js";
import {
  resolveResearchSeasonalBoundary
} from "../src/recurrence/research-seasonal-boundary-resolution.js";

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

test("normalized solar-term shape uses Berger's apparent-Sun longitude convention", () => {
  const qingMing = normalizedSolarLongitudeOffsetDays(2026, 15);
  const liChun = normalizedSolarLongitudeOffsetDays(2026, 315);
  assert.ok(qingMing > 15 && qingMing < 16);
  assert.ok(liChun > 320 && liChun < 321);
});

test("1980-year local discrete recurrence is not an orbital-shape closure", () => {
  const residual = solarTermShapeResiduals(2026, 4006);
  assert.ok(residual.maxAbsHours > 20 && residual.maxAbsHours < 50);
  assert.ok(residual.minHours < 0);
  assert.ok(residual.maxHours > 0);
  assert.equal(residual.closed, false);
  console.log(
    `[berger-shape] 2026→4006 max=${residual.maxAbsHours.toFixed(9)} h `
    + `min=${residual.minHours.toFixed(9)} h maxSigned=${residual.maxHours.toFixed(9)} h`
  );
});

test("24000-year discrete closure still leaves a large solar-term shape residual", () => {
  const residual = solarTermShapeResiduals(2026, 26026);
  assert.ok(residual.maxAbsHours > 50);
  assert.equal(residual.closed, false);
  console.log(
    `[berger-shape] 2026→26026 max=${residual.maxAbsHours.toFixed(9)} h `
    + `min=${residual.minHours.toFixed(9)} h maxSigned=${residual.maxHours.toFixed(9)} h; `
    + residual.terms.map(term => `${term.name}=${term.residualHours.toFixed(9)}`).join(" ")
  );
});


test("Berger seasonal shape agrees with the 2026→4006 DE441 24-crossing shape after common phase cancels", () => {
  const baseEquinox = resolveResearchSeasonalBoundary({ year:2026, longitudeDegrees:0 });
  const targetEquinox = resolveResearchSeasonalBoundary({ year:4006, longitudeDegrees:0 });
  assert.equal(baseEquinox.epochStatus, "resolved");
  assert.equal(targetEquinox.epochStatus, "resolved");

  const errors = [];
  for (let longitudeDegrees = 0; longitudeDegrees < 360; longitudeDegrees += 15) {
    const base = resolveResearchSeasonalBoundary({ year:2026, longitudeDegrees });
    const target = resolveResearchSeasonalBoundary({ year:4006, longitudeDegrees });
    assert.equal(base.epochStatus, "resolved", `base ${longitudeDegrees}°`);
    assert.equal(target.epochStatus, "resolved", `target ${longitudeDegrees}°`);

    const observedShapeChangeHours = (
      (target.ttJulianDay - base.ttJulianDay)
      - (targetEquinox.ttJulianDay - baseEquinox.ttJulianDay)
    ) * 24;
    const bergerShapeChangeHours = (
      normalizedSolarLongitudeOffsetDays(4006, longitudeDegrees)
      - normalizedSolarLongitudeOffsetDays(2026, longitudeDegrees)
    ) * 24;
    errors.push(bergerShapeChangeHours - observedShapeChangeHours);
  }

  const maxAbsErrorHours = Math.max(...errors.map(Math.abs));
  const rmsErrorHours = Math.sqrt(
    errors.reduce((sum, value) => sum + value * value, 0) / errors.length
  );
  const spreadHours = Math.max(...errors) - Math.min(...errors);

  assert.ok(maxAbsErrorHours < 1, `max DE441 disagreement ${maxAbsErrorHours} h`);
  assert.ok(rmsErrorHours < 0.6, `RMS DE441 disagreement ${rmsErrorHours} h`);
  assert.ok(spreadHours < 1.5, `spread DE441 disagreement ${spreadHours} h`);

  console.log(
    `[berger-shape] DE441 2026→4006 maxError=${maxAbsErrorHours.toFixed(6)} h `
    + `rms=${rmsErrorHours.toFixed(6)} h spread=${spreadHours.toFixed(6)} h`
  );
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
