import test from "node:test";
import assert from "node:assert/strict";
import { localApparentSolarTime } from "../src/astronomy/apparent-solar-time.js";
import {
  FIXED_ZONE_UT1_APPARENT_SOLAR_CONTRACT,
  fixedZoneUt1ApparentSolarPointEstimate
} from "../src/recurrence/fixed-zone-ut1-apparent-solar.js";

const TARGET_4006 = Object.freeze({
  year:4006,
  month:9,
  day:13,
  hour:12,
  minute:34,
  second:56
});

function assertNear(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`
  );
}

test("fixed-zone recurrence projection aligns the EoT engine timeline to typed UT1", () => {
  const result = fixedZoneUt1ApparentSolarPointEstimate(TARGET_4006, 121.5, 8);

  assert.equal(result.method, "fixed-zone-from-ut1-local-apparent-solar-point-estimate");
  assert.equal(result.inputClockSemantics, "proleptic-gregorian-fixed-zone-from-ut1");
  assert.equal(result.targetInstant.basis, "fixed-zone-from-ut1");
  assert.equal(result.targetInstant.localOffsetHoursFromUt1, 8);
  assert.equal(result.longitudeDegrees, 121.5);
  assert.ok(result.timelineAlignmentSeconds <= result.timelineAlignmentToleranceSeconds);
  assertNear(result.equationTimelineJulianDay, result.ut1JulianDay, 1e-7, "EoT timeline JD vs UT1 JD");
  assert.equal(result.futureUtcPolicyResolved, false);
  assert.equal(result.civilTimezonePolicyResolved, false);
  assert.equal(result.deterministicMembership, false);
  assert.equal(result.recurrenceAuthorityGranted, false);
});

test("fixed UT1 +08:00 at E120 has zero longitude correction to local mean solar time", () => {
  const result = fixedZoneUt1ApparentSolarPointEstimate(TARGET_4006, 120, 8);

  assert.equal(result.longitudeCorrectionMinutes, 0);
  assertNear(result.meanSolarJulianDay, result.localJulianDay, 1e-10, "mean solar JD vs fixed-zone local JD");
  assert.deepEqual(result.meanSolarClock, TARGET_4006);
});

test("local apparent solar point estimate adds the production Equation of Time after LMST", () => {
  const result = fixedZoneUt1ApparentSolarPointEstimate(TARGET_4006, 121.5, 8);
  const appliedMinutes = (result.apparentSolarJulianDay - result.meanSolarJulianDay) * 1440;

  assertNear(appliedMinutes, result.equationOfTimeMinutes, 1e-6, "applied EoT minutes");
  assertNear(
    result.totalCorrectionMinutes,
    result.longitudeCorrectionMinutes + result.equationOfTimeMinutes,
    1e-12,
    "total correction"
  );
  assert.equal(result.equationOfTimeMethod, "tyme-apparent-sun+nrel-spa-a1");
});

test("modern fixed-UT1 projection is numerically identical to the existing civil adapter for the same offset coordinate", () => {
  const input = { year:2024, month:6, day:1, hour:9, minute:8, second:7 };
  const longitude = 121.5;
  const offset = 8;
  const recurrence = fixedZoneUt1ApparentSolarPointEstimate(input, longitude, offset);
  const civil = localApparentSolarTime(input, longitude, offset);

  assertNear(recurrence.longitudeCorrectionMinutes, civil.longitudeCorrectionMinutes, 1e-12, "longitude correction");
  assertNear(recurrence.equationOfTimeMinutes, civil.equationOfTimeMinutes, 1e-12, "EoT");
  assertNear(recurrence.totalCorrectionMinutes, civil.totalCorrectionMinutes, 1e-12, "total correction");
  assert.deepEqual(recurrence.meanSolarClock, civil.meanSolar);
  assert.deepEqual(recurrence.apparentSolarClock, civil.apparentSolar);
});

test("fixed-zone recurrence solar adapter fails closed without a valid longitude", () => {
  for (const longitude of [null, Number.NaN, -181, 181]) {
    assert.throws(
      () => fixedZoneUt1ApparentSolarPointEstimate(TARGET_4006, longitude, 8),
      /longitudeDegrees/
    );
  }
});

test("fixed-zone recurrence solar contract does not claim UTC policy or pillar authority", () => {
  const contract = FIXED_ZONE_UT1_APPARENT_SOLAR_CONTRACT;
  assert.equal(contract.inputTimeScale, "UT1");
  assert.equal(contract.equationTimelineMustMatchTypedUt1, true);
  assert.equal(contract.equationEngineUtcFieldUsedAsNumericalCoordinateOnly, true);
  assert.equal(contract.futureUtcPolicyResolved, false);
  assert.equal(contract.civilTimezonePolicyResolved, false);
  assert.equal(contract.grantsDeterministicMembership, false);
  assert.equal(contract.grantsRecurrenceAuthority, false);
});
