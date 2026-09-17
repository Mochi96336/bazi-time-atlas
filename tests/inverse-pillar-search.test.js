import test from "node:test";
import assert from "node:assert/strict";

import { resolveBirthPillars } from "../src/calendar/tyme-adapter.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  normalizeAtlasTimeContext
} from "../src/wheel/atlas-time-context.js";
import { civilFieldsFromInstant } from "../src/wheel/atlas-display-model.js";
import { discretePhaseWindowForRing } from "../src/wheel/discrete-phase.js";
import {
  normalizeInversePillarConstraints,
  searchInversePillarIntervals
} from "../src/search/inverse-pillar-search.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function pillarsAt(ms, context = DEFAULT_ATLAS_TIME_CONTEXT) {
  const fields = civilFieldsFromInstant(ms, context);
  return resolveBirthPillars(fields, {
    utcOffsetHours: context.utcOffsetHours,
    dayBoundary: context.dayBoundary
  }).pillars;
}

function names(pillars) {
  return Object.fromEntries(
    ["year", "month", "day", "hour"].map(id => [id, pillars[id].name])
  );
}

test("inverse solver round-trips one real Selected Instant through all four pillars", () => {
  const selectedMs = Date.parse("2026-09-17T07:34:00.000Z");
  const target = names(pillarsAt(selectedMs));
  const result = searchInversePillarIntervals({
    constraints: target,
    startMs: selectedMs - 3 * DAY_MS,
    endMs: selectedMs + 3 * DAY_MS
  });

  assert.equal(result.truncated, false);
  assert.deepEqual(result.stats.constrainedRings, ["year", "month", "day", "hour"]);
  const containing = result.matches.find(match => match.startMs <= selectedMs && selectedMs < match.endMs);
  assert.ok(containing, "the canonical Selected Instant must be recovered as a real matching interval");
  assert.deepEqual(
    Object.fromEntries(Object.entries(containing.pillars).map(([id, pillar]) => [id, pillar.name])),
    target
  );
});

test("Hour-only search returns the exact canonical double-hour interval", () => {
  const selectedMs = Date.parse("2026-09-17T07:34:00.000Z");
  const targetHour = pillarsAt(selectedMs).hour.name;
  const expected = discretePhaseWindowForRing("hour", selectedMs, DEFAULT_ATLAS_TIME_CONTEXT);
  const result = searchInversePillarIntervals({
    constraints: { hour: targetHour },
    startMs: expected.startMs - HOUR_MS,
    endMs: expected.endMs + HOUR_MS
  });

  const exact = result.matches.find(match => match.startMs === expected.startMs && match.endMs === expected.endMs);
  assert.ok(exact, "Hour search must use the real double-hour boundaries instead of sampled approximations");
  assert.deepEqual(Object.keys(exact.pillars), ["hour"]);
});

test("Day-only search skips Hour boundaries and keeps wildcard pillars out of the interval claim", () => {
  const selectedMs = Date.parse("2026-09-17T07:34:00.000Z");
  const targetDay = pillarsAt(selectedMs).day.name;
  const result = searchInversePillarIntervals({
    constraints: { day: targetDay },
    startMs: selectedMs - 65 * DAY_MS,
    endMs: selectedMs + 65 * DAY_MS
  });

  assert.deepEqual(result.stats.constrainedRings, ["day"]);
  assert.ok(result.stats.boundarySteps < 140, "Day-only search should advance by day boundaries, not two-hour boundaries");
  assert.ok(result.matches.length >= 2, "a 130-day window should contain repeated occurrences of one day pillar");
  for (const match of result.matches) {
    assert.deepEqual(Object.keys(match.pillars), ["day"]);
    assert.equal(match.pillars.day.name, targetDay);
  }
});

test("inverse search honors an explicit alternate day-boundary convention", () => {
  const context = normalizeAtlasTimeContext({
    utcOffsetHours: 8,
    dayBoundary: "civil-midnight"
  });
  const selectedMs = Date.parse("2026-09-17T15:30:00.000Z");
  const target = names(pillarsAt(selectedMs, context));
  const result = searchInversePillarIntervals({
    constraints: { day: target.day, hour: target.hour },
    startMs: selectedMs - DAY_MS,
    endMs: selectedMs + DAY_MS,
    timeContext: context
  });

  assert.ok(
    result.matches.some(match => match.startMs <= selectedMs && selectedMs < match.endMs),
    "the inverse solver must use the requested day-boundary authority"
  );
  assert.equal(result.timeContext.dayBoundary, "civil-midnight");
});

test("inverse search fails closed for unconstrained or invalid requests", () => {
  assert.throws(
    () => normalizeInversePillarConstraints({}),
    /requires at least one constrained pillar/
  );
  assert.throws(
    () => normalizeInversePillarConstraints({ day: "not-a-pillar" }),
    /canonical sexagenary name/
  );
  assert.throws(
    () => searchInversePillarIntervals({
      constraints: { day: "甲子" },
      startMs: 10,
      endMs: 10
    }),
    /endMs must be greater than startMs/
  );
});
