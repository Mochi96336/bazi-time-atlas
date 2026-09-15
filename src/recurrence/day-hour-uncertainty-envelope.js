import { JulianDay } from "../../vendor/tyme4ts-1.5.2.mjs";
import {
  DAY_BOUNDARY,
  resolveDayHourPillars
} from "../calendar/tyme-adapter.js";

const HOURS_PER_DAY = 24;
const MAX_ENUMERATED_SPAN_HOURS = 168;
const JULIAN_DAY_EPSILON = 1e-10;

function assertFinite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function validateLocalOffsetHours(value) {
  assertFinite(value, "localOffsetHoursFromUt1");
  if (value < -14 || value > 14) {
    throw new RangeError("localOffsetHoursFromUt1 must be between -14 and +14");
  }
}

function validateDayBoundary(value) {
  if (!Object.values(DAY_BOUNDARY).includes(value)) {
    throw new RangeError("dayBoundary must be explicitly bound to a supported convention");
  }
}

function solarTimeFieldsAtJulianDay(julianDay) {
  const time = JulianDay.fromJulianDay(julianDay).getSolarTime();
  return Object.freeze({
    year:time.getYear(),
    month:time.getMonth(),
    day:time.getDay(),
    hour:time.getHour(),
    minute:time.getMinute(),
    second:time.getSecond()
  });
}

function validateEstimate(estimate) {
  if (!estimate || typeof estimate !== "object") {
    throw new TypeError("earthRotationEstimate must be an object");
  }
  const {
    ut1JulianDayEstimate,
    oneSigmaUt1JulianDayMin,
    oneSigmaUt1JulianDayMax
  } = estimate;
  assertFinite(ut1JulianDayEstimate, "ut1JulianDayEstimate");
  assertFinite(oneSigmaUt1JulianDayMin, "oneSigmaUt1JulianDayMin");
  assertFinite(oneSigmaUt1JulianDayMax, "oneSigmaUt1JulianDayMax");
  if (oneSigmaUt1JulianDayMin > ut1JulianDayEstimate || ut1JulianDayEstimate > oneSigmaUt1JulianDayMax) {
    throw new RangeError("UT1 estimate must lie inside the supplied uncertainty interval");
  }
  const spanHours = (oneSigmaUt1JulianDayMax - oneSigmaUt1JulianDayMin) * HOURS_PER_DAY;
  if (spanHours > MAX_ENUMERATED_SPAN_HOURS) {
    throw new RangeError(`uncertainty interval exceeds bounded ${MAX_ENUMERATED_SPAN_HOURS}-hour enumeration contract`);
  }
  return { ut1JulianDayEstimate, oneSigmaUt1JulianDayMin, oneSigmaUt1JulianDayMax, spanHours };
}

function hourlyBoundaryJulianDays(minJulianDay, maxJulianDay) {
  const boundaries = [];
  const minHourCoordinate = (minJulianDay + 0.5) * HOURS_PER_DAY;
  let integerHour = Math.ceil(minHourCoordinate - JULIAN_DAY_EPSILON * HOURS_PER_DAY);
  while (true) {
    const boundary = integerHour / HOURS_PER_DAY - 0.5;
    if (boundary > maxJulianDay + JULIAN_DAY_EPSILON) break;
    if (boundary >= minJulianDay - JULIAN_DAY_EPSILON) boundaries.push(boundary);
    integerHour += 1;
  }
  return boundaries;
}

function uniqueJulianDays(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.sort((a, b) => a - b)) {
    const key = value.toFixed(12);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function freezeCandidates(values) {
  const byName = new Map();
  for (const pillar of values) {
    if (!byName.has(pillar.name)) byName.set(pillar.name, Object.freeze({ ...pillar }));
  }
  return Object.freeze([...byName.values()]);
}

/**
 * Propagate one descriptive UT1 uncertainty interval into possible Day/Hour
 * pillars under an explicitly chosen proleptic fixed local offset from UT1.
 *
 * The supplied statistical interval is not a hard physical bound. Therefore a
 * single candidate means only "unique within this interval", never that the
 * true deep-time pillar has been deterministically recovered.
 */
export function dayHourPillarEnvelopeFromUt1Estimate(earthRotationEstimate, options = {}) {
  const {
    ut1JulianDayEstimate,
    oneSigmaUt1JulianDayMin,
    oneSigmaUt1JulianDayMax,
    spanHours
  } = validateEstimate(earthRotationEstimate);

  if (!Object.hasOwn(options, "localOffsetHoursFromUt1")) {
    throw new RangeError("localOffsetHoursFromUt1 must be explicitly bound");
  }
  if (!Object.hasOwn(options, "dayBoundary")) {
    throw new RangeError("dayBoundary must be explicitly bound");
  }
  const { localOffsetHoursFromUt1, dayBoundary } = options;
  validateLocalOffsetHours(localOffsetHoursFromUt1);
  validateDayBoundary(dayBoundary);

  const localShiftDays = localOffsetHoursFromUt1 / HOURS_PER_DAY;
  const localMin = oneSigmaUt1JulianDayMin + localShiftDays;
  const localEstimate = ut1JulianDayEstimate + localShiftDays;
  const localMax = oneSigmaUt1JulianDayMax + localShiftDays;
  const probeJulianDays = uniqueJulianDays([
    localMin,
    localEstimate,
    localMax,
    ...hourlyBoundaryJulianDays(localMin, localMax)
  ]);

  const probes = probeJulianDays.map(localJulianDay => {
    const localClock = solarTimeFieldsAtJulianDay(localJulianDay);
    const resolved = resolveDayHourPillars(localClock, {
      dayBoundary,
      timeBasis:"fixed-zone-from-ut1"
    });
    return Object.freeze({
      localJulianDay,
      localClock,
      day:Object.freeze({ ...resolved.pillars.day }),
      hour:Object.freeze({ ...resolved.pillars.hour })
    });
  });

  const dayCandidates = freezeCandidates(probes.map(probe => probe.day));
  const hourCandidates = freezeCandidates(probes.map(probe => probe.hour));
  const uncertaintySemantics = earthRotationEstimate.uncertaintySemantics
    ?? "unspecified-statistical-interval";

  return Object.freeze({
    method:"fixed-zone-from-ut1-day-hour-uncertainty-envelope",
    timeBasis:"fixed-zone-from-ut1",
    convention:Object.freeze({
      localOffsetHoursFromUt1,
      dayBoundary,
      offsetSemantics:"proleptic-fixed-local-offset-from-ut1"
    }),
    interval:Object.freeze({
      ut1JulianDayEstimate,
      oneSigmaUt1JulianDayMin,
      oneSigmaUt1JulianDayMax,
      spanHours,
      uncertaintySemantics,
      hardBound:false
    }),
    probeCount:probes.length,
    probes:Object.freeze(probes),
    day:Object.freeze({
      candidates:dayCandidates,
      candidateCount:dayCandidates.length,
      uniqueWithinInterval:dayCandidates.length === 1
    }),
    hour:Object.freeze({
      candidates:hourCandidates,
      candidateCount:hourCandidates.length,
      uniqueWithinInterval:hourCandidates.length === 1
    }),
    deterministic:false,
    resolvesTrueDeepTimePillars:false,
    unlocksDayHour:false,
    note:"Candidate uniqueness applies only inside the supplied statistical UT1 interval under the selected proleptic convention. The interval is not a hard physical bound and cannot by itself promote Day/Hour to deterministic truth."
  });
}

export const DAY_HOUR_UNCERTAINTY_ENVELOPE_CONTRACT = Object.freeze({
  id:"fixed-zone-from-ut1-day-hour-uncertainty-envelope-v1",
  inputTimeScale:"UT1",
  intervalSemantics:"statistical-envelope-not-hard-bound",
  supportedTimeBasis:"fixed-zone-from-ut1",
  requiresExplicitLocalOffset:true,
  requiresExplicitDayBoundary:true,
  maximumEnumeratedSpanHours:MAX_ENUMERATED_SPAN_HOURS,
  boundaryEnumerationResolutionSeconds:1,
  deterministic:false,
  unlocksDayHour:false
});