import { JulianDay, ShouXingUtil } from "../../vendor/tyme4ts-1.5.2.mjs";
import { TYME_SHOUXING_DIRECT_PROVIDER } from "../astronomy/direct-seasonal-event-provider.js";
import {
  deepTimeEarthRotationEstimateSupportsYear,
  estimateDeepTimeUt1FromTtJulianDay
} from "../astronomy/deep-time-earth-rotation.js";
import { TARGET_INSTANT_BINDING_CONTRACT } from "./target-instant-binding.js";

const HOURS_PER_DAY = 24;
const MODERN_DELTA_T_ITERATIONS = 4;

function freeze(fields) {
  return Object.freeze(fields);
}

function assertOffset(value) {
  const [min, max] = TARGET_INSTANT_BINDING_CONTRACT.fixedZoneOffsetRangeHours;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`localOffsetHoursFromUt1 must be between ${min} and +${max}`);
  }
}

function clockAtJulianDay(julianDay) {
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

function shouXingWindowCovers(year) {
  const { minYear, maxYear } = TYME_SHOUXING_DIRECT_PROVIDER.coverage;
  return year >= minYear && year <= maxYear;
}

function boundedUt1FromTt(ttJulianDay) {
  let ut1JulianDay = ttJulianDay;
  for (let index = 0; index < MODERN_DELTA_T_ITERATIONS; index += 1) {
    const ut1DaysFromJ2000 = ut1JulianDay - JulianDay.J2000;
    ut1JulianDay = ttJulianDay - ShouXingUtil.dtT(ut1DaysFromJ2000);
  }
  return ut1JulianDay;
}

function localProjection(ut1JulianDay, localOffsetHoursFromUt1) {
  const localJulianDay = ut1JulianDay + localOffsetHoursFromUt1 / HOURS_PER_DAY;
  return Object.freeze({
    ut1JulianDay,
    localJulianDay,
    localClock:clockAtJulianDay(localJulianDay)
  });
}

/**
 * Project a resolved astronomical seasonal TT epoch onto an explicitly
 * proleptic fixed offset from UT1.
 *
 * This module never claims UTC, DST, political timezone or resolved civil-time
 * policy. Deep-future output preserves the Earth-rotation uncertainty instead
 * of collapsing the point estimate into an exact marker.
 */
export function projectSeasonalBoundaryToFixedZone(
  boundary,
  { localOffsetHoursFromUt1 = null } = {}
) {
  if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
    throw new TypeError("boundary result is required");
  }

  if (boundary.epochStatus !== "resolved" || !Number.isFinite(boundary.ttJulianDay)) {
    return freeze({
      status:"astronomical-epoch-unavailable",
      certainty:"unresolved",
      boundaryStatus:boundary.status ?? "unknown",
      boundaryProviderId:boundary.providerId ?? null,
      year:boundary.year ?? null,
      longitudeDegrees:boundary.longitudeDegrees ?? null,
      localOffsetHoursFromUt1,
      localClock:null,
      interval:null,
      civilTimeResolved:false,
      futureUtcPolicyResolved:false
    });
  }

  if (boundary.timeScale !== "TT") {
    return freeze({
      status:"unsupported-boundary-time-scale",
      certainty:"unresolved",
      boundaryStatus:boundary.status,
      boundaryProviderId:boundary.providerId ?? null,
      year:boundary.year ?? null,
      longitudeDegrees:boundary.longitudeDegrees ?? null,
      inputTimeScale:boundary.timeScale ?? null,
      localOffsetHoursFromUt1,
      localClock:null,
      interval:null,
      civilTimeResolved:false,
      futureUtcPolicyResolved:false
    });
  }

  if (localOffsetHoursFromUt1 === null || localOffsetHoursFromUt1 === undefined) {
    return freeze({
      status:"projection-basis-unbound",
      certainty:"unresolved",
      boundaryStatus:boundary.status,
      boundaryProviderId:boundary.providerId ?? null,
      year:boundary.year ?? null,
      longitudeDegrees:boundary.longitudeDegrees ?? null,
      inputTimeScale:"TT",
      ttJulianDay:boundary.ttJulianDay,
      localOffsetHoursFromUt1:null,
      localClock:null,
      interval:null,
      civilTimeResolved:false,
      futureUtcPolicyResolved:false
    });
  }

  assertOffset(localOffsetHoursFromUt1);
  const year = boundary.year;

  if (Number.isInteger(year) && shouXingWindowCovers(year)) {
    const projected = localProjection(
      boundedUt1FromTt(boundary.ttJulianDay),
      localOffsetHoursFromUt1
    );
    return freeze({
      status:"resolved",
      certainty:"model-bounded",
      boundaryStatus:boundary.status,
      boundaryProviderId:boundary.providerId ?? null,
      year,
      longitudeDegrees:boundary.longitudeDegrees ?? null,
      inputTimeScale:"TT",
      outputTimeScale:"UT1",
      ttJulianDay:boundary.ttJulianDay,
      localOffsetHoursFromUt1,
      earthRotationModel:"tyme4ts-1.5.2-shouxing-delta-t",
      ...projected,
      interval:null,
      prolepticGregorian:true,
      fixedOffsetFromUt1:true,
      civilTimeResolved:false,
      futureUtcPolicyResolved:false
    });
  }

  if (Number.isInteger(year) && deepTimeEarthRotationEstimateSupportsYear(year)) {
    const estimate = estimateDeepTimeUt1FromTtJulianDay(boundary.ttJulianDay);
    const center = localProjection(estimate.ut1JulianDayEstimate, localOffsetHoursFromUt1);
    const min = localProjection(estimate.oneSigmaUt1JulianDayMin, localOffsetHoursFromUt1);
    const max = localProjection(estimate.oneSigmaUt1JulianDayMax, localOffsetHoursFromUt1);
    return freeze({
      status:"estimated",
      certainty:"statistical-one-sigma",
      boundaryStatus:boundary.status,
      boundaryProviderId:boundary.providerId ?? null,
      year,
      longitudeDegrees:boundary.longitudeDegrees ?? null,
      inputTimeScale:"TT",
      outputTimeScale:"UT1",
      ttJulianDay:boundary.ttJulianDay,
      localOffsetHoursFromUt1,
      earthRotationModel:estimate.evidenceId,
      ut1JulianDay:center.ut1JulianDay,
      localJulianDay:center.localJulianDay,
      localClock:center.localClock,
      deltaTSecondsEstimate:estimate.deltaTSecondsEstimate,
      oneSigmaUncertaintySeconds:estimate.oneSigmaUncertaintySeconds,
      interval:Object.freeze({
        semantics:estimate.uncertaintySemantics,
        ut1JulianDayMin:estimate.oneSigmaUt1JulianDayMin,
        ut1JulianDayMax:estimate.oneSigmaUt1JulianDayMax,
        localJulianDayMin:min.localJulianDay,
        localJulianDayMax:max.localJulianDay,
        localClockMin:min.localClock,
        localClockMax:max.localClock
      }),
      prolepticGregorian:true,
      fixedOffsetFromUt1:true,
      civilTimeResolved:false,
      futureUtcPolicyResolved:false
    });
  }

  return freeze({
    status:"earth-rotation-bridge-unavailable",
    certainty:"unresolved",
    boundaryStatus:boundary.status,
    boundaryProviderId:boundary.providerId ?? null,
    year,
    longitudeDegrees:boundary.longitudeDegrees ?? null,
    inputTimeScale:"TT",
    ttJulianDay:boundary.ttJulianDay,
    localOffsetHoursFromUt1,
    localClock:null,
    interval:null,
    civilTimeResolved:false,
    futureUtcPolicyResolved:false
  });
}

export const SEASONAL_FIXED_ZONE_PROJECTION_CONTRACT = Object.freeze({
  id:"research-seasonal-fixed-zone-projection-v1",
  inputTimeScale:"TT",
  outputClockSemantics:"proleptic-gregorian-fixed-offset-from-ut1",
  modernBridgeCoverage:TYME_SHOUXING_DIRECT_PROVIDER.coverage,
  deepTimeProjection:"statistical-point-estimate-plus-one-sigma",
  resolvesUtc:false,
  resolvesCivilTimezone:false,
  exactCivilTimeClaim:false
});
