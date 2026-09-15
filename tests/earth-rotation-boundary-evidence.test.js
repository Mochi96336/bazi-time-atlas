import test from "node:test";
import assert from "node:assert/strict";
import { seasonalEventsForCatalogueYear } from "../src/astronomy/de441-seasonal-event-data-product.js";
import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../src/astronomy/equation-of-time-4006-swiss-evidence.js";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import {
  EARTH_ROTATION_BOUNDARY_EVIDENCE_CONTRACT,
  deepTimeEarthRotationOneSigmaBoundaryAssessment
} from "../src/recurrence/earth-rotation-boundary-evidence.js";

const year4006Events = seasonalEventsForCatalogueYear(4006);
const swissProductionEotMaxAbsSeconds =
  EQUATION_OF_TIME_4006_SWISS_EVIDENCE.target4006.dense.productionErrorSeconds.maxAbs;

test("all year-4006 seasonal TT epochs exceed the best-case Hour margin at one sigma", () => {
  assert.equal(year4006Events.length, 24);

  // 12:00 is a best-case Hour position: exactly midway between the canonical
  // 11:00 and 13:00 branch boundaries, so its nearest-boundary margin is the
  // maximum possible 3600 s. If ±1σ fails here, no other clock phase can pass.
  for (const event of year4006Events) {
    const result = deepTimeEarthRotationOneSigmaBoundaryAssessment(
      event.ttJulianDay,
      { hour:12, minute:0, second:0 },
      { dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY }
    );

    assert.equal(result.hourBranchMarginSeconds, 3600);
    assert.ok(result.oneSigmaUncertaintySeconds > 6000);
    assert.equal(result.hourBranchStableAtOneSigma, false);
    assert.equal(result.dayBoundaryStableAtOneSigma, true);
    assert.equal(result.dayHourStableAtOneSigma, false);
    assert.deepEqual(result.ambiguousKinds, ["hour-branch"]);
    assert.equal(result.deterministicUt1, false);
    assert.equal(result.deterministicMembership, false);
    assert.equal(result.recurrenceAuthorityGranted, false);
  }
});

test("year-4006 Earth-rotation uncertainty dominates the corrected Swiss EoT residual by orders of magnitude", () => {
  const result = deepTimeEarthRotationOneSigmaBoundaryAssessment(
    year4006Events[12].ttJulianDay,
    { hour:12, minute:0, second:0 }
  );

  assert.ok(result.oneSigmaUncertaintySeconds > 6000);
  assert.ok(result.oneSigmaUncertaintySeconds / swissProductionEotMaxAbsSeconds > 4000);
  assert.equal(result.uncertaintyContribution, "tt-to-ut1-earth-rotation");
  assert.equal(result.uncertaintySemantics, "one-standard-error-not-hard-bound");
  assert.equal(result.statisticalIntervalOnly, true);
  assert.equal(result.hardUpperBound, false);
});

test("near Zi initial the one-sigma interval reaches both Hour and Day boundaries", () => {
  const result = deepTimeEarthRotationOneSigmaBoundaryAssessment(
    year4006Events[12].ttJulianDay,
    { hour:23, minute:30, second:0 },
    { dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY }
  );

  assert.equal(result.hourBranchMarginSeconds, 1800);
  assert.equal(result.dayBoundaryMarginSeconds, 1800);
  assert.equal(result.hourBranchStableAtOneSigma, false);
  assert.equal(result.dayBoundaryStableAtOneSigma, false);
  assert.deepEqual(result.ambiguousKinds, ["hour-branch", "day-boundary"]);
});

test("one-sigma clearance would still not be a deterministic hard-bound claim", () => {
  const contract = EARTH_ROTATION_BOUNDARY_EVIDENCE_CONTRACT;
  assert.equal(contract.uncertaintySemantics, "one-standard-error-not-hard-bound");
  assert.equal(contract.statisticalIntervalOnly, true);
  assert.equal(contract.hardUpperBound, false);
  assert.equal(contract.grantsDeterministicMembership, false);
  assert.equal(contract.grantsRecurrenceAuthority, false);
  assert.equal(
    contract.delegatesBoundarySemanticsTo,
    "day-hour-local-clock-boundary-stability-v1"
  );
});
