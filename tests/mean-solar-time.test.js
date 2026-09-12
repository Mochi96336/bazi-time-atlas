import test from "node:test";
import assert from "node:assert/strict";

import {
  longitudeCorrectionMinutes,
  localMeanSolarTime
} from "../src/astronomy/mean-solar-time.js";

function clock(result) {
  const t = result.meanSolar;
  return `${String(t.year).padStart(4, "0")}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")} ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}:${String(t.second).padStart(2, "0")}`;
}

test("zone-meridian longitude produces zero mean-solar correction", () => {
  assert.equal(longitudeCorrectionMinutes(120, 8), 0);
  assert.equal(longitudeCorrectionMinutes(-75, -5), 0);

  const result = localMeanSolarTime({ year: 2024, month: 6, day: 20, hour: 10, minute: 15, second: 30 }, 120, 8);
  assert.equal(clock(result), "2024-06-20 10:15:30");
});

test("east longitude advances and west longitude delays local mean solar time", () => {
  assert.ok(Math.abs(longitudeCorrectionMinutes(121.5, 8) - 6) < 1e-12);
  assert.ok(Math.abs(longitudeCorrectionMinutes(118, 8) + 8) < 1e-12);

  const east = localMeanSolarTime({ year: 2024, month: 6, day: 20, hour: 10, minute: 0, second: 0 }, 121.5, 8);
  const west = localMeanSolarTime({ year: 2024, month: 6, day: 20, hour: 10, minute: 0, second: 0 }, 118, 8);
  assert.equal(clock(east), "2024-06-20 10:06:00");
  assert.equal(clock(west), "2024-06-20 09:52:00");
});

test("effective UTC offset naturally includes daylight-saving or political clock shifts", () => {
  const result = localMeanSolarTime({ year: 2024, month: 7, day: 1, hour: 12, minute: 0, second: 0 }, -75, -4);
  assert.equal(longitudeCorrectionMinutes(-75, -4), -60);
  assert.equal(clock(result), "2024-07-01 11:00:00");
});

test("mean solar conversion preserves date rollover across the previous year", () => {
  const result = localMeanSolarTime({ year: 2024, month: 1, day: 1, hour: 0, minute: 10, second: 0 }, 105, 8);
  assert.equal(longitudeCorrectionMinutes(105, 8), -60);
  assert.equal(clock(result), "2023-12-31 23:10:00");
});

test("mean solar conversion can roll into the next civil day", () => {
  const result = localMeanSolarTime({ year: 2024, month: 12, day: 31, hour: 23, minute: 50, second: 0 }, 135, 8);
  assert.equal(longitudeCorrectionMinutes(135, 8), 60);
  assert.equal(clock(result), "2025-01-01 00:50:00");
});

test("longitude and UTC offset validation fail closed", () => {
  assert.throws(() => longitudeCorrectionMinutes(181, 8), /longitudeDegrees/);
  assert.throws(() => longitudeCorrectionMinutes(-181, 8), /longitudeDegrees/);
  assert.throws(() => longitudeCorrectionMinutes(120, 15), /utcOffsetHours/);
  assert.throws(() => localMeanSolarTime({ year: 2024, month: 1, day: 1, hour: 0 }, Number.NaN, 8), /longitudeDegrees/);
});
