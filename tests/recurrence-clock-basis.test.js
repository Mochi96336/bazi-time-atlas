import test from "node:test";
import assert from "node:assert/strict";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import { DAY_HOUR_TIME_BASIS } from "../src/calendar/day-hour-time-basis.js";
import { currentRecurrenceDayHourProof } from "../src/recurrence/day-hour-proof-chain.js";
import { TARGET_INSTANT_BASIS } from "../src/recurrence/target-instant-binding.js";

const FIXED_ZONE_TARGET = Object.freeze({
  basis:TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1,
  julianDay:3_184_634.5,
  localOffsetHoursFromUt1:8
});

function proof(clockBasis = null) {
  return currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    targetInstant:FIXED_ZONE_TARGET,
    dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    clockBasis
  });
}

test("recurrence clock basis remains explicitly unbound by default", () => {
  const result = proof();
  assert.equal(result.firstHardBlocker, "clock-basis");
  assert.equal(result.clockBasis, null);
  assert.equal(result.day.resolved, true);
  assert.equal(result.hour.resolved, false);
  assert.deepEqual(result.hour.blockers, ["clockBasisBound"]);
});

test("explicit civil clock basis resolves Hour without longitude or Equation of Time", () => {
  const result = proof(DAY_HOUR_TIME_BASIS.CIVIL);
  assert.equal(result.clockBasis, DAY_HOUR_TIME_BASIS.CIVIL);
  assert.equal(result.firstHardBlocker, null);
  assert.equal(result.needsLongitude, false);
  assert.equal(result.needsEquationOfTime, false);
  assert.equal(result.day.resolved, true);
  assert.equal(result.hour.resolved, true);
});

test("explicit local mean solar basis advances the proof to longitude", () => {
  const result = proof(DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR);
  assert.equal(result.firstHardBlocker, "longitude");
  assert.equal(result.needsLongitude, true);
  assert.equal(result.needsEquationOfTime, false);
  assert.deepEqual(result.hour.blockers, ["longitudeBound"]);
});

test("explicit local apparent solar basis exposes longitude and Equation of Time requirements", () => {
  const result = proof(DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR);
  assert.equal(result.firstHardBlocker, "longitude");
  assert.equal(result.needsLongitude, true);
  assert.equal(result.needsEquationOfTime, true);
  assert.deepEqual(result.hour.blockers, ["longitudeBound", "equationOfTimeModel"]);
});

test("invalid recurrence clock-basis ids fail closed", () => {
  assert.throws(() => proof("sundial-ish"), /clockBasis/);
});
