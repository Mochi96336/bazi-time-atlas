import test from "node:test";
import assert from "node:assert/strict";
import { DAY_HOUR_TIME_BASIS } from "../src/calendar/day-hour-time-basis.js";
import { DAY_BOUNDARY } from "../src/calendar/tyme-adapter.js";
import {
  currentRecurrenceDayHourProof,
  dayHourResolutionProof
} from "../src/recurrence/day-hour-proof-chain.js";
import { EQUATION_OF_TIME_MODEL_ID } from "../src/recurrence/equation-of-time-model-binding.js";
import { LOCAL_ZONE_CONVENTION_KIND } from "../src/recurrence/local-zone-convention.js";
import { TARGET_INSTANT_BASIS } from "../src/recurrence/target-instant-binding.js";

const SAMPLE_JD = 3_184_634.5;
const EOT_MODEL_ID = EQUATION_OF_TIME_MODEL_ID.ATLAS_TYME_NREL_SPA_V1;
const TEST_CIVIL_ZONE = Object.freeze({
  kind:LOCAL_ZONE_CONVENTION_KIND.CIVIL_TIMEZONE,
  policyResolved:true,
  timeZoneId:"test-resolved-zone"
});

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
    localZoneConvention:TEST_CIVIL_ZONE,
    dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    sexagenaryDayArithmetic:true,
    clockBasis:null,
    longitudeDegrees:null,
    targetYear:null,
    equationOfTimeModelId:null,
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
  assert.equal(result.localZoneBound, false);
  assert.equal(result.dayBoundary, null);
  assert.equal(result.dayBoundaryBound, false);
  assert.equal(result.longitudeDegrees, null);
  assert.equal(result.longitudeBound, false);
  assert.equal(result.equationOfTimeModel.bound, false);
  assert.equal(result.equationOfTimeModelValidatedForTarget, false);
  assert.equal(result.day.resolved, false);
  assert.equal(result.hour.resolved, false);
  assert.ok(result.day.blockers.includes("absoluteSeasonalEpoch"));
  assert.ok(result.day.blockers.includes("targetInstantBound"));
  assert.ok(result.day.blockers.includes("earthRotationBridge"));
  assert.ok(result.day.blockers.includes("localZoneBound"));
  assert.ok(result.day.blockers.includes("dayBoundaryBound"));
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

test("a UT1 target still requires a separate local-zone convention", () => {
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
  assert.equal(result.localZoneBound, false);
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "not-required");
  assert.equal(result.firstHardBlocker, "civil-zone");
});

test("a fixed-zone-from-UT1 target derives its proleptic local-zone convention without inventing future UTC policy", () => {
  const result = proof({
    targetInstant:target(TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1, { localOffsetHoursFromUt1:8 }),
    earthRotationBridge:false,
    localZoneConvention:null,
    clockBasis:DAY_HOUR_TIME_BASIS.CIVIL
  });
  assert.equal(result.targetInstant.futureUtcPolicyResolved, false);
  assert.equal(result.targetInstant.civilTimezonePolicyResolved, false);
  assert.equal(result.targetInstant.localClockCoordinateAvailable, true);
  assert.equal(result.localZoneBound, true);
  assert.equal(result.localZoneConvention.kind, LOCAL_ZONE_CONVENTION_KIND.PROLEPTIC_FIXED_OFFSET_FROM_UT1);
  assert.equal(result.localZoneConvention.derivedFromTargetInstant, true);
  assert.equal(result.localZoneConvention.futureUtcPolicyResolved, false);
  assert.equal(result.localZoneConvention.civilTimezonePolicyResolved, false);
  assert.equal(result.earthRotationBridgeRequired, false);
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "not-required");
  assert.equal(result.stages.find(stage => stage.id === "civil-zone").status, "satisfied");
  assert.equal(result.day.resolved, true);
  assert.equal(result.hour.resolved, true);
});

test("identity bypasses cross-era projection without inventing any target instant basis", () => {
  const result = currentRecurrenceDayHourProof({ identity:true, astronomyWithinRange:true });
  assert.equal(result.day.status, "identical-by-definition");
  assert.equal(result.hour.status, "identical-by-definition");
  assert.equal(result.targetInstantBound, false);
  assert.equal(result.targetInstantBasis, TARGET_INSTANT_BASIS.DATE_ONLY);
  assert.equal(result.dayBoundary, null);
  assert.equal(result.stages.find(stage => stage.id === "target-instant").status, "not-required");
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "not-required");
});

test("Day with a TT target becomes resolvable only after deterministic Earth rotation, local-zone and day rules", () => {
  const result = proof();
  assert.equal(result.day.resolved, true);
  assert.equal(result.day.blockers.length, 0);
  assert.equal(result.hour.resolved, false);
  assert.deepEqual(result.hour.blockers, ["clockBasisBound"]);
  assert.equal(result.stages.find(stage => stage.id === "earth-rotation-bridge").status, "satisfied");
  assert.equal(result.stages.find(stage => stage.id === "civil-zone").status, "satisfied");
  assert.equal(result.stages.find(stage => stage.id === "day-boundary").status, "satisfied");
});

test("both canonical Birth day-boundary conventions satisfy the typed proof requirement", () => {
  for (const dayBoundary of Object.values(DAY_BOUNDARY)) {
    const result = proof({ dayBoundary });
    assert.equal(result.dayBoundary, dayBoundary);
    assert.equal(result.dayBoundaryBound, true);
    assert.equal(result.stages.find(stage => stage.id === "day-boundary").status, "satisfied");
    assert.equal(result.day.resolved, true);
  }
});

test("legacy dayBoundaryBound boolean cannot satisfy the typed day-boundary requirement", () => {
  const result = proof({
    dayBoundary:null,
    dayBoundaryBound:true,
    clockBasis:DAY_HOUR_TIME_BASIS.CIVIL
  });
  assert.equal(result.dayBoundary, null);
  assert.equal(result.dayBoundaryBound, false);
  assert.equal(result.firstHardBlocker, "day-boundary");
  assert.equal(result.stages.find(stage => stage.id === "day-boundary").status, "unbound-convention");
  assert.equal(result.day.resolved, false);
});

test("invalid day-boundary ids fail closed instead of drifting from the Birth engine", () => {
  assert.throws(() => proof({ dayBoundary:"late-zi-ish" }), /dayBoundary/);
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
  assert.equal(result.longitudeBound, false);
  assert.equal(result.needsLongitude, false);
  assert.equal(result.needsEquationOfTime, false);
  assert.equal(result.stages.find(stage => stage.id === "longitude").status, "not-required");
  assert.equal(result.stages.find(stage => stage.id === "equation-of-time").status, "not-required");
});

test("local mean solar Hour adds typed longitude but not Equation of Time", () => {
  const blocked = proof({ clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR });
  assert.equal(blocked.hour.resolved, false);
  assert.deepEqual(blocked.hour.blockers, ["longitudeBound"]);
  assert.equal(blocked.longitudeDegrees, null);
  assert.equal(blocked.longitudeBound, false);
  assert.equal(blocked.needsLongitude, true);
  assert.equal(blocked.needsEquationOfTime, false);

  const resolved = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR,
    longitudeDegrees:121.5
  });
  assert.equal(resolved.longitudeDegrees, 121.5);
  assert.equal(resolved.longitudeBound, true);
  assert.equal(resolved.hour.resolved, true);
  assert.deepEqual(resolved.hour.blockers, []);
});

test("local apparent solar Hour requires registry-owned recurrence EoT authority", () => {
  const unbound = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    longitudeDegrees:121.5,
    targetYear:2024
  });
  assert.equal(unbound.hour.resolved, false);
  assert.deepEqual(unbound.hour.blockers, ["equationOfTimeModel"]);
  assert.equal(unbound.equationOfTimeModel.bound, false);
  assert.equal(unbound.equationOfTimeModelValidatedForTarget, false);

  const modernModel = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    longitudeDegrees:121.5,
    targetYear:2024,
    equationOfTimeModelId:EOT_MODEL_ID
  });
  assert.equal(modernModel.equationOfTimeModel.bound, true);
  assert.equal(modernModel.equationOfTimeModel.validationScope, "modern-reference-only");
  assert.equal(modernModel.equationOfTimeModel.recurrenceAuthority, false);
  assert.equal(modernModel.equationOfTimeModel.coversTarget, false);
  assert.equal(modernModel.equationOfTimeModelValidatedForTarget, false);
  assert.equal(modernModel.stages.find(stage => stage.id === "equation-of-time").status, "missing-deep-time-model");
  assert.equal(modernModel.hour.resolved, false);
});

test("modern EoT references do not silently extrapolate to year 4006", () => {
  const result = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    longitudeDegrees:121.5,
    targetYear:4006,
    equationOfTimeModelId:EOT_MODEL_ID
  });
  assert.equal(result.equationOfTimeModel.bound, true);
  assert.deepEqual(result.equationOfTimeModel.referenceYears, [2003, 2005, 2024]);
  assert.equal(result.equationOfTimeModel.recurrenceAuthority, false);
  assert.equal(result.equationOfTimeModel.coversTarget, false);
  assert.equal(result.equationOfTimeModelValidatedForTarget, false);
  assert.equal(result.firstHardBlocker, "equation-of-time");
  assert.deepEqual(result.hour.blockers, ["equationOfTimeModel"]);
  const stage = result.stages.find(item => item.id === "equation-of-time");
  assert.equal(stage.status, "missing-deep-time-model");
  assert.match(stage.detail, /modern-reference-only/);
  assert.match(stage.detail, /2003 \/ 2005 \/ 2024/);
});

test("legacy EoT booleans cannot masquerade as recurrence authority", () => {
  const result = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
    longitudeDegrees:121.5,
    targetYear:2024,
    equationOfTimeModel:true
  });
  assert.equal(result.equationOfTimeModel.bound, false);
  assert.equal(result.equationOfTimeModelValidatedForTarget, false);
  assert.equal(result.firstHardBlocker, "equation-of-time");
  assert.equal(result.hour.resolved, false);
  assert.throws(
    () => proof({
      clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR,
      longitudeDegrees:121.5,
      targetYear:2024,
      equationOfTimeModelId:true
    }),
    /canonical non-empty string/
  );
});

test("legacy longitudeBound boolean cannot masquerade as a geographic coordinate", () => {
  const result = proof({
    clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR,
    longitudeBound:true
  });
  assert.equal(result.longitudeDegrees, null);
  assert.equal(result.longitudeBound, false);
  assert.equal(result.firstHardBlocker, "longitude");
  assert.deepEqual(result.hour.blockers, ["longitudeBound"]);
});

test("invalid longitude coordinates fail closed instead of being clamped", () => {
  for (const longitudeDegrees of [Number.NaN, Number.POSITIVE_INFINITY, -181, 181]) {
    assert.throws(
      () => proof({ clockBasis:DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR, longitudeDegrees }),
      /longitudeDegrees/
    );
  }
});

test("legacy short solar clock ids fail closed instead of drifting from the calendar engine", () => {
  assert.throws(() => proof({ clockBasis:"mean-solar" }), /clockBasis/);
  assert.throws(() => proof({ clockBasis:"apparent-solar" }), /clockBasis/);
});

test("forged target-bound booleans and clock-basis ids cannot masquerade as target instant references", () => {
  assert.throws(() => proof({ targetInstant:{ bound:true } }), /target instant basis/);
  assert.throws(() => proof({ targetInstant:{ basis:DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR, julianDay:SAMPLE_JD } }), /target instant basis/);
});

test("legacy civilZoneBound boolean cannot satisfy the typed local-zone requirement", () => {
  const result = dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstant:target(TARGET_INSTANT_BASIS.UT1_JULIAN_DAY),
    earthRotationBridge:false,
    earthRotationEstimateAvailable:false,
    civilZoneBound:true,
    dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    sexagenaryDayArithmetic:true,
    clockBasis:DAY_HOUR_TIME_BASIS.CIVIL,
    longitudeDegrees:null,
    targetYear:null,
    equationOfTimeModelId:null,
    hourBranchRule:true,
    fiveRatsRule:true
  });
  assert.equal(result.localZoneBound, false);
  assert.equal(result.firstHardBlocker, "civil-zone");
  assert.equal(result.day.resolved, false);
});

test("invalid clock basis fails closed", () => {
  assert.throws(() => proof({ clockBasis:"sundial-ish" }), /clockBasis/);
});
