import test from "node:test";
import assert from "node:assert/strict";

import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import { compareDayHourTimeBases } from "../src/calendar/time-basis-sensitivity.js";
import {
  atlasSolarTimeAnalysisState,
  normalizeAtlasLongitude
} from "../src/atlas-solar-time-analysis-model.js";
import { civilFieldsFromInstant } from "../src/wheel/atlas-display-model.js";

const SELECTED_MS = Date.UTC(2005, 11, 23, 14, 55, 0);
const TIME_CONTEXT = Object.freeze({
  utcOffsetHours:8,
  dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
});

test("Atlas solar-time analysis stays unbound until longitude is explicit", () => {
  const state = atlasSolarTimeAnalysisState({
    selectedMs:SELECTED_MS,
    timeContext:TIME_CONTEXT
  });

  assert.equal(state.bound, false);
  assert.equal(state.longitudeDegrees, null);
  assert.equal(state.selectedMs, SELECTED_MS);
  assert.equal(state.timeContext.utcOffsetHours, 8);
  assert.equal(state.timeContext.dayBoundary, DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY);
  assert.equal("rows" in state, false);
});

test("Atlas solar-time analysis reproduces the canonical sensitivity calculation without moving Selected Instant", () => {
  const civilInput = civilFieldsFromInstant(SELECTED_MS, TIME_CONTEXT);
  const canonical = compareDayHourTimeBases(civilInput, {
    longitudeDegrees:121.5,
    utcOffsetHours:TIME_CONTEXT.utcOffsetHours,
    dayBoundary:TIME_CONTEXT.dayBoundary
  });
  const state = atlasSolarTimeAnalysisState({
    selectedMs:SELECTED_MS,
    timeContext:TIME_CONTEXT,
    longitudeDegrees:121.5
  });

  assert.equal(state.bound, true);
  assert.equal(state.selectedMs, SELECTED_MS);
  assert.deepEqual(state.civilInput, {
    year:2005,
    month:12,
    day:23,
    hour:22,
    minute:55,
    second:0
  });
  assert.equal(state.longitudeDegrees, 121.5);
  assert.deepEqual(state.corrections, canonical.corrections);
  assert.equal(state.corrections.longitudeMinutes, 6);
  assert.ok(Number.isFinite(state.corrections.equationOfTimeMinutes));
  assert.ok(Math.abs(
    state.corrections.totalMinutes
      - state.corrections.longitudeMinutes
      - state.corrections.equationOfTimeMinutes
  ) < 1e-9);

  assert.equal(state.fixedPillars.year.name, "乙酉");
  assert.equal(state.fixedPillars.month.name, "戊子");
  assert.deepEqual(
    state.rows.map(row => [row.id, row.day.name, row.hour.name, row.changedFromCivil.any]),
    canonical.rows.map(row => [row.id, row.day.name, row.hour.name, row.changedFromCivil.any])
  );
  assert.deepEqual(
    state.rows.map(row => [row.id, row.day.name, row.hour.name, row.changedFromCivil.any]),
    [
      ["civil", "辛巳", "己亥", false],
      ["local-mean-solar", "壬午", "庚子", true],
      ["local-apparent-solar", "壬午", "庚子", true]
    ]
  );
  assert.equal(state.anyDayChange, true);
  assert.equal(state.anyHourChange, true);
  assert.equal(state.anyChange, true);
});

test("Atlas solar-time longitude never infers geography from UTC offset", () => {
  assert.equal(normalizeAtlasLongitude(null), null);
  assert.equal(normalizeAtlasLongitude(""), null);
  assert.equal(normalizeAtlasLongitude(0), 0);
  assert.equal(normalizeAtlasLongitude(-73.9857), -73.9857);
  assert.throws(() => normalizeAtlasLongitude("121.5"), /finite number or null/);
  assert.throws(() => normalizeAtlasLongitude(180.1), /between -180 and \+180/);
  assert.throws(() => normalizeAtlasLongitude(Number.NaN), /finite number or null/);
});
