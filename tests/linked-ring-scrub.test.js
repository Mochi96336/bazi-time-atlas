import test from "node:test";
import assert from "node:assert/strict";

import { apparentSolarLongitude } from "../src/astronomy/solar-longitude.js";
import {
  jieBoundaryContext,
  solarTermNamedEventsBetween
} from "../src/astronomy/solar-term-boundaries.js";
import { DAY_BOUNDARY, resolveBirthPillars } from "../src/calendar/tyme-adapter.js";
import {
  monthPhaseWindow,
  yearPhaseWindow
} from "../src/wheel/discrete-phase.js";
import { shortestAngleDelta } from "../src/wheel/polar-geometry.js";
import {
  LINKED_SCRUB_CONSTANTS,
  applyLinkedRingDrag,
  consumeDiscreteDrag,
  solveLinkedLongitudeDrag,
  solveLinkedTemporalDrag,
  stepLinkedDiscreteInstant
} from "../src/interaction/linked-ring-scrub.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const UTC_OFFSET_HOURS = 8;
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SEXAGENARY = Array.from({ length:60 }, (_, index) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`);

function fieldsFromInstant(ms) {
  const shifted = new Date(ms + UTC_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

function longitudeAtMs(ms) {
  return apparentSolarLongitude(fieldsFromInstant(ms), UTC_OFFSET_HOURS);
}

function hourPillarIndex(ms) {
  const resolved = resolveBirthPillars(fieldsFromInstant(ms), {
    utcOffsetHours:UTC_OFFSET_HOURS,
    dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  });
  return SEXAGENARY.indexOf(resolved.pillars.hour.name);
}

function assertNear(actual, expected, tolerance = 1e-6, message = "") {
  assert.ok(Math.abs(actual - expected) <= tolerance, message || `${actual} should be within ${tolerance} of ${expected}`);
}

test("legacy six-degree consumer remains available only as a compatibility helper", () => {
  assert.deepEqual(consumeDiscreteDrag(0, 5.9), { steps:0, remainderDegrees:5.9 });
  assert.deepEqual(consumeDiscreteDrag(5.9, 0.2), { steps:1, remainderDegrees:0.10000000000000053 });
  assert.deepEqual(consumeDiscreteDrag(0, -6.1), { steps:-1, remainderDegrees:-0.09999999999999964 });
});

test("linked hour drag honors a non-default fixed offset", () => {
  const start = Date.parse("2026-09-15T20:14:37.000Z");
  const timeContext = {
    utcOffsetHours:9,
    dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT
  };
  const phaseStart = Date.parse("2026-09-15T20:00:00.000Z");
  const phaseEnd = Date.parse("2026-09-15T22:00:00.000Z");
  const progress = (start - phaseStart) / (phaseEnd - phaseStart);
  const delta = progress * 3;
  const result = solveLinkedTemporalDrag({
    ringId:"hour",
    instantMs:start,
    dragDeltaDegrees:delta,
    timeContext
  });
  const expected = phaseStart + progress * 0.5 * (phaseEnd - phaseStart);

  assertNear(result.instantMs, expected, 1e-6);
  assert.equal(result.crossedBoundaries, 0);
});

test("linked day drag honors civil-midnight ownership", () => {
  const start = Date.parse("2026-09-15T20:14:37.000Z");
  const timeContext = {
    utcOffsetHours:9,
    dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT
  };
  const phaseStart = Date.parse("2026-09-15T15:00:00.000Z");
  const phaseEnd = Date.parse("2026-09-16T15:00:00.000Z");
  const progress = (start - phaseStart) / (phaseEnd - phaseStart);
  const delta = progress * 3;
  const result = applyLinkedRingDrag({
    ringId:"day",
    instantMs:start,
    deltaDegrees:delta,
    timeContext
  });
  const expected = phaseStart + progress * 0.5 * (phaseEnd - phaseStart);

  assertNear(result.instantMs, expected, 1e-6);
  assert.equal(result.crossedBoundaries, 0);
});

test("sub-tooth hour drag changes master time immediately instead of waiting for six degrees", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const delta = 0.5;
  const result = applyLinkedRingDrag({ ringId:"hour", instantMs:start, deltaDegrees:delta });
  const expectedDeltaMs = -(delta / 6) * LINKED_SCRUB_CONSTANTS.hourPillarMs;

  assertNear(result.instantMs - start, expectedDeltaMs, 1e-6);
  assert.equal(result.remainderDegrees, 0);
  assert.equal(result.appliedSteps, 0);
  assert.equal(result.crossedBoundaries, 0);
  assert.equal(hourPillarIndex(result.instantMs), hourPillarIndex(start));
});

test("continuous hour drag preserves angle through an hour-pillar boundary", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const delta = 1.5;
  const result = solveLinkedTemporalDrag({ ringId:"hour", instantMs:start, dragDeltaDegrees:delta });
  assertNear(result.instantMs - start, -(delta / 6) * 2 * HOUR_MS, 1e-6);
  assert.equal(result.crossedBoundaries, 1);
  assert.equal(hourPillarIndex(result.instantMs), (hourPillarIndex(start) + 59) % 60);
});

test("one full hour tooth still represents one real two-hour interval without detent state", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const result = applyLinkedRingDrag({ ringId:"hour", instantMs:start, deltaDegrees:6 });
  assertNear(result.instantMs, start - LINKED_SCRUB_CONSTANTS.hourPillarMs, 1e-6);
  assert.equal(result.remainderDegrees, 0);
  assert.equal(result.appliedSteps, 0);

  const beforeIndex = hourPillarIndex(start);
  const afterIndex = hourPillarIndex(result.instantMs);
  assert.ok(beforeIndex >= 0 && afterIndex >= 0);
  assert.equal(afterIndex, (beforeIndex + 59) % 60, "one earlier shichen should be one earlier sexagenary hour tooth");

  const reverse = applyLinkedRingDrag({ ringId:"hour", instantMs:start, deltaDegrees:-6 });
  assertNear(reverse.instantMs, start + LINKED_SCRUB_CONSTANTS.hourPillarMs, 1e-6);
  assert.equal(hourPillarIndex(reverse.instantMs), (beforeIndex + 1) % 60);
});

test("hour gear remains one-tooth continuous across the Zi-initial day boundary", () => {
  const afterZiStart = Date.parse("2027-03-15T16:20:09.000Z"); // 2027-03-16 00:20 UTC+8
  const earlier = stepLinkedDiscreteInstant("hour", afterZiStart, -1);
  assert.equal(earlier, afterZiStart - LINKED_SCRUB_CONSTANTS.hourPillarMs);
  const beforeIndex = hourPillarIndex(afterZiStart);
  const earlierIndex = hourPillarIndex(earlier);
  assert.equal(earlierIndex, (beforeIndex + 59) % 60);
});

test("day gear maps fractional angle directly to fractional Zi-initial day time", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const result = applyLinkedRingDrag({ ringId:"day", instantMs:start, deltaDegrees:1 });
  assertNear(result.instantMs, start - 4 * HOUR_MS, 1e-6);
  assert.equal(result.remainderDegrees, 0);
  assert.equal(result.appliedSteps, 0);

  const reverse = applyLinkedRingDrag({ ringId:"day", instantMs:start, deltaDegrees:-1 });
  assertNear(reverse.instantMs, start + 4 * HOUR_MS, 1e-6);
});

test("month linked drag uses the actual active Jie interval for sub-tooth motion", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const phase = monthPhaseWindow(start);
  const delta = phase.progress * 3; // move halfway from the instant back to this Jie's start
  const result = solveLinkedTemporalDrag({ ringId:"month", instantMs:start, dragDeltaDegrees:delta });
  const expected = phase.startMs + phase.progress * 0.5 * (phase.endMs - phase.startMs);

  assertNear(result.instantMs, expected, 1e-5);
  assert.equal(result.crossedBoundaries, 0);
});

test("month linked drag carries remaining angle across Jie into the previous real interval", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const phase = monthPhaseWindow(start);
  const previous = monthPhaseWindow(phase.startMs - 1);
  const extraDegrees = 1.2;
  const delta = phase.progress * 6 + extraDegrees;
  const result = solveLinkedTemporalDrag({ ringId:"month", instantMs:start, dragDeltaDegrees:delta });
  const expectedProgress = 1 - extraDegrees / 6;
  const expected = previous.startMs + expectedProgress * (previous.endMs - previous.startMs);

  assertNear(result.instantMs, expected, 1e-5);
  assert.equal(result.crossedBoundaries, 1);
  assert.notEqual(previous.endMs - previous.startMs, phase.endMs - phase.startMs, "test must exercise unequal astronomical month durations");
});

test("year linked drag uses LiChun-to-LiChun duration instead of fixed 365-day arithmetic", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const phase = yearPhaseWindow(start);
  const delta = -1.5; // quarter tooth forward in time
  const result = solveLinkedTemporalDrag({ ringId:"year", instantMs:start, dragDeltaDegrees:delta });
  const expected = phase.startMs + (phase.progress + 0.25) * (phase.endMs - phase.startMs);

  assertNear(result.instantMs, expected, 1e-5);
  assert.equal(result.crossedBoundaries, 0);
  assert.notEqual(phase.endMs - phase.startMs, 365 * DAY_MS, "LiChun interval should not be reduced to a fixed civil-year constant");
});

test("month boundary stepping helper still resolves exact Jie boundaries for research probes", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const context = jieBoundaryContext(start);
  assert.ok(context.previous && context.next);

  const forward = stepLinkedDiscreteInstant("month", start, 1);
  assert.equal(forward, context.next.instantMs + LINKED_SCRUB_CONSTANTS.boundaryEntryEpsilonMs);

  const previousContext = jieBoundaryContext(context.previous.instantMs - 1);
  assert.ok(previousContext.previous);
  const backward = stepLinkedDiscreteInstant("month", start, -1);
  assert.equal(backward, previousContext.previous.instantMs + LINKED_SCRUB_CONSTANTS.boundaryEntryEpsilonMs);

  assert.notEqual(Math.round((forward - start) / DAY_MS), 30, "month stepping must not be a fixed +30d shortcut");
});

test("year boundary stepping helper still resolves LiChun rather than Gregorian New Year", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const events = solarTermNamedEventsBetween(start - 800 * DAY_MS, start + 800 * DAY_MS, ["立春"]);
  const currentIndex = events.findLastIndex(event => event.instantMs <= start);
  assert.ok(currentIndex >= 1 && currentIndex + 1 < events.length);

  const forward = stepLinkedDiscreteInstant("year", start, 1);
  const backward = stepLinkedDiscreteInstant("year", start, -1);
  assert.equal(forward, events[currentIndex + 1].instantMs + LINKED_SCRUB_CONSTANTS.boundaryEntryEpsilonMs);
  assert.equal(backward, events[currentIndex - 1].instantMs + LINKED_SCRUB_CONSTANTS.boundaryEntryEpsilonMs);

  const forwardFields = fieldsFromInstant(forward);
  assert.ok(forwardFields.month === 2 && forwardFields.day <= 5, "forward year step should enter the next LiChun interval");
});

test("solar and zodiac linked drag solve the underlying apparent solar longitude", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const startLongitude = longitudeAtMs(start);
  const delta = 12.5;
  const target = ((startLongitude - delta) % 360 + 360) % 360;

  const solved = solveLinkedLongitudeDrag({ instantMs:start, dragDeltaDegrees:delta, longitudeAtMs });
  const solvedLongitude = longitudeAtMs(solved);
  assert.ok(Math.abs(shortestAngleDelta(solvedLongitude, target)) < 0.001, `${solvedLongitude} should solve target ${target}`);
  assert.ok(solved < start - 10 * DAY_MS && solved > start - 15 * DAY_MS, "12.5° clockwise should move roughly twelve days backward");

  for (const ringId of ["solar", "zodiac"]) {
    const result = applyLinkedRingDrag({ ringId, instantMs:start, deltaDegrees:delta, longitudeAtMs });
    assert.ok(Math.abs(shortestAngleDelta(longitudeAtMs(result.instantMs), target)) < 0.001);
    assert.equal(result.remainderDegrees, 0);
    assert.equal(result.appliedSteps, 0);
    assert.equal(result.crossedBoundaries, 0);
  }
});
