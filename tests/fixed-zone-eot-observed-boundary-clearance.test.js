import test from "node:test";
import assert from "node:assert/strict";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import { year4006SwissEotObservedBoundaryClearance } from "../src/recurrence/equation-of-time-observed-boundary-clearance.js";
import {
  YEAR_4006_FIXED_ZONE_EOT_CLEARANCE_CONTRACT,
  year4006FixedZoneEotObservedBoundaryClearance
} from "../src/recurrence/fixed-zone-eot-observed-boundary-clearance.js";
import { fixedZoneUt1ApparentSolarPointEstimate } from "../src/recurrence/fixed-zone-ut1-apparent-solar.js";

const LOCAL_CLOCK = Object.freeze({
  year:4006,
  month:9,
  day:13,
  hour:12,
  minute:0,
  second:0
});

const LONGITUDE = 120;
const OFFSET = 8;

test("year-4006 fixed-UT1 composition evaluates the real apparent-solar point against the Swiss observed envelope", () => {
  const result = year4006FixedZoneEotObservedBoundaryClearance(
    LOCAL_CLOCK,
    LONGITUDE,
    OFFSET
  );

  assert.equal(result.targetYear, 4006);
  assert.equal(result.inputClockSemantics, "proleptic-gregorian-fixed-zone-from-ut1");
  assert.equal(result.longitudeCorrectionMinutes, 0);
  assert.equal(result.evidenceId, "swiss-ephemeris-eot-4006-dense-v2");
  assert.equal(result.productionModelId, "atlas-tyme-nrel-spa-v1");
  assert.equal(result.cadenceMinutes, 5);
  assert.equal(result.samples, 105120);
  assert.equal(result.observedEnvelopeSeconds, 1.4929317113205443);
  assert.equal(result.clearsObservedEnvelope, true);
  assert.equal(result.status, "clears-observed-eot-envelope-only");
  assert.ok(result.remainingObservedMarginSeconds > 0);
  assert.equal(result.deterministicMembership, false);
  assert.equal(result.recurrenceAuthorityGranted, false);
});

test("composition delegates point projection and boundary semantics without reinterpreting either layer", () => {
  const point = fixedZoneUt1ApparentSolarPointEstimate(LOCAL_CLOCK, 121.5, OFFSET);
  const direct = year4006SwissEotObservedBoundaryClearance(
    point.apparentSolarClock,
    { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );
  const composed = year4006FixedZoneEotObservedBoundaryClearance(
    LOCAL_CLOCK,
    121.5,
    OFFSET,
    { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );

  assert.deepEqual(composed.apparentSolarClock, point.apparentSolarClock);
  assert.equal(composed.ut1JulianDay, point.ut1JulianDay);
  assert.equal(composed.equationOfTimeMinutes, point.equationOfTimeMinutes);
  assert.equal(composed.dayBoundary, direct.dayBoundary);
  assert.equal(composed.hourBranchMarginSeconds, direct.hourBranchMarginSeconds);
  assert.equal(composed.dayBoundaryMarginSeconds, direct.dayBoundaryMarginSeconds);
  assert.equal(composed.governingMarginSeconds, direct.governingMarginSeconds);
  assert.equal(composed.remainingObservedMarginSeconds, direct.remainingStableMarginSeconds);
  assert.equal(composed.clearsObservedEnvelope, direct.clearsObservedEnvelope);
  assert.deepEqual(composed.ambiguousKinds, direct.ambiguousKinds);
  assert.equal(composed.status, direct.status);
  assert.strictEqual(composed.pointEstimate.method, point.method);
  assert.strictEqual(composed.boundaryClearance.evidenceId, direct.evidenceId);
});

test("year-4006 observed-envelope composition fails closed for other target years", () => {
  for (const year of [2024, 4005, 4007]) {
    assert.throws(
      () => year4006FixedZoneEotObservedBoundaryClearance(
        { ...LOCAL_CLOCK, year },
        LONGITUDE,
        OFFSET
      ),
      /year-4006/
    );
  }
});

test("composed clearance keeps all omitted uncertainty channels explicit", () => {
  const result = year4006FixedZoneEotObservedBoundaryClearance(
    LOCAL_CLOCK,
    LONGITUDE,
    OFFSET
  );

  assert.equal(result.empiricalGridOnly, true);
  assert.equal(result.continuousUpperBound, false);
  assert.equal(result.coversOnlyEquationOfTimeResidual, true);
  assert.equal(result.includesEarthRotationUncertainty, false);
  assert.equal(result.includesLongitudeUncertainty, false);
  assert.equal(result.includesZoneOrInputClockUncertainty, false);
  assert.equal(result.futureUtcPolicyResolved, false);
  assert.equal(result.civilTimezonePolicyResolved, false);
});

test("composition contract cannot grant deterministic membership or recurrence authority", () => {
  const contract = YEAR_4006_FIXED_ZONE_EOT_CLEARANCE_CONTRACT;
  assert.equal(contract.targetYear, 4006);
  assert.equal(contract.pointEstimateProvider, "recurrence-fixed-zone-ut1-apparent-solar-point-estimate-v1");
  assert.equal(contract.evidenceClearanceProvider, "year-4006-swiss-eot-observed-boundary-clearance-v1");
  assert.equal(contract.uncertaintyContribution, "equation-of-time-model-residual-only");
  assert.equal(contract.empiricalGridOnly, true);
  assert.equal(contract.continuousUpperBound, false);
  assert.equal(contract.grantsDeterministicMembership, false);
  assert.equal(contract.grantsRecurrenceAuthority, false);
});
