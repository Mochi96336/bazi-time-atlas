import test from "node:test";
import assert from "node:assert/strict";
import {
  GREGORIAN_400_YEAR_DAYS,
  GLOBAL_GREGORIAN_YEAR_SEQUENCE_DAY_PERIOD,
  canonicalRecurrenceCandidates,
  findFirstLocalYearSequenceDayRecurrence,
  findGlobalGregorianYearSequenceDayPeriod,
  gregorianOrdinal,
  recurrenceState
} from "../src/recurrence/gregorian-cycle.js";

const BASE = { year: 2026, month: 9, day: 13 };

test("Gregorian 400-year block is exactly 146097 days", () => {
  const delta = gregorianOrdinal({ year: 2426, month: 9, day: 13 }) - gregorianOrdinal(BASE);
  assert.equal(delta, GREGORIAN_400_YEAR_DAYS);
});

test("2026-09-13 first repeats year-sequence + day phases after 1980 years", () => {
  const local = findFirstLocalYearSequenceDayRecurrence(BASE);
  assert.equal(local.deltaYears, 1980);
  assert.equal(local.phases.yearSequence, 0);
  assert.equal(local.phases.day, 0);
  assert.equal(local.closed.gregorian, false);
});

test("canonical milestones show why 24000 years is the first global closure", () => {
  const at400 = recurrenceState(BASE, 400);
  assert.deepEqual(at400.phases, { yearSequence: 40, gregorian: 0, day: 57 });

  const at1200 = recurrenceState(BASE, 1200);
  assert.deepEqual(at1200.phases, { yearSequence: 0, gregorian: 0, day: 51 });

  const at8000 = recurrenceState(BASE, 8000);
  assert.deepEqual(at8000.phases, { yearSequence: 20, gregorian: 0, day: 0 });

  const at24000 = recurrenceState(BASE, GLOBAL_GREGORIAN_YEAR_SEQUENCE_DAY_PERIOD);
  assert.deepEqual(at24000.phases, { yearSequence: 0, gregorian: 0, day: 0 });
  assert.equal(at24000.dayDelta, 8_765_820);
});

test("global Gregorian + year-sequence + day period search returns 24000 years", () => {
  const period = findGlobalGregorianYearSequenceDayPeriod();
  assert.equal(period.deltaYears, 24_000);
  assert.equal(period.gregorianBlocks, 60);
  assert.equal(period.dayDelta % 60, 0);
});

test("candidate list includes the local recurrence and global closure", () => {
  const candidates = canonicalRecurrenceCandidates(BASE).map(state => state.deltaYears);
  assert.deepEqual(candidates, [60, 400, 1200, 1980, 8000, 24000]);
});
