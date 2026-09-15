import test from "node:test";
import assert from "node:assert/strict";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import { DAY_HOUR_TIME_BASIS } from "../src/calendar/day-hour-time-basis.js";
import { currentRecurrenceDayHourProof } from "../src/recurrence/day-hour-proof-chain.js";
import { EQUATION_OF_TIME_MODEL_ID } from "../src/recurrence/equation-of-time-model-binding.js";
import { TARGET_INSTANT_BASIS } from "../src/recurrence/target-instant-binding.js";

const TARGET = Object.freeze({
  basis:TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1,
  julianDay:3_184_634.5,
  localOffsetHoursFromUt1:8
});
const EOT_MODEL_ID = EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1;

function current(clockBasis, longitudeDegrees, extra = {}) {
  return currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    targetInstant:TARGET,
    dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    clockBasis,
    longitudeDegrees,
    ...extra
  });
}

test("current recurrence forwards longitude into local mean solar proof", () => {
  const result = current(DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR, 121.5);
  assert.equal(result.longitude.bound, true);
  assert.equal(result.longitude.longitudeDegrees, 121.5);
  assert.equal(result.longitudeDegrees, 121.5);
  assert.equal(result.longitudeBound, true);
  assert.equal(result.firstHardBlocker, null);
  assert.equal(result.hour.resolved, true);
});

test("current apparent-solar proof advances from longitude to Equation of Time", () => {
  const result = current(DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR, -74.006);
  assert.equal(result.longitude.bound, true);
  assert.equal(result.longitudeDegrees, -74.006);
  assert.equal(result.firstHardBlocker, "equation-of-time");
  assert.deepEqual(result.hour.blockers, ["equationOfTimeModel"]);
  assert.equal(result.hour.resolved, false);
});

test("current 4006 apparent-solar proof cannot promote the modern EoT implementation by presence alone", () => {
  const result = current(
    DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    121.5,
    { targetYear:4006, equationOfTimeModelId:EOT_MODEL_ID }
  );
  assert.equal(result.equationOfTimeModel.bound, true);
  assert.equal(result.equationOfTimeModel.modelId, EOT_MODEL_ID);
  assert.equal(result.equationOfTimeModel.recurrenceAuthority, false);
  assert.equal(result.equationOfTimeModelValidated, false);
  assert.equal(result.firstHardBlocker, "equation-of-time");
  assert.deepEqual(result.hour.blockers, ["equationOfTimeModel"]);
  assert.equal(result.hour.resolved, false);
});

test("legacy Equation-of-Time boolean presence cannot unlock current recurrence", () => {
  const result = current(
    DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    121.5,
    { targetYear:4006, equationOfTimeModel:true }
  );
  assert.equal(result.equationOfTimeModel.bound, false);
  assert.equal(result.equationOfTimeModelValidated, false);
  assert.equal(result.firstHardBlocker, "equation-of-time");
  assert.deepEqual(result.hour.blockers, ["equationOfTimeModel"]);
});

test("legacy longitudeBound presence cannot unlock current recurrence", () => {
  const result = current(
    DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR,
    null,
    { longitudeBound:true }
  );
  assert.equal(result.longitude.bound, false);
  assert.equal(result.longitudeDegrees, null);
  assert.equal(result.longitudeBound, false);
  assert.equal(result.firstHardBlocker, "longitude");
  assert.deepEqual(result.hour.blockers, ["longitudeBound"]);
});