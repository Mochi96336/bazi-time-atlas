import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../src/astronomy/equation-of-time-4006-swiss-evidence.js";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import {
  YEAR_4006_SWISS_EOT_BOUNDARY_CLEARANCE_CONTRACT,
  year4006SwissEotObservedBoundaryClearance
} from "../src/recurrence/equation-of-time-observed-boundary-clearance.js";

const dense = EQUATION_OF_TIME_4006_SWISS_EVIDENCE.target4006.dense;
const observedMax = dense.productionErrorSeconds.maxAbs;

test("clearance uses the exact corrected Swiss observed production envelope", () => {
  const result = year4006SwissEotObservedBoundaryClearance({ hour:12, minute:0, second:0 });
  assert.equal(result.evidenceId, "swiss-ephemeris-eot-4006-dense-v2");
  assert.equal(result.productionModelId, "atlas-tyme-nrel-spa-v1");
  assert.equal(result.observedEnvelopeSeconds, observedMax);
  assert.equal(result.uncertaintySeconds, observedMax);
  assert.equal(result.cadenceMinutes, 5);
  assert.equal(result.samples, 105120);
  assert.equal(result.inputClockSemantics, "local-apparent-solar-point-estimate");
});

test("a midpoint clock clears the observed EoT envelope but gains no deterministic authority", () => {
  const result = year4006SwissEotObservedBoundaryClearance({ hour:12, minute:0, second:0 });
  assert.equal(result.hourBranchMarginSeconds, 3600);
  assert.equal(result.clearsObservedEnvelope, true);
  assert.equal(result.status, "clears-observed-eot-envelope-only");
  assert.equal(result.empiricalGridOnly, true);
  assert.equal(result.continuousUpperBound, false);
  assert.equal(result.coversOnlyEquationOfTimeResidual, true);
  assert.equal(result.includesEarthRotationUncertainty, false);
  assert.equal(result.includesLongitudeUncertainty, false);
  assert.equal(result.includesZoneOrInputClockUncertainty, false);
  assert.equal(result.deterministicMembership, false);
  assert.equal(result.recurrenceAuthorityGranted, false);
});

test("an apparent-solar clock one second from an Hour boundary fails observed-envelope clearance", () => {
  const result = year4006SwissEotObservedBoundaryClearance(
    { hour:0, minute:59, second:59 },
    { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );
  assert.equal(result.hourBranchMarginSeconds, 1);
  assert.equal(result.dayBoundaryStable, true);
  assert.equal(result.hourBranchStable, false);
  assert.deepEqual(result.ambiguousKinds, ["hour-branch"]);
  assert.equal(result.clearsObservedEnvelope, false);
  assert.equal(result.status, "observed-eot-envelope-reaches-boundary");
  assert.equal(result.deterministicMembership, false);
});

test("civil midnight remains an independent Day boundary for EoT clearance", () => {
  const result = year4006SwissEotObservedBoundaryClearance(
    { hour:23, minute:59, second:59 },
    { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );
  assert.equal(result.hourBranchStable, true);
  assert.equal(result.dayBoundaryMarginSeconds, 1);
  assert.equal(result.dayBoundaryStable, false);
  assert.deepEqual(result.ambiguousKinds, ["day-boundary"]);
  assert.equal(result.clearsObservedEnvelope, false);
});

test("clearance contract cannot be promoted into a continuous bound or recurrence authority", () => {
  const contract = YEAR_4006_SWISS_EOT_BOUNDARY_CLEARANCE_CONTRACT;
  assert.equal(contract.targetYear, 4006);
  assert.equal(contract.empiricalGridOnly, true);
  assert.equal(contract.continuousUpperBound, false);
  assert.equal(contract.coversOnlyEquationOfTimeResidual, true);
  assert.equal(contract.grantsDeterministicMembership, false);
  assert.equal(contract.grantsRecurrenceAuthority, false);
  assert.equal(contract.inputClockSemantics, "local-apparent-solar-point-estimate");
  assert.equal(
    contract.delegatesBoundarySemanticsTo,
    "day-hour-local-clock-boundary-stability-v1"
  );
});
