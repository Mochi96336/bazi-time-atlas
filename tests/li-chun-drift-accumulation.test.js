import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_LI_CHUN_2026_TT_JD,
  gregorianDaysBetweenLiChunDates,
  liChunDriftAccumulation
} from "../src/research/li-chun-drift-accumulation.js";
import { SEASONAL_DRIFT_26026_RESEARCH } from "../src/research/seasonal-drift-26026-research-data.js";

test("Gregorian day count matches the 26026 timeline's own span", () => {
  assert.equal(gregorianDaysBetweenLiChunDates(2026, 26026), SEASONAL_DRIFT_26026_RESEARCH.gregorianDaySpanDays);
  assert.equal(gregorianDaysBetweenLiChunDates(2026, 2026), 0);
});

test("accumulation uses only the four source-backed epochs and grows toward the 02 verdict", () => {
  const points = liChunDriftAccumulation();
  assert.deepEqual(points.map(point => point.deltaYears), [0, 1980, 8000, 24000]);
  assert.equal(points[0].driftDays, 0);
  assert.ok(Math.abs(points[1].driftDays) < 1, "4006 stays within one day");
  assert.ok(points[2].driftDays < -1 && points[2].driftDays > -3, "10026 is a couple of days early");
  assert.ok(Math.abs(points[3].driftDays - -10.883188) < 1e-6, "26026 matches the 02 立春 verdict");
  assert.ok(points[3].driftDays < points[2].driftDays && points[2].driftDays < points[1].driftDays);
  assert.ok(BASE_LI_CHUN_2026_TT_JD > 2461075 && BASE_LI_CHUN_2026_TT_JD < 2461076);
});
