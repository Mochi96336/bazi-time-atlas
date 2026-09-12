import test from "node:test";
import assert from "node:assert/strict";

import { localApparentSolarTime } from "../src/astronomy/apparent-solar-time.js";

function clock(fields) {
  return `${String(fields.year).padStart(4, "0")}-${String(fields.month).padStart(2, "0")}-${String(fields.day).padStart(2, "0")} ${String(fields.hour).padStart(2, "0")}:${String(fields.minute).padStart(2, "0")}:${String(fields.second).padStart(2, "0")}`;
}

test("NREL worked example fixes the EoT sign as apparent minus mean", () => {
  const result = localApparentSolarTime(
    { year: 2003, month: 10, day: 17, hour: 19, minute: 30, second: 30 },
    0,
    0,
    { deltaTSeconds: 67 }
  );

  assert.ok(Math.abs(result.longitudeCorrectionMinutes) < 1e-12);
  assert.ok(Math.abs(result.equationOfTimeMinutes - 14.641503) < 0.03);
  assert.ok(Math.abs(result.totalCorrectionMinutes - result.equationOfTimeMinutes) < 1e-12);
  assert.equal(result.apparentSolar.hour, 19);
  assert.equal(result.apparentSolar.minute, 45);
  assert.ok(result.apparentSolar.second >= 6 && result.apparentSolar.second <= 11);
});

test("longitude correction and Equation of Time remain separately auditable", () => {
  const result = localApparentSolarTime(
    { year: 2005, month: 12, day: 23, hour: 8, minute: 37, second: 0 },
    121.5,
    8
  );

  assert.ok(Math.abs(result.longitudeCorrectionMinutes - 6) < 1e-12);
  assert.ok(Math.abs(
    result.totalCorrectionMinutes
      - result.longitudeCorrectionMinutes
      - result.equationOfTimeMinutes
  ) < 1e-12);
  assert.equal(result.meanSolar.hour, 8);
  assert.equal(result.meanSolar.minute, 43);
  assert.equal(result.apparentSolar.hour, 8);
  assert.equal(result.apparentSolar.minute, 44);
});

test("same physical instant and longitude produce the same apparent solar clock across civil zones", () => {
  const taiwanClock = localApparentSolarTime(
    { year: 2005, month: 12, day: 23, hour: 8, minute: 37, second: 0 },
    121.5,
    8
  );
  const utcClock = localApparentSolarTime(
    { year: 2005, month: 12, day: 23, hour: 0, minute: 37, second: 0 },
    121.5,
    0
  );

  assert.equal(clock(taiwanClock.apparentSolar), clock(utcClock.apparentSolar));
  assert.ok(Math.abs(taiwanClock.equationOfTimeMinutes - utcClock.equationOfTimeMinutes) < 1e-9);
});

test("apparent solar composition preserves date rollover", () => {
  const result = localApparentSolarTime(
    { year: 2024, month: 12, day: 31, hour: 23, minute: 50, second: 0 },
    135,
    8
  );

  assert.equal(result.meanSolar.year, 2025);
  assert.equal(result.meanSolar.month, 1);
  assert.equal(result.meanSolar.day, 1);
  assert.equal(result.apparentSolar.year, 2025);
  assert.equal(result.apparentSolar.month, 1);
  assert.equal(result.apparentSolar.day, 1);
});
