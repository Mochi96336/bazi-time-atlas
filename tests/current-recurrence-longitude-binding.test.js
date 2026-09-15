import test from "node:test";
import assert from "node:assert/strict";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import { DAY_HOUR_TIME_BASIS } from "../src/calendar/day-hour-time-basis.js";
import { currentRecurrenceDayHourProof } from "../src/recurrence/day-hour-proof-chain.js";
import { TARGET_INSTANT_BASIS } from "../src/recurrence/target-instant-binding.js";

const TARGET = Object.freeze({
  basis:TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1,
  julianDay:3_184_634.5,
  localOffsetHoursFromUt1:8
});

function current(clockBasis, longitude, extra = {}) {
  return currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    targetInstant:TARGET,
    dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    clockBasis,
    longitude,
    ...extra
  });
}

test("current recurrence forwards typed longitude into local mean solar proof", () => {
  const result = current(
    DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR,
    { longitudeDegreesEast:121.5 }
  );
  assert.equal(result.longitude.bound, true);
  assert.equal(result.longitude.longitudeDegreesEast, 121.5);
  assert.equal(result.longitudeBound, true);
  assert.equal(result.firstHardBlocker, null);
  assert.equal(result.hour.resolved, true);
});

test("current apparent-solar proof advances from longitude to Equation of Time", () => {
  const result = current(
    DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    { longitudeDegreesEast:-74.006 }
  );
  assert.equal(result.longitude.bound, true);
  assert.equal(result.longitude.longitudeDegreesEast, -74.006);
  assert.equal(result.firstHardBlocker, "equation-of-time");
  assert.deepEqual(result.hour.blockers, ["equationOfTimeModel"]);
  assert.equal(result.hour.resolved, false);
});

test("legacy longitudeBound presence cannot unlock current recurrence", () => {
  const result = current(
    DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR,
    null,
    { longitudeBound:true }
  );
  assert.equal(result.longitude.bound, false);
  assert.equal(result.longitudeBound, false);
  assert.equal(result.firstHardBlocker, "longitude");
  assert.deepEqual(result.hour.blockers, ["longitudeBound"]);
});
