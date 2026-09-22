import test from "node:test";
import assert from "node:assert/strict";
import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";
import { fourPillarDeterminacy } from "../src/recurrence/four-pillar-determinacy.js";

const baseDate = Object.freeze({ year:2026, month:9, day:13 });

function state(deltaYears, astronomyWithinRange = true) {
  const recurrence = recurrenceState(baseDate, deltaYears);
  return fourPillarDeterminacy({
    deltaYears,
    yearSequenceAligned: deltaYears % 60 === 0,
    discreteYearSequenceClosed: recurrence.closed.yearSequence,
    discreteDayClosed: recurrence.closed.day,
    astronomyWithinRange
  });
}

test("zero displacement is identical for all four pillars by definition", () => {
  const result = state(0);
  assert.equal(result.identity, true);
  for (const pillar of ["year", "month", "day", "hour"]) {
    assert.equal(result.pillars[pillar].status, "identical-by-definition");
    assert.equal(result.pillars[pillar].resolved, true);
  }
});

test("exact 24000-year discrete closure resolves Year/Month boundary attribution only", () => {
  const recurrence = recurrenceState(baseDate, 24_000);
  assert.equal(recurrence.closed.yearSequence, true);
  assert.equal(recurrence.closed.day, true);
  assert.equal(recurrence.closed.gregorian, true);

  const result = state(24_000);
  assert.equal(result.pillars.year.status, "boundary-resolved");
  assert.equal(result.pillars.month.status, "boundary-resolved");
  assert.equal(result.pillars.year.resolved, true);
  assert.equal(result.pillars.month.resolved, true);

  assert.equal(result.pillars.day.status, "not-resolved-by-shape-model");
  assert.equal(result.pillars.day.resolved, false);
  assert.equal(result.pillars.day.discretePhaseClosed, true);
  assert.ok(result.pillars.day.summary.includes("離散日序雖回到 0"));

  assert.equal(result.pillars.hour.status, "not-resolved-by-shape-model");
  assert.equal(result.pillars.hour.resolved, false);
  assert.equal(result.absoluteCivilPhasePreserved, false);
  assert.equal(result.localClockModeled, false);
});

test("1980-year Year+Day local recurrence still cannot prove Day/Hour pillars in the shape window", () => {
  const recurrence = recurrenceState(baseDate, 1980);
  assert.equal(recurrence.closed.yearSequence, true);
  assert.equal(recurrence.closed.day, true);

  const result = state(1980);
  assert.equal(result.pillars.year.status, "boundary-resolved");
  assert.equal(result.pillars.month.status, "boundary-resolved");
  assert.equal(result.pillars.day.resolved, false);
  assert.equal(result.pillars.hour.resolved, false);
});

test("400-year Gregorian closure resolves month branches but not pure full Ganzhi", () => {
  const recurrence = recurrenceState(baseDate, 400);
  assert.equal(recurrence.closed.gregorian, true);
  assert.equal(recurrence.closed.yearSequence, false);

  const result = state(400);
  assert.equal(result.yearSequenceAligned, false);
  assert.equal(result.pillars.year.status, "mixed-with-year-sequence");
  assert.equal(result.pillars.year.resolved, false);
  assert.equal(result.pillars.month.status, "branch-resolved-stem-mixed");
  assert.equal(result.pillars.month.resolved, false);
  assert.deepEqual(result.pillars.month.missingInputs, ["closed-sexagenary-year-phase"]);
});

test("astronomy outside the declared range removes Year/Month boundary resolution", () => {
  const result = state(60, false);
  assert.equal(result.pillars.year.status, "astronomy-unavailable");
  assert.equal(result.pillars.month.status, "astronomy-unavailable");
  assert.equal(result.pillars.year.resolved, false);
  assert.equal(result.pillars.month.resolved, false);
  assert.equal(result.pillars.day.status, "not-resolved-by-shape-model");
  assert.equal(result.pillars.hour.status, "not-resolved-by-shape-model");
});

test("Hour pillar explicitly records every missing clock dependency", () => {
  const result = state(24_000);
  assert.deepEqual(result.pillars.hour.missingInputs, [
    "absolute-local-clock-phase",
    "timezone-and-longitude",
    "solar-time-convention",
    "resolved-day-stem"
  ]);
});
