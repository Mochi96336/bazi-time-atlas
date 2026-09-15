import {
  TARGET_INSTANT_BASIS,
  targetInstantBinding
} from "./target-instant-binding.js";

const MIN_OFFSET_HOURS = -14;
const MAX_OFFSET_HOURS = 14;

export const LOCAL_ZONE_CONVENTION_KIND = Object.freeze({
  CIVIL_TIMEZONE:"civil-timezone",
  PROLEPTIC_FIXED_OFFSET_FROM_UT1:"proleptic-fixed-offset-from-ut1"
});

export const LOCAL_ZONE_CONVENTION_KIND_VALUES = Object.freeze(
  Object.values(LOCAL_ZONE_CONVENTION_KIND)
);

function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertOffset(value) {
  if (!Number.isFinite(value) || value < MIN_OFFSET_HOURS || value > MAX_OFFSET_HOURS) {
    throw new RangeError(`localOffsetHoursFromUt1 must be between ${MIN_OFFSET_HOURS} and +${MAX_OFFSET_HOURS}`);
  }
}

function base(fields) {
  return Object.freeze({
    bound:false,
    kind:null,
    localClockCoordinateAvailable:false,
    localOffsetHoursFromUt1:null,
    futureUtcPolicyResolved:false,
    civilTimezonePolicyResolved:false,
    derivedFromTargetInstant:false,
    ...fields
  });
}

export const UNBOUND_LOCAL_ZONE_CONVENTION = base({});

/**
 * Normalize the convention that turns an Earth-rotation coordinate into the
 * local clock used by Day/Hour boundary rules.
 *
 * A fixed-zone-from-UT1 target already contains such a convention, so it can
 * be adopted automatically without pretending to resolve future UTC, DST or
 * political timezone history. A true civil-timezone convention must be
 * explicitly supplied as an already-resolved policy by its caller.
 */
export function localZoneConventionBinding(spec = null, targetInstant = null) {
  const target = targetInstantBinding(targetInstant);

  if (spec === null || spec === undefined) {
    if (target.basis === TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1) {
      return base({
        bound:true,
        kind:LOCAL_ZONE_CONVENTION_KIND.PROLEPTIC_FIXED_OFFSET_FROM_UT1,
        localClockCoordinateAvailable:true,
        localOffsetHoursFromUt1:target.localOffsetHoursFromUt1,
        offsetSemantics:"proleptic-fixed-local-offset-from-ut1",
        derivedFromTargetInstant:true
      });
    }
    return UNBOUND_LOCAL_ZONE_CONVENTION;
  }

  assertObject(spec, "localZoneConvention");
  if (!LOCAL_ZONE_CONVENTION_KIND_VALUES.includes(spec.kind)) {
    throw new RangeError(`local zone convention kind must be one of: ${LOCAL_ZONE_CONVENTION_KIND_VALUES.join(", ")}`);
  }

  if (spec.kind === LOCAL_ZONE_CONVENTION_KIND.PROLEPTIC_FIXED_OFFSET_FROM_UT1) {
    assertOffset(spec.localOffsetHoursFromUt1);
    if (
      target.basis === TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1
      && Math.abs(spec.localOffsetHoursFromUt1 - target.localOffsetHoursFromUt1) > 1e-12
    ) {
      throw new RangeError("local zone offset must match fixed-zone target instant offset");
    }
    return base({
      bound:true,
      kind:spec.kind,
      localClockCoordinateAvailable:true,
      localOffsetHoursFromUt1:spec.localOffsetHoursFromUt1,
      offsetSemantics:"proleptic-fixed-local-offset-from-ut1"
    });
  }

  if (spec.policyResolved !== true) {
    throw new RangeError("civil-timezone convention requires policyResolved=true");
  }
  if (typeof spec.timeZoneId !== "string" || !spec.timeZoneId.trim()) {
    throw new RangeError("civil-timezone convention requires a non-empty timeZoneId");
  }
  return base({
    bound:true,
    kind:spec.kind,
    localClockCoordinateAvailable:true,
    futureUtcPolicyResolved:true,
    civilTimezonePolicyResolved:true,
    timeZoneId:spec.timeZoneId.trim()
  });
}

export const LOCAL_ZONE_CONVENTION_CONTRACT = Object.freeze({
  id:"recurrence-local-zone-convention-v1",
  supportedKinds:LOCAL_ZONE_CONVENTION_KIND_VALUES,
  fixedZoneMayDeriveFromTargetInstant:true,
  fixedZoneResolvesFutureUtcPolicy:false,
  fixedZoneResolvesCivilTimezonePolicy:false,
  civilTimezoneRequiresExplicitResolvedPolicy:true
});
