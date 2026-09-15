import test from "node:test";
import assert from "node:assert/strict";
import { DAY_HOUR_TIME_BASIS } from "../src/calendar/day-hour-time-basis.js";
import {
  currentRecurrenceDayHourProof,
  dayHourResolutionProof
} from "../src/recurrence/day-hour-proof-chain.js";
import { TARGET_INSTANT_BASIS } from "../src/recurrence/target-instant-binding.js";

const SAMPLE_JD = 3_184_634.5;

function target(basis, extra = {}) {
  return { basis, julianDay:SAMPLE_JD, ...extra };
}

function proof(overrides = {}) {
  return dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstant:target(TARGET_INSTANT_BASIS.TT_JULIAN_DAY),
    earthRotationBridge:true,
    earthRotationEstimateAvailable:true,
    civilZoneBound:true,
    dayBoundaryBound:true,
    sexagenaryDayArithmetic:true,
    clockBasis:null,
    longitudeBound:false,
    equationOfTimeModel:false,
    hourBranchRule:true,
    fiveRatsRule:true,
    ...overrides
  });
}

test("current deep-time recurrence defaults to missing absolute seasonal epoch and a typed date-only target", () => {
  const result = currentRecurrenceDayHourProof({ identity:false, astronomyWithinRange:true });
  assert.equal(result.firstHardBlocker, "absolute-seasonal-epoch");
  assert.equal(result.targetInstantBound, false);
  assert.equal(result.targetInstantBasis, TARGET_INSTANT_BASIS.DATE_ONLY);
  assert.equal(result.day.resolved, false);
  assert.equal(result.hour.resolved, false);
  assert.ok(result.day.blockers.includes("absoluteSeasonalEpoch"));
  assert.ok(result.day.blockers.includes("targetInstantBound"));
  assert.ok(result.day.blockers.includes("earthRotationBridge"));
  assert.equal(result.stages.find(stage => stage.id === "target-instant").status, "unbound-convention");
});

test("date-only recurrence stops before Earth rotation even when year-4006 Delta-T capability exists", () => {
  const result = currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    earthRotationEstimateAvailable:true
  });
  assert.equal(result.firstHardBlocker, "target-instant");
  assert.equal(result.targetInstantBound, false);
  assert.equal(result.earthRotationBridgeRequired, false);
  assert.equal(result.earthRotationEstimateCapability, true);
  assert.equal(result.earthRotationEstimateAvailable, false);
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "blocked");
});

test("a TT target makes the uncertain TT to UT1 estimate the next hard blocker", () => {
  const result = currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    targetInstant:target(TARGET_INSTANT_BASIS.TT_JULIAN_DAY),
    earthRotationEstimateAvailable:true
  });
  assert.equal(result.firstHardBlocker, "earth-rotation-bridge");
  assert.equal(result.targetInstantBound, true);
  assert.equal(result.targetInstantBasis, TARGET_INSTANT_BASIS.TT_JULIAN_DAY);
  assert.equal(result.earthRotationBridgeRequired, true);
  assert.equal(result.earthRotationEstimateAvailable, true);
  assert.equal(result.stages.find(stage => stage.id === "target-instant").status, "satisfied");
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "uncertain-estimate");
});

test("a UT1 target already owns an Earth-rotation coordinate and does not require TT to UT1 again", () => {
  const result = currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    targetInstant:target(TARGET_INSTANT_BASIS.UT1_JULIAN_DAY),
    earthRotationEstimateAvailable:true
  });
  assert.equal(result.targetInstantBound, true);
  assert.equal(result.targetInstantBasis, TARGET_INSTANT_BASIS.UT1_JULIAN_DAY);
  assert.equal(result.earthRotationBridgeRequired, false);
  assert.equal(result.earthRotationEstimateAvailable, false);
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "not-required");
  assert.equal(result.firstHardBlocker, "civil-zone");
});

test("a fixed-zone-from-UT1 target can satisfy Day without inventing future UTC policy", () => {
  const result = proof({
    targetInstant:target(TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1, { localOffsetHoursFromUt1:8 }),
    earthRotationBridge:false,
    clockBasis:DAY_HOUR_TIME_BASIS.CIVIL
  });
  assert.equal(result.targetInstant.futureUtcPolicyResolved, false);
  assert.equal(result.targetInstant.civilTimezonePolicyResolved, false);
  assert.equal(result.targetInstant.localClockCoordinateAvailable, true);
  assert.equal(result.earthRotationBridgeRequired, false);
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "not-required");
  assert.equal(result.day.resolved, true);
  assert.equal(result.hour.resolved, true);
});

test("identity bypasses cross-era projection without inventing any target instant basis", () => {
  const result = currentRecurrenceDayHourProof({ identity:true, astronomyWithinRange:true });
  assert.equal(result.day.status, "identical-by-definition");
  assert.equal(result.hour.status, "identical-by-definition");
  assert.equal(result.targetInstantBound, false);
  assert.equal(result.targetInstantBasis, TARGET_INSTANT_BASIS.DATE_ONLY);
  assert.equal(result.stages.find(stage => stage.id === "target-instant").status, "not-required");
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "not-required");
});

test("Day with a TT target becomes resolvable only after deterministic Earth rotation and civil day rules", () => {
  const result = proof();
  assert.equal(result.day.resolved, true);
  assert.equal(result.day.blockers.length, 0);
  assert.equal(result.hour.resolved, false);
  assert.deepEqual(result.hour.blockers, ["clockBasisBound"]);
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "satisfied");
});

test("even a deterministic Earth-rotation model cannot resolve a date-only recurrence", () => {
  const result = proof({
    targetInstant:null,
    clockBasis:DAY_HOUR_TIME_BASIS.CIVIL
  });
  assert.equal(result.firstHardBlocker, "target-instant");
  assert.equal(result.day.resolved, false);
  assert.equal(result.hour.resolved, false);
  assert.deepEqual(result.day.blockers, ["targetInstantBound", "earthRotationBridge"]);
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "blocked");
});

test("civil-clock Hour needs no longitude or Equation of Time once Day is resolved", () => {
  const result = proof({ clockBasis:DAY_HOUR_TIME_BASIS.CIVIL });
  assert.equal(result.day.resolved, true);
  assert.equal(result.hour.resolved, true);
  assert.equal(result.needsLongitude, false);
  assert.equal(result.needsEquationOfTime, false);
  assert.equal(result.stages.find(stage => stage.id === "longitude").status, "not-required");
  assert.equal(result.stages.find(stage => stage.id === "equation-of-time").status, "not-required");
});

test("local mean solar Hour adds longitude but not Equation of Time", () => {
  const result = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR,
    longitudeBound:false
  });
  assert.equal(result.hour.resolved, false);
  assert.deepEqual(result.hour.blockers, ["longitudeBound"]);
  assert.equal(result.needsLongitude, true);
  assert.equal(result.needsEquationOfTime, false);
});

test("local apparent solar Hour requires longitude and an epoch-valid Equation of Time model", () => {
  const blocked = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    longitudeBound:true,
    equationOfTimeModel:false
  });
  assert.equal(blocked.hour.resolved, false);
  assert.deepEqual(blocked.hour.blockers, ["equationOfTimeModel"]);

  const resolved = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    longitudeBound:true,
    equationOfTimeModel:true
  });
  assert.equal(resolved.hour.resolved, true);
});

test("legacy short solar clock ids fail closed instead of drifting from the calendar engine", () => {
  assert.throws(() => proof({ clockBasis:"mean-solar" }), /clockBasis/);
  assert.throws(() => proof({ clockBasis:"apparent-solar" }), /clockBasis/);
});

test("forged target-bound booleans and clock-basis ids cannot masquerade as target instant references", () => {
  assert.throws(() => proof({ targetInstant:{ bound:true } }), /target instant basis/);
  assert.throws(() => proof({ targetInstant:{ basis:DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR, julianDay:SAMPLE_JD } }), /target instant basis/);
});

test("invalid clock basis fails closed", () => {
  assert.throws(() => proof({ clockBasis:"sundial-ish" }), /clockBasis/);
});
