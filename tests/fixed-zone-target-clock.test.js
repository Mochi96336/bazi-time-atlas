import test from "node:test";
import assert from "node:assert/strict";
import { gregorianOrdinal } from "../src/recurrence/gregorian-cycle.js";
import {
  FIXED_ZONE_TARGET_CLOCK_CONTRACT,
  PROLEPTIC_GREGORIAN_EPOCH_JD,
  fixedZoneTargetClock
} from "../src/recurrence/fixed-zone-target-clock.js";
import { TARGET_INSTANT_BASIS } from "../src/recurrence/target-instant-binding.js";

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} within ${tolerance}`);
}

test("proleptic Gregorian epoch and Unix epoch controls pin the Julian-day origin", () => {
  assert.equal(PROLEPTIC_GREGORIAN_EPOCH_JD, 1_721_425.5);

  const unix = fixedZoneTargetClock({
    year:1970,
    month:1,
    day:1,
    hour:0,
    minute:0,
    second:0
  }, 0);
  assert.equal(unix.ut1JulianDay, UNIX_EPOCH_JD);

  const sameInstantAtPlusEight = fixedZoneTargetClock({
    year:1970,
    month:1,
    day:1,
    hour:8,
    minute:0,
    second:0
  }, 8);
  assert.equal(sameInstantAtPlusEight.ut1JulianDay, UNIX_EPOCH_JD);
});

test("modern fixed-offset projection agrees with the Unix-millisecond control", () => {
  const local = { year:2026, month:9, day:13, hour:12, minute:34, second:56 };
  const projected = fixedZoneTargetClock(local, 8);
  const expected = Date.UTC(2026, 8, 13, 4, 34, 56) / DAY_MS + UNIX_EPOCH_JD;

  close(projected.ut1JulianDay, expected);
  assert.equal(projected.targetInstant.basis, TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1);
  assert.equal(projected.targetInstant.inputTimeScale, "UT1");
  assert.equal(projected.targetInstant.requiresEarthRotationBridge, false);
  assert.deepEqual(projected.localClock, local);
});

test("year-4006 same local clock phase preserves exact proleptic Gregorian day displacement", () => {
  const baseLocal = { year:2026, month:9, day:13, hour:12, minute:34, second:56 };
  const targetLocal = { ...baseLocal, year:4006 };
  const base = fixedZoneTargetClock(baseLocal, 8);
  const target = fixedZoneTargetClock(targetLocal, 8);
  const expectedDayDelta = gregorianOrdinal(targetLocal) - gregorianOrdinal(baseLocal);

  close(target.ut1JulianDay - base.ut1JulianDay, expectedDayDelta);
  assert.equal(target.localOffsetHoursFromUt1, 8);
  assert.equal(target.futureUtcPolicyResolved, false);
  assert.equal(target.civilTimezonePolicyResolved, false);
});

test("fractional fixed offsets remain explicit rather than rounded to whole time zones", () => {
  const local = { year:2026, month:1, day:1, hour:5, minute:30, second:0 };
  const projected = fixedZoneTargetClock(local, 5.5);
  const zero = fixedZoneTargetClock({ ...local, hour:0, minute:0 }, 0);
  close(projected.ut1JulianDay, zero.ut1JulianDay);
  assert.equal(projected.targetInstant.localOffsetHoursFromUt1, 5.5);
});

test("invalid dates, clock fields, leap seconds and out-of-range offsets fail closed", () => {
  assert.throws(() => fixedZoneTargetClock({ year:2026, month:2, day:29, hour:0, minute:0 }, 8), /invalid proleptic Gregorian local date/);
  assert.throws(() => fixedZoneTargetClock({ year:2024, month:2, day:29, hour:24, minute:0 }, 8), /hour/);
  assert.throws(() => fixedZoneTargetClock({ year:2024, month:2, day:29, hour:23, minute:60 }, 8), /minute/);
  assert.throws(() => fixedZoneTargetClock({ year:2024, month:2, day:29, hour:23, minute:59, second:60 }, 8), /second/);
  assert.throws(() => fixedZoneTargetClock({ year:2024, month:2, day:29, hour:23, minute:59 }, 14.1), /localOffsetHoursFromUt1/);
});

test("fixed-zone target clock contract refuses to masquerade as future civil-time policy", () => {
  assert.equal(FIXED_ZONE_TARGET_CLOCK_CONTRACT.calendar, "proleptic-gregorian");
  assert.equal(FIXED_ZONE_TARGET_CLOCK_CONTRACT.localClockReference, "fixed-offset-from-ut1");
  assert.equal(FIXED_ZONE_TARGET_CLOCK_CONTRACT.outputTimeScale, "UT1");
  assert.equal(FIXED_ZONE_TARGET_CLOCK_CONTRACT.futureUtcPolicyResolved, false);
  assert.equal(FIXED_ZONE_TARGET_CLOCK_CONTRACT.civilTimezonePolicyResolved, false);
  assert.equal(FIXED_ZONE_TARGET_CLOCK_CONTRACT.supportsLeapSeconds, false);
});
