import test from "node:test";
import assert from "node:assert/strict";
import {
  DATE_ONLY_TARGET_INSTANT,
  TARGET_INSTANT_BASIS,
  TARGET_INSTANT_BINDING_CONTRACT,
  targetInstantBinding
} from "../src/recurrence/target-instant-binding.js";

const JD = 3_184_634.5;

test("missing target instant stays explicitly date-only and unbound", () => {
  const binding = targetInstantBinding();
  assert.equal(binding, DATE_ONLY_TARGET_INSTANT);
  assert.equal(binding.basis, TARGET_INSTANT_BASIS.DATE_ONLY);
  assert.equal(binding.bound, false);
  assert.equal(binding.inputTimeScale, null);
  assert.equal(binding.deterministicPhysicalInstant, false);
});

test("TT Julian day is a bound dynamical coordinate that still requires Earth rotation", () => {
  const binding = targetInstantBinding({ basis:TARGET_INSTANT_BASIS.TT_JULIAN_DAY, julianDay:JD });
  assert.equal(binding.bound, true);
  assert.equal(binding.inputTimeScale, "TT");
  assert.equal(binding.julianDay, JD);
  assert.equal(binding.requiresEarthRotationBridge, true);
  assert.equal(binding.earthRotationCoordinateAvailable, false);
  assert.equal(binding.futureUtcPolicyResolved, false);
});

test("UT1 Julian day is already an Earth-rotation coordinate without implying a civil clock", () => {
  const binding = targetInstantBinding({ basis:TARGET_INSTANT_BASIS.UT1_JULIAN_DAY, julianDay:JD });
  assert.equal(binding.bound, true);
  assert.equal(binding.inputTimeScale, "UT1");
  assert.equal(binding.requiresEarthRotationBridge, false);
  assert.equal(binding.earthRotationCoordinateAvailable, true);
  assert.equal(binding.localClockCoordinateAvailable, false);
  assert.equal(binding.civilTimezonePolicyResolved, false);
});

test("fixed-zone-from-UT1 requires an explicit bounded offset and remains proleptic", () => {
  const binding = targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1,
    julianDay:JD,
    localOffsetHoursFromUt1:8
  });
  assert.equal(binding.bound, true);
  assert.equal(binding.inputTimeScale, "UT1");
  assert.equal(binding.localClockCoordinateAvailable, true);
  assert.equal(binding.localOffsetHoursFromUt1, 8);
  assert.equal(binding.offsetSemantics, "proleptic-fixed-local-offset-from-ut1");
  assert.equal(binding.futureUtcPolicyResolved, false);
  assert.equal(binding.civilTimezonePolicyResolved, false);

  assert.throws(() => targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1,
    julianDay:JD
  }), /localOffsetHoursFromUt1/);
  assert.throws(() => targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1,
    julianDay:JD,
    localOffsetHoursFromUt1:15
  }), /between -14 and \+14/);
});

test("future UTC, civil clocks and Day Hour clock bases are not target-instant reference bases", () => {
  for (const basis of ["utc", "civil", "local-mean-solar", "local-apparent-solar"]) {
    assert.throws(() => targetInstantBinding({ basis, julianDay:JD }), /target instant basis/);
  }
});

test("a forged bound flag cannot bypass basis validation", () => {
  assert.throws(() => targetInstantBinding({ bound:true, julianDay:JD }), /target instant basis/);
});

test("target instant contract records the future-policy boundary explicitly", () => {
  assert.equal(TARGET_INSTANT_BINDING_CONTRACT.rejectsImplicitFutureUtc, true);
  assert.equal(TARGET_INSTANT_BINDING_CONTRACT.rejectsImplicitCivilTimezone, true);
  assert.equal(TARGET_INSTANT_BINDING_CONTRACT.separatesTargetInstantFromDayHourClockBasis, true);
  assert.deepEqual(TARGET_INSTANT_BINDING_CONTRACT.fixedZoneOffsetRangeHours, [-14, 14]);
});
