import { gregorianOrdinal, validateGregorianDate } from "./gregorian-cycle.js";
import {
  TARGET_INSTANT_BASIS,
  TARGET_INSTANT_BINDING_CONTRACT,
  targetInstantBinding
} from "./target-instant-binding.js";

export const PROLEPTIC_GREGORIAN_EPOCH_JD = 1_721_425.5;
const SECONDS_PER_DAY = 86_400;

function assertIntegerRange(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
  }
}

function assertSecond(value) {
  if (!Number.isFinite(value) || value < 0 || value >= 60) {
    throw new RangeError("second must be finite from 0 (inclusive) to 60 (exclusive)");
  }
}

function assertOffset(value) {
  const [min, max] = TARGET_INSTANT_BINDING_CONTRACT.fixedZoneOffsetRangeHours;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`localOffsetHoursFromUt1 must be between ${min} and +${max}`);
  }
}

function normalizeLocalClock(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("localClock must be an object");
  }
  const {
    year,
    month,
    day,
    hour,
    minute,
    second = 0
  } = input;
  if (!validateGregorianDate({ year, month, day })) {
    throw new RangeError("invalid proleptic Gregorian local date");
  }
  assertIntegerRange(hour, "hour", 0, 23);
  assertIntegerRange(minute, "minute", 0, 59);
  assertSecond(second);
  return Object.freeze({ year, month, day, hour, minute, second });
}

/**
 * Interpret a proleptic-Gregorian local clock under an explicit fixed offset
 * from UT1. This is a research convention, not a claim about future UTC,
 * daylight-saving time, or political timezone rules.
 */
export function fixedZoneTargetClock(localClock, localOffsetHoursFromUt1) {
  const local = normalizeLocalClock(localClock);
  assertOffset(localOffsetHoursFromUt1);

  const ordinal = gregorianOrdinal(local);
  const localSeconds = local.hour * 3600 + local.minute * 60 + local.second;
  const localJulianDay = PROLEPTIC_GREGORIAN_EPOCH_JD
    + ordinal
    + localSeconds / SECONDS_PER_DAY;
  const ut1JulianDay = localJulianDay - localOffsetHoursFromUt1 / 24;
  const binding = targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1,
    julianDay:ut1JulianDay,
    localOffsetHoursFromUt1
  });

  return Object.freeze({
    method:"proleptic-gregorian-fixed-zone-from-ut1",
    localClock:local,
    localOffsetHoursFromUt1,
    localJulianDay,
    ut1JulianDay,
    targetInstant:binding,
    prolepticGregorian:true,
    futureUtcPolicyResolved:false,
    civilTimezonePolicyResolved:false
  });
}

export const FIXED_ZONE_TARGET_CLOCK_CONTRACT = Object.freeze({
  id:"recurrence-fixed-zone-target-clock-v1",
  calendar:"proleptic-gregorian",
  localClockReference:"fixed-offset-from-ut1",
  outputTimeScale:"UT1",
  futureUtcPolicyResolved:false,
  civilTimezonePolicyResolved:false,
  supportsLeapSeconds:false,
  gregorianEpochJulianDay:PROLEPTIC_GREGORIAN_EPOCH_JD
});
