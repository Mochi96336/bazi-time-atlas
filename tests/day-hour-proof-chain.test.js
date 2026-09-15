import test from "node:test";
import assert from "node:assert/strict";
import {
  currentRecurrenceDayHourProof,
  dayHourResolutionProof
} from "../src/recurrence/day-hour-proof-chain.js";

test("current deep-time recurrence defaults to missing absolute seasonal epoch and target instant", () => {
  const proof = currentRecurrenceDayHourProof({ identity:false, astronomyWithinRange:true });
  assert.equal(proof.firstHardBlocker, "absolute-seasonal-epoch");
  assert.equal(proof.targetInstantBound, false);
  assert.equal(proof.day.resolved, false);
  assert.equal(proof.hour.resolved, false);
  assert.ok(proof.day.blockers.includes("absoluteSeasonalEpoch"));
  assert.ok(proof.day.blockers.includes("targetInstantBound"));
  assert.ok(proof.day.blockers.includes("earthRotationBridge"));
  assert.ok(proof.day.blockers.includes("civilZoneBound"));
  assert.ok(proof.day.blockers.includes("dayBoundaryBound"));
  assert.equal(proof.stages.find(stage => stage.id === "relative-term-geometry").status, "satisfied");
  assert.equal(proof.stages.find(stage => stage.id === "target-instant").status, "unbound-convention");
  assert.equal(proof.stages.find(stage => stage.id === "sexagenary-day-arithmetic").status, "satisfied");
});

test("date-only recurrence stops at target instant even when year-4006 Earth-rotation capability exists", () => {
  const proof = currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    earthRotationEstimateAvailable:true
  });
  assert.equal(proof.firstHardBlocker, "target-instant");
  assert.equal(proof.targetInstantBound, false);
  assert.equal(proof.earthRotationEstimateCapability, true);
  assert.equal(proof.earthRotationEstimateAvailable, false);
  assert.equal(proof.day.resolved, false);
  assert.equal(proof.hour.resolved, false);
  assert.equal(proof.day.blockers.includes("absoluteSeasonalEpoch"), false);
  assert.ok(proof.day.blockers.includes("targetInstantBound"));
  assert.ok(proof.day.blockers.includes("earthRotationBridge"));
  assert.equal(proof.stages.find(stage => stage.id === "absolute-seasonal-epoch").status, "satisfied");
  assert.equal(proof.stages.find(stage => stage.id === "target-instant").status, "unbound-convention");
  assert.equal(proof.stages.find(stage => stage.id === "earth-rotation-bridge").status, "blocked");
});

test("once a target instant is bound, an uncertain UT1 estimate becomes the next hard blocker", () => {
  const proof = currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:true,
    earthRotationEstimateAvailable:true
  });
  assert.equal(proof.firstHardBlocker, "earth-rotation-bridge");
  assert.equal(proof.targetInstantBound, true);
  assert.equal(proof.earthRotationEstimateCapability, true);
  assert.equal(proof.earthRotationEstimateAvailable, true);
  assert.equal(proof.stages.find(stage => stage.id === "target-instant").status, "satisfied");
  assert.equal(proof.stages.find(stage => stage.id === "earth-rotation-bridge").status, "uncertain-estimate");
});

test("absolute epoch and target instant without any Earth-rotation estimate still report a missing deep-time model", () => {
  const proof = currentRecurrenceDayHourProof({
    identity:false,
    astronomyWithinRange:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:true,
    earthRotationEstimateAvailable:false
  });
  assert.equal(proof.firstHardBlocker, "earth-rotation-bridge");
  assert.equal(proof.stages.find(stage => stage.id === "earth-rotation-bridge").status, "missing-deep-time-model");
});

test("identity bypasses cross-era projection without inventing a target instant", () => {
  const proof = currentRecurrenceDayHourProof({ identity:true, astronomyWithinRange:true });
  assert.equal(proof.day.status, "identical-by-definition");
  assert.equal(proof.hour.status, "identical-by-definition");
  assert.equal(proof.day.resolved, true);
  assert.equal(proof.hour.resolved, true);
  assert.equal(proof.targetInstantBound, false);
  assert.equal(proof.stages.find(stage => stage.id === "target-instant").status, "not-required");
  assert.equal(proof.stages.find(stage => stage.id === "absolute-seasonal-epoch").status, "missing-deep-time-model");
});

test("Day becomes resolvable only after target instant, deterministic Earth rotation and civil day rules are bound", () => {
  const proof = dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:true,
    earthRotationBridge:true,
    earthRotationEstimateAvailable:true,
    civilZoneBound:true,
    dayBoundaryBound:true,
    sexagenaryDayArithmetic:true,
    clockBasis:null,
    longitudeBound:false,
    equationOfTimeModel:false,
    hourBranchRule:true,
    fiveRatsRule:true
  });
  assert.equal(proof.day.resolved, true);
  assert.equal(proof.day.blockers.length, 0);
  assert.equal(proof.hour.resolved, false);
  assert.deepEqual(proof.hour.blockers, ["clockBasisBound"]);
  assert.equal(proof.stages.find(stage => stage.id === "target-instant").status, "satisfied");
  assert.equal(proof.stages.find(stage => stage.id === "earth-rotation-bridge").status, "satisfied");
});

test("even a deterministic Earth-rotation model cannot resolve a date-only recurrence", () => {
  const proof = dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:false,
    earthRotationBridge:true,
    earthRotationEstimateAvailable:true,
    civilZoneBound:true,
    dayBoundaryBound:true,
    sexagenaryDayArithmetic:true,
    clockBasis:"civil",
    longitudeBound:false,
    equationOfTimeModel:false,
    hourBranchRule:true,
    fiveRatsRule:true
  });
  assert.equal(proof.firstHardBlocker, "target-instant");
  assert.equal(proof.day.resolved, false);
  assert.equal(proof.hour.resolved, false);
  assert.deepEqual(proof.day.blockers, ["targetInstantBound"]);
  assert.equal(proof.stages.find(stage => stage.id === "earth-rotation-bridge").status, "blocked");
});

test("civil-clock Hour needs no longitude or Equation of Time once Day is resolved", () => {
  const proof = dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:true,
    earthRotationBridge:true,
    civilZoneBound:true,
    dayBoundaryBound:true,
    sexagenaryDayArithmetic:true,
    clockBasis:"civil",
    longitudeBound:false,
    equationOfTimeModel:false,
    hourBranchRule:true,
    fiveRatsRule:true
  });
  assert.equal(proof.day.resolved, true);
  assert.equal(proof.hour.resolved, true);
  assert.equal(proof.needsLongitude, false);
  assert.equal(proof.needsEquationOfTime, false);
  assert.equal(proof.stages.find(stage => stage.id === "longitude").status, "not-required");
  assert.equal(proof.stages.find(stage => stage.id === "equation-of-time").status, "not-required");
});

test("mean-solar Hour adds longitude but not Equation of Time", () => {
  const proof = dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:true,
    earthRotationBridge:true,
    civilZoneBound:true,
    dayBoundaryBound:true,
    sexagenaryDayArithmetic:true,
    clockBasis:"mean-solar",
    longitudeBound:false,
    equationOfTimeModel:false,
    hourBranchRule:true,
    fiveRatsRule:true
  });
  assert.equal(proof.hour.resolved, false);
  assert.deepEqual(proof.hour.blockers, ["longitudeBound"]);
  assert.equal(proof.needsLongitude, true);
  assert.equal(proof.needsEquationOfTime, false);
});

test("apparent-solar Hour requires both longitude and an epoch-valid Equation of Time model", () => {
  const blocked = dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:true,
    earthRotationBridge:true,
    civilZoneBound:true,
    dayBoundaryBound:true,
    sexagenaryDayArithmetic:true,
    clockBasis:"apparent-solar",
    longitudeBound:true,
    equationOfTimeModel:false,
    hourBranchRule:true,
    fiveRatsRule:true
  });
  assert.equal(blocked.hour.resolved, false);
  assert.deepEqual(blocked.hour.blockers, ["equationOfTimeModel"]);

  const resolved = dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:true,
    earthRotationBridge:true,
    civilZoneBound:true,
    dayBoundaryBound:true,
    sexagenaryDayArithmetic:true,
    clockBasis:"apparent-solar",
    longitudeBound:true,
    equationOfTimeModel:true,
    hourBranchRule:true,
    fiveRatsRule:true
  });
  assert.equal(resolved.hour.resolved, true);
});

test("invalid clock basis fails closed", () => {
  assert.throws(() => dayHourResolutionProof({
    relativeTermGeometry:true,
    absoluteSeasonalEpoch:true,
    targetInstantBound:true,
    earthRotationBridge:true,
    civilZoneBound:true,
    dayBoundaryBound:true,
    sexagenaryDayArithmetic:true,
    clockBasis:"sundial-ish",
    longitudeBound:true,
    equationOfTimeModel:true,
    hourBranchRule:true,
    fiveRatsRule:true
  }), /clockBasis/);
});
