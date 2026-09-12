import test from "node:test";
import assert from "node:assert/strict";
import { JulianDay, SolarTime } from "../vendor/tyme4ts-1.5.2.mjs";
import {
  equationOfTime,
  meanObliquityDegrees,
  sunMeanLongitudeDegrees
} from "../src/astronomy/equation-of-time.js";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function wrapMinutes(minutes) {
  let value = minutes;
  while (value > 20) value -= 1440;
  while (value < -20) value += 1440;
  return value;
}

/**
 * Independent USNO "Computing Approximate Solar Coordinates" path.
 * Accuracy is intentionally looser than the production engine; it is used as
 * a differential sanity check across the year, not as the implementation.
 */
function usnoApproxEquationOfTime(input) {
  const time = SolarTime.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour,
    input.minute ?? 0,
    input.second ?? 0
  );
  const d = time.getJulianDay().getDay() - JulianDay.J2000;
  const g = normalizeDegrees(357.529 + 0.98560028 * d) * DEG_TO_RAD;
  const qDegrees = normalizeDegrees(280.459 + 0.98564736 * d);
  const longitude = normalizeDegrees(
    qDegrees + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)
  ) * DEG_TO_RAD;
  const obliquity = (23.439 - 0.00000036 * d) * DEG_TO_RAD;
  const rightAscension = normalizeDegrees(
    Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) * RAD_TO_DEG
  );
  return wrapMinutes((qDegrees - rightAscension) * 4);
}

test("SPA mean-Sun and obliquity polynomials reproduce reference constants", () => {
  assert.equal(sunMeanLongitudeDegrees(0), 280.4664567);
  assert.ok(Math.abs(meanObliquityDegrees(0) - 84381.448 / 3600) < 1e-12);
});

test("NREL SPA Appendix A.5 worked example stays within seconds", () => {
  // 2003-10-17 12:30:30 MST in the published SPA example = 19:30:30 UTC.
  // The reference explicitly uses ΔT = 67 s and E = 14.641503 min.
  const result = equationOfTime(
    { year: 2003, month: 10, day: 17, hour: 19, minute: 30, second: 30 },
    0,
    { deltaTSeconds: 67 }
  );

  const error = Math.abs(result.minutes - 14.641503);
  assert.ok(
    error < 0.03,
    `NREL SPA A.5 expected 14.641503 min, got ${result.minutes} min (error ${error} min)`
  );
  assert.ok(
    Math.abs(result.meanLongitudeDegrees - 205.8971722516) < 1e-5,
    `reference mean Sun longitude drifted: ${result.meanLongitudeDegrees}`
  );
});

test("production EoT tracks the independent USNO approximate solar-coordinate method", () => {
  const inputs = [
    { year: 2005, month: 2, day: 11, hour: 12, minute: 0, second: 0 },
    { year: 2005, month: 5, day: 14, hour: 12, minute: 0, second: 0 },
    { year: 2005, month: 7, day: 26, hour: 12, minute: 0, second: 0 },
    { year: 2005, month: 11, day: 3, hour: 12, minute: 0, second: 0 },
    { year: 2024, month: 3, day: 20, hour: 12, minute: 0, second: 0 },
    { year: 2024, month: 6, day: 20, hour: 12, minute: 0, second: 0 },
    { year: 2024, month: 9, day: 22, hour: 12, minute: 0, second: 0 },
    { year: 2024, month: 12, day: 21, hour: 12, minute: 0, second: 0 }
  ];

  for (const input of inputs) {
    const actual = equationOfTime(input, 0).minutes;
    const approximate = usnoApproxEquationOfTime(input);
    const error = Math.abs(actual - approximate);
    assert.ok(
      error < 0.15,
      `${input.year}-${input.month}-${input.day}: production ${actual}, USNO approx ${approximate}, error ${error} min`
    );
  }
});

test("Equation of Time depends on the instant, not the civil representation", () => {
  const taiwan = equationOfTime(
    { year: 2005, month: 12, day: 23, hour: 8, minute: 37, second: 0 },
    8
  );
  const utc = equationOfTime(
    { year: 2005, month: 12, day: 23, hour: 0, minute: 37, second: 0 },
    0
  );
  assert.ok(Math.abs(taiwan.minutes - utc.minutes) < 1e-9);
  assert.ok(Math.abs(taiwan.utcJulianDay - utc.utcJulianDay) < 1e-12);
});

test("2024 Equation of Time remains inside the physical daily envelope", () => {
  for (let ms = Date.UTC(2024, 0, 1, 12); ms < Date.UTC(2025, 0, 1, 12); ms += 5 * 86400000) {
    const date = new Date(ms);
    const result = equationOfTime({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 12,
      minute: 0,
      second: 0
    }, 0);
    assert.ok(Number.isFinite(result.minutes));
    assert.ok(
      Math.abs(result.minutes) < 20,
      `${date.toISOString().slice(0, 10)} produced ${result.minutes} min`
    );
  }
});

test("Equation of Time requires a valid UTC offset and ΔT override", () => {
  const input = { year: 2024, month: 6, day: 20, hour: 12, minute: 0, second: 0 };
  assert.throws(() => equationOfTime(input, 15), /utcOffsetHours/);
  assert.throws(() => equationOfTime(input, Number.NaN), /utcOffsetHours/);
  assert.throws(() => equationOfTime(input, 0, { deltaTSeconds: Number.NaN }), /deltaTSeconds/);
});
