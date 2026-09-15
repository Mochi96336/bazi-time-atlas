import test from "node:test";
import assert from "node:assert/strict";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import {
  DAY_HOUR_LOCAL_CLOCK_STABILITY_CONTRACT,
  dayHourLocalClockStability
} from "../src/calendar/day-hour-clock-stability.js";

function stability(hour, minute, second, dayBoundary, uncertaintySeconds) {
  return dayHourLocalClockStability(
    { hour, minute, second },
    { dayBoundary, uncertaintySeconds }
  );
}

test("ordinary local clock remains stable when uncertainty is far from all boundaries", () => {
  const result = stability(12, 0, 0, DAY_BOUNDARY.CIVIL_MIDNIGHT, 2);
  assert.equal(result.hourBranchMarginSeconds, 3600);
  assert.equal(result.dayBoundaryMarginSeconds, 12 * 3600);
  assert.equal(result.governingMarginSeconds, 3600);
  assert.equal(result.remainingStableMarginSeconds, 3598);
  assert.equal(result.stable, true);
  assert.equal(result.status, "stable");
  assert.deepEqual(result.ambiguousKinds, []);
});

test("civil midnight can make Day and therefore Hour stem ambiguous inside a stable Zi branch", () => {
  const result = stability(23, 59, 59, DAY_BOUNDARY.CIVIL_MIDNIGHT, 2);
  assert.equal(result.hourBranchMarginSeconds, 3599);
  assert.equal(result.dayBoundaryMarginSeconds, 1);
  assert.equal(result.hourBranchStable, true);
  assert.equal(result.dayBoundaryStable, false);
  assert.equal(result.stable, false);
  assert.deepEqual(result.ambiguousKinds, ["day-boundary"]);
});

test("Zi-initial day boundary and Zi hour boundary become ambiguous together", () => {
  const result = stability(22, 59, 59, DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY, 2);
  assert.equal(result.hourBranchMarginSeconds, 1);
  assert.equal(result.dayBoundaryMarginSeconds, 1);
  assert.equal(result.hourBranchStable, false);
  assert.equal(result.dayBoundaryStable, false);
  assert.deepEqual(result.ambiguousKinds, ["hour-branch", "day-boundary"]);
});

test("non-day hour-branch boundaries are detected independently", () => {
  const result = stability(0, 59, 59, DAY_BOUNDARY.CIVIL_MIDNIGHT, 2);
  assert.equal(result.hourBranchMarginSeconds, 1);
  assert.equal(result.dayBoundaryMarginSeconds, 3599);
  assert.equal(result.hourBranchStable, false);
  assert.equal(result.dayBoundaryStable, true);
  assert.deepEqual(result.ambiguousKinds, ["hour-branch"]);
});

test("touching a boundary at the positive uncertainty radius remains ambiguous", () => {
  const result = stability(1, 0, 2, DAY_BOUNDARY.CIVIL_MIDNIGHT, 2);
  assert.equal(result.hourBranchMarginSeconds, 2);
  assert.equal(result.stable, false);
  assert.deepEqual(result.ambiguousKinds, ["hour-branch"]);
});

test("zero uncertainty keeps an exact convention boundary deterministic", () => {
  const zi = stability(23, 0, 0, DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY, 0);
  assert.equal(zi.hourBranchMarginSeconds, 0);
  assert.equal(zi.dayBoundaryMarginSeconds, 0);
  assert.equal(zi.stable, true);
  assert.deepEqual(zi.ambiguousKinds, []);

  const midnight = stability(0, 0, 0, DAY_BOUNDARY.CIVIL_MIDNIGHT, 0);
  assert.equal(midnight.dayBoundaryMarginSeconds, 0);
  assert.equal(midnight.stable, true);
});

test("fractional seconds are preserved for sub-second future uncertainty models", () => {
  const result = stability(0, 59, 59.75, DAY_BOUNDARY.CIVIL_MIDNIGHT, 0.3);
  assert.equal(result.hourBranchMarginSeconds, 0.25);
  assert.equal(result.hourBranchStable, false);
  assert.equal(result.stable, false);
});

test("invalid clocks, conventions and uncertainty claims fail closed", () => {
  assert.throws(() => dayHourLocalClockStability(null), /localClock/);
  assert.throws(() => dayHourLocalClockStability({ hour:24 }), /hour/);
  assert.throws(() => dayHourLocalClockStability({ hour:0, minute:60 }), /minute/);
  assert.throws(() => dayHourLocalClockStability({ hour:0, second:60 }), /second/);
  assert.throws(
    () => dayHourLocalClockStability({ hour:0 }, { dayBoundary:"late-zi-ish" }),
    /dayBoundary/
  );
  assert.throws(
    () => dayHourLocalClockStability({ hour:0 }, { uncertaintySeconds:-1 }),
    /non-negative/
  );
});

test("stability primitive explicitly grants no astronomy or recurrence authority", () => {
  assert.equal(DAY_HOUR_LOCAL_CLOCK_STABILITY_CONTRACT.grantsAstronomyAuthority, false);
  const result = stability(12, 0, 0, DAY_BOUNDARY.CIVIL_MIDNIGHT, 2);
  assert.equal(result.authorityGranted, false);
  assert.equal(result.uncertaintySemantics, "symmetric-clock-reading-radius");
});
