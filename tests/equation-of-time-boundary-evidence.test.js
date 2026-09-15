import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../src/astronomy/equation-of-time-4006-swiss-evidence.js";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import {
  YEAR_4006_SWISS_BOUNDARY_EVIDENCE_CONTRACT,
  year4006SwissObservedDayHourStability
} from "../src/recurrence/equation-of-time-boundary-evidence.js";

const observedMax = EQUATION_OF_TIME_4006_SWISS_EVIDENCE
  .target4006.dense.productionErrorSeconds.maxAbs;

test("adapter propagates the exact corrected Swiss observed production envelope", () => {
  const result = year4006SwissObservedDayHourStability({ hour:12, minute:0, second:0 });
  assert.equal(result.observedErrorEnvelopeSeconds, observedMax);
  assert.equal(result.uncertaintySeconds, observedMax);
  assert.equal(result.cadenceMinutes, 5);
  assert.equal(result.samples, 105120);
  assert.equal(result.evidenceId, "swiss-ephemeris-eot-4006-dense-v2");
  assert.equal(result.evidenceKind, "empirical-grid-observed-production-max");
});

test("ordinary candidate may clear the observed envelope without becoming deterministic", () => {
  const result = year4006SwissObservedDayHourStability({ hour:12, minute:0, second:0 });
  assert.equal(result.hourBranchMarginSeconds, 3600);
  assert.equal(result.stableAgainstObservedEnvelope, true);
  assert.equal(result.status, "stable-against-observed-envelope-only");
  assert.equal(result.continuousUpperBound, false);
  assert.equal(result.deterministicMembership, false);
  assert.equal(result.recurrenceAuthorityGranted, false);
});

test("near an ordinary Hour boundary the observed envelope keeps membership ambiguous", () => {
  const result = year4006SwissObservedDayHourStability(
    { hour:0, minute:59, second:59 },
    { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );
  assert.equal(result.hourBranchMarginSeconds, 1);
  assert.equal(result.hourBranchStable, false);
  assert.equal(result.dayBoundaryStable, true);
  assert.deepEqual(result.ambiguousKinds, ["hour-branch"]);
  assert.equal(result.stableAgainstObservedEnvelope, false);
  assert.equal(result.status, "boundary-ambiguous-under-observed-envelope");
});

test("civil midnight can remain the governing ambiguity even with a stable Hour branch", () => {
  const result = year4006SwissObservedDayHourStability(
    { hour:23, minute:59, second:59 },
    { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );
  assert.equal(result.hourBranchStable, true);
  assert.equal(result.dayBoundaryMarginSeconds, 1);
  assert.equal(result.dayBoundaryStable, false);
  assert.deepEqual(result.ambiguousKinds, ["day-boundary"]);
  assert.equal(result.stableAgainstObservedEnvelope, false);
});

test("Zi-initial boundary propagates ambiguity to both Day and Hour together", () => {
  const result = year4006SwissObservedDayHourStability(
    { hour:22, minute:59, second:59 },
    { dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY }
  );
  assert.equal(result.hourBranchMarginSeconds, 1);
  assert.equal(result.dayBoundaryMarginSeconds, 1);
  assert.deepEqual(result.ambiguousKinds, ["hour-branch", "day-boundary"]);
  assert.equal(result.stableAgainstObservedEnvelope, false);
});

test("contract keeps empirical evidence distinct from continuous authority", () => {
  assert.equal(YEAR_4006_SWISS_BOUNDARY_EVIDENCE_CONTRACT.targetYear, 4006);
  assert.equal(YEAR_4006_SWISS_BOUNDARY_EVIDENCE_CONTRACT.continuousUpperBound, false);
  assert.equal(YEAR_4006_SWISS_BOUNDARY_EVIDENCE_CONTRACT.grantsRecurrenceAuthority, false);
  assert.equal(
    YEAR_4006_SWISS_BOUNDARY_EVIDENCE_CONTRACT.delegatesBoundarySemanticsTo,
    "day-hour-local-clock-boundary-stability-v1"
  );
});
