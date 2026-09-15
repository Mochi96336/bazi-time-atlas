const MIN_LOCAL_OFFSET_HOURS = -14;
const MAX_LOCAL_OFFSET_HOURS = 14;

export const TARGET_INSTANT_BASIS = Object.freeze({
  DATE_ONLY:"date-only",
  TT_JULIAN_DAY:"tt-julian-day",
  UT1_JULIAN_DAY:"ut1-julian-day",
  FIXED_ZONE_FROM_UT1:"fixed-zone-from-ut1"
});

export const TARGET_INSTANT_BASIS_VALUES = Object.freeze(Object.values(TARGET_INSTANT_BASIS));

function assertObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertFinite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function assertLocalOffset(value) {
  assertFinite(value, "localOffsetHoursFromUt1");
  if (value < MIN_LOCAL_OFFSET_HOURS || value > MAX_LOCAL_OFFSET_HOURS) {
    throw new RangeError(`localOffsetHoursFromUt1 must be between ${MIN_LOCAL_OFFSET_HOURS} and +${MAX_LOCAL_OFFSET_HOURS}`);
  }
}

function baseBinding(fields) {
  return Object.freeze({
    futureUtcPolicyResolved:false,
    civilTimezonePolicyResolved:false,
    ...fields
  });
}

export const DATE_ONLY_TARGET_INSTANT = baseBinding({
  basis:TARGET_INSTANT_BASIS.DATE_ONLY,
  bound:false,
  coordinateKind:"calendar-date-without-intra-day-phase",
  inputTimeScale:null,
  julianDay:null,
  requiresEarthRotationBridge:false,
  earthRotationCoordinateAvailable:false,
  localClockCoordinateAvailable:false,
  localOffsetHoursFromUt1:null,
  deterministicPhysicalInstant:false
});

/**
 * Validate and normalize the reference basis of a recurrence target instant.
 *
 * This contract intentionally does not accept generic future UTC/civil labels.
 * TT and UT1 are physical/time-coordinate claims. fixed-zone-from-UT1 is an
 * explicitly proleptic local-clock convention layered on UT1; it is not a
 * prediction of future political UTC or timezone rules.
 */
export function targetInstantBinding(spec = null) {
  if (spec === null || spec === undefined) return DATE_ONLY_TARGET_INSTANT;
  assertObject(spec, "targetInstantBinding");
  const { basis } = spec;
  if (!TARGET_INSTANT_BASIS_VALUES.includes(basis)) {
    throw new RangeError(`target instant basis must be one of: ${TARGET_INSTANT_BASIS_VALUES.join(", ")}`);
  }

  if (basis === TARGET_INSTANT_BASIS.DATE_ONLY) {
    return DATE_ONLY_TARGET_INSTANT;
  }

  if (basis === TARGET_INSTANT_BASIS.TT_JULIAN_DAY) {
    assertFinite(spec.julianDay, "julianDay");
    return baseBinding({
      basis,
      bound:true,
      coordinateKind:"dynamical-time-coordinate",
      inputTimeScale:"TT",
      julianDay:spec.julianDay,
      requiresEarthRotationBridge:true,
      earthRotationCoordinateAvailable:false,
      localClockCoordinateAvailable:false,
      localOffsetHoursFromUt1:null,
      deterministicPhysicalInstant:true
    });
  }

  if (basis === TARGET_INSTANT_BASIS.UT1_JULIAN_DAY) {
    assertFinite(spec.julianDay, "julianDay");
    return baseBinding({
      basis,
      bound:true,
      coordinateKind:"earth-rotation-time-coordinate",
      inputTimeScale:"UT1",
      julianDay:spec.julianDay,
      requiresEarthRotationBridge:false,
      earthRotationCoordinateAvailable:true,
      localClockCoordinateAvailable:false,
      localOffsetHoursFromUt1:null,
      deterministicPhysicalInstant:true
    });
  }

  assertFinite(spec.julianDay, "julianDay");
  assertLocalOffset(spec.localOffsetHoursFromUt1);
  return baseBinding({
    basis,
    bound:true,
    coordinateKind:"proleptic-fixed-local-clock-from-ut1",
    inputTimeScale:"UT1",
    julianDay:spec.julianDay,
    requiresEarthRotationBridge:false,
    earthRotationCoordinateAvailable:true,
    localClockCoordinateAvailable:true,
    localOffsetHoursFromUt1:spec.localOffsetHoursFromUt1,
    deterministicPhysicalInstant:true,
    offsetSemantics:"proleptic-fixed-local-offset-from-ut1"
  });
}

export const TARGET_INSTANT_BINDING_CONTRACT = Object.freeze({
  id:"recurrence-target-instant-binding-v1",
  supportedBases:TARGET_INSTANT_BASIS_VALUES,
  rejectsImplicitFutureUtc:true,
  rejectsImplicitCivilTimezone:true,
  separatesTargetInstantFromDayHourClockBasis:true,
  fixedZoneOffsetRangeHours:Object.freeze([MIN_LOCAL_OFFSET_HOURS, MAX_LOCAL_OFFSET_HOURS])
});
