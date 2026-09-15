import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_ZONE_CONVENTION_CONTRACT,
  LOCAL_ZONE_CONVENTION_KIND,
  localZoneConventionBinding
} from "../src/recurrence/local-zone-convention.js";
import { TARGET_INSTANT_BASIS } from "../src/recurrence/target-instant-binding.js";

const JD = 3_184_634.5;

function target(basis, extra = {}) {
  return { basis, julianDay:JD, ...extra };
}

test("unbound UT1 target does not invent a local-zone convention", () => {
  const zone = localZoneConventionBinding(null, target(TARGET_INSTANT_BASIS.UT1_JULIAN_DAY));
  assert.equal(zone.bound, false);
  assert.equal(zone.kind, null);
  assert.equal(zone.civilTimezonePolicyResolved, false);
});

test("fixed-zone target derives the same proleptic local-zone convention", () => {
  const zone = localZoneConventionBinding(null, target(
    TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1,
    { localOffsetHoursFromUt1:8 }
  ));
  assert.equal(zone.bound, true);
  assert.equal(zone.kind, LOCAL_ZONE_CONVENTION_KIND.PROLEPTIC_FIXED_OFFSET_FROM_UT1);
  assert.equal(zone.localOffsetHoursFromUt1, 8);
  assert.equal(zone.localClockCoordinateAvailable, true);
  assert.equal(zone.derivedFromTargetInstant, true);
  assert.equal(zone.futureUtcPolicyResolved, false);
  assert.equal(zone.civilTimezonePolicyResolved, false);
});

test("explicit fixed-zone convention must match a fixed-zone target offset", () => {
  const fixedTarget = target(TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1, { localOffsetHoursFromUt1:8 });
  assert.throws(() => localZoneConventionBinding({
    kind:LOCAL_ZONE_CONVENTION_KIND.PROLEPTIC_FIXED_OFFSET_FROM_UT1,
    localOffsetHoursFromUt1:9
  }, fixedTarget), /must match fixed-zone target instant offset/);
});

test("civil timezone requires an explicitly resolved policy and non-empty id", () => {
  assert.throws(() => localZoneConventionBinding({
    kind:LOCAL_ZONE_CONVENTION_KIND.CIVIL_TIMEZONE,
    timeZoneId:"Asia/Taipei"
  }, target(TARGET_INSTANT_BASIS.UT1_JULIAN_DAY)), /policyResolved=true/);

  assert.throws(() => localZoneConventionBinding({
    kind:LOCAL_ZONE_CONVENTION_KIND.CIVIL_TIMEZONE,
    policyResolved:true,
    timeZoneId:""
  }, target(TARGET_INSTANT_BASIS.UT1_JULIAN_DAY)), /non-empty timeZoneId/);

  const zone = localZoneConventionBinding({
    kind:LOCAL_ZONE_CONVENTION_KIND.CIVIL_TIMEZONE,
    policyResolved:true,
    timeZoneId:"Asia/Taipei"
  }, target(TARGET_INSTANT_BASIS.UT1_JULIAN_DAY));
  assert.equal(zone.bound, true);
  assert.equal(zone.kind, LOCAL_ZONE_CONVENTION_KIND.CIVIL_TIMEZONE);
  assert.equal(zone.timeZoneId, "Asia/Taipei");
  assert.equal(zone.futureUtcPolicyResolved, true);
  assert.equal(zone.civilTimezonePolicyResolved, true);
});

test("contract distinguishes fixed research zones from civil timezone policy", () => {
  assert.equal(LOCAL_ZONE_CONVENTION_CONTRACT.fixedZoneMayDeriveFromTargetInstant, true);
  assert.equal(LOCAL_ZONE_CONVENTION_CONTRACT.fixedZoneResolvesFutureUtcPolicy, false);
  assert.equal(LOCAL_ZONE_CONVENTION_CONTRACT.fixedZoneResolvesCivilTimezonePolicy, false);
  assert.equal(LOCAL_ZONE_CONVENTION_CONTRACT.civilTimezoneRequiresExplicitResolvedPolicy, true);
});
