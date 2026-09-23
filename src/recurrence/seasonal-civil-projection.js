import { JulianDay, ShouXingUtil } from "../../vendor/tyme4ts-1.5.2.mjs";
import {
  deepTimeEarthRotationEstimateSupportsYear,
  estimateDeepTimeUt1FromTtJulianDay
} from "../astronomy/deep-time-earth-rotation.js";
import {
  PROLEPTIC_GREGORIAN_EPOCH_JD
} from "./fixed-zone-target-clock.js";
import {
  TARGET_INSTANT_BINDING_CONTRACT
} from "./target-instant-binding.js";
import {
  daysInGregorianMonth,
  gregorianOrdinal
} from "./gregorian-cycle.js";

const SECONDS_PER_DAY = 86_400;
const SHOUXING_BRIDGE_MIN_YEAR = 1900;
const SHOUXING_BRIDGE_MAX_YEAR = 2100;

function freeze(value) {
  return Object.freeze(value);
}

function assertYear(year) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
}

function assertOffset(offsetHours) {
  const [min, max] = TARGET_INSTANT_BINDING_CONTRACT.fixedZoneOffsetRangeHours;
  if (!Number.isFinite(offsetHours) || offsetHours < min || offsetHours > max) {
    throw new RangeError(`localOffsetHoursFromUt1 must be between ${min} and +${max}`);
  }
}

function prolepticGregorianFieldsAtLocalJulianDay(localJulianDay) {
  if (!Number.isFinite(localJulianDay)) throw new RangeError("localJulianDay must be finite");
  const dayCoordinate = localJulianDay - PROLEPTIC_GREGORIAN_EPOCH_JD;
  let ordinal = Math.floor(dayCoordinate);
  let fraction = dayCoordinate - ordinal;

  // Protect the calendar inversion against tiny floating-point excursions at
  // exact midnight while keeping the fixed-offset-from-UT1 convention intact.
  if (fraction < 0) {
    ordinal -= 1;
    fraction += 1;
  }
  if (fraction >= 1) {
    ordinal += 1;
    fraction -= 1;
  }

  const maxOrdinal = gregorianOrdinal({ year:10_000_000, month:12, day:31 });
  if (ordinal < 0 || ordinal > maxOrdinal) {
    throw new RangeError("localJulianDay is outside the supported proleptic Gregorian range");
  }

  let low = 1;
  let high = 10_000_000;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    const start = gregorianOrdinal({ year:middle, month:1, day:1 });
    if (start <= ordinal) low = middle;
    else high = middle - 1;
  }
  const year = low;
  let dayOfYear = ordinal - gregorianOrdinal({ year, month:1, day:1 });
  let month = 1;
  while (month < 12) {
    const length = daysInGregorianMonth(year, month);
    if (dayOfYear < length) break;
    dayOfYear -= length;
    month += 1;
  }
  const day = dayOfYear + 1;
  const totalSeconds = fraction * SECONDS_PER_DAY;
  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds - hour * 3600) / 60);
  const second = totalSeconds - hour * 3600 - minute * 60;

  return freeze({ year, month, day, hour, minute, second });
}

function shouXingUt1FromTt(ttJulianDay) {
  let ut1JulianDay = ttJulianDay;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const daysFromJ2000 = ut1JulianDay - JulianDay.J2000;
    ut1JulianDay = ttJulianDay - ShouXingUtil.dtT(daysFromJ2000);
  }
  return ut1JulianDay;
}

function fixedZoneProjectionFields(ut1JulianDay, localOffsetHoursFromUt1) {
  const localJulianDay = ut1JulianDay + localOffsetHoursFromUt1 / 24;
  return freeze({
    ut1JulianDay,
    localJulianDay,
    localClock:prolepticGregorianFieldsAtLocalJulianDay(localJulianDay)
  });
}

function baseResult(fields) {
  return freeze({
    projectionBasis:"proleptic-fixed-offset-from-ut1",
    futureUtcPolicyResolved:false,
    civilTimezonePolicyResolved:false,
    ...fields
  });
}

/**
 * Project a resolved astronomical seasonal boundary into a proleptic local
 * clock defined only as a fixed offset from UT1.
 *
 * This is deliberately not a future UTC/timezone projection. A deep-time
 * TT->UT1 result remains an estimate with an explicit uncertainty interval.
 */
export function projectSeasonalBoundaryToCivil({
  year,
  boundary,
  localOffsetHoursFromUt1 = null
}) {
  assertYear(year);
  if (!boundary || typeof boundary !== "object") {
    throw new TypeError("boundary is required");
  }

  if (boundary.epochStatus !== "resolved" || !Number.isFinite(boundary.ttJulianDay)) {
    return baseResult({
      status:"unavailable",
      localOffsetHoursFromUt1,
      localClockResolved:false,
      pointEstimateAvailable:false,
      deterministicWithinModel:false,
      boundaryStatus:boundary.status ?? null,
      providerId:boundary.providerId ?? null,
      timeScale:boundary.timeScale ?? null,
      blocker:boundary.blocker ?? "seasonal-epoch-unresolved"
    });
  }

  if (localOffsetHoursFromUt1 === null || localOffsetHoursFromUt1 === undefined) {
    return baseResult({
      status:"basis-unbound",
      localOffsetHoursFromUt1:null,
      localClockResolved:false,
      pointEstimateAvailable:false,
      deterministicWithinModel:false,
      boundaryStatus:boundary.status,
      providerId:boundary.providerId,
      timeScale:boundary.timeScale,
      blocker:"fixed-offset-from-ut1-unbound"
    });
  }
  assertOffset(localOffsetHoursFromUt1);

  if (boundary.timeScale === "UT1") {
    const projection = fixedZoneProjectionFields(
      boundary.event?.ut1JulianDay ?? boundary.ut1JulianDay,
      localOffsetHoursFromUt1
    );
    return baseResult({
      status:"resolved",
      localOffsetHoursFromUt1,
      localClockResolved:true,
      pointEstimateAvailable:true,
      deterministicWithinModel:true,
      boundaryStatus:boundary.status,
      providerId:boundary.providerId,
      timeScale:"UT1",
      earthRotationBridge:"not-required",
      uncertaintySeconds:null,
      ...projection,
      blocker:null
    });
  }

  if (boundary.timeScale !== "TT") {
    return baseResult({
      status:"unavailable",
      localOffsetHoursFromUt1,
      localClockResolved:false,
      pointEstimateAvailable:false,
      deterministicWithinModel:false,
      boundaryStatus:boundary.status,
      providerId:boundary.providerId,
      timeScale:boundary.timeScale,
      blocker:"unsupported-seasonal-time-scale"
    });
  }

  if (year >= SHOUXING_BRIDGE_MIN_YEAR && year <= SHOUXING_BRIDGE_MAX_YEAR) {
    const ut1JulianDay = shouXingUt1FromTt(boundary.ttJulianDay);
    const projection = fixedZoneProjectionFields(ut1JulianDay, localOffsetHoursFromUt1);
    return baseResult({
      status:"resolved",
      localOffsetHoursFromUt1,
      localClockResolved:true,
      pointEstimateAvailable:true,
      deterministicWithinModel:true,
      boundaryStatus:boundary.status,
      providerId:boundary.providerId,
      timeScale:"TT",
      earthRotationBridge:"tyme4ts-1.5.2-shouxing-delta-t-model",
      uncertaintySeconds:null,
      ...projection,
      blocker:null
    });
  }

  if (deepTimeEarthRotationEstimateSupportsYear(year)) {
    const estimate = estimateDeepTimeUt1FromTtJulianDay(boundary.ttJulianDay);
    const projection = fixedZoneProjectionFields(
      estimate.ut1JulianDayEstimate,
      localOffsetHoursFromUt1
    );
    const intervalMin = fixedZoneProjectionFields(
      estimate.oneSigmaUt1JulianDayMin,
      localOffsetHoursFromUt1
    );
    const intervalMax = fixedZoneProjectionFields(
      estimate.oneSigmaUt1JulianDayMax,
      localOffsetHoursFromUt1
    );
    return baseResult({
      status:"estimated",
      localOffsetHoursFromUt1,
      localClockResolved:false,
      pointEstimateAvailable:true,
      deterministicWithinModel:false,
      boundaryStatus:boundary.status,
      providerId:boundary.providerId,
      timeScale:"TT",
      earthRotationBridge:estimate.evidenceId,
      uncertaintySemantics:estimate.uncertaintySemantics,
      uncertaintySeconds:estimate.oneSigmaUncertaintySeconds,
      ...projection,
      oneSigmaLocalJulianDayMin:intervalMin.localJulianDay,
      oneSigmaLocalJulianDayMax:intervalMax.localJulianDay,
      oneSigmaLocalClockMin:intervalMin.localClock,
      oneSigmaLocalClockMax:intervalMax.localClock,
      blocker:"deep-time-earth-rotation-uncertainty"
    });
  }

  return baseResult({
    status:"unavailable",
    localOffsetHoursFromUt1,
    localClockResolved:false,
    pointEstimateAvailable:false,
    deterministicWithinModel:false,
    boundaryStatus:boundary.status,
    providerId:boundary.providerId,
    timeScale:"TT",
    blocker:"earth-rotation-bridge-unavailable"
  });
}

export const SEASONAL_CIVIL_PROJECTION_CONTRACT = freeze({
  id:"research-seasonal-civil-projection-v1",
  statuses:freeze(["resolved", "estimated", "basis-unbound", "unavailable"]),
  projectionBasis:"proleptic-fixed-offset-from-ut1",
  futureUtcPolicyResolved:false,
  civilTimezonePolicyResolved:false,
  deepTimeEstimateIsDeterministic:false
});
