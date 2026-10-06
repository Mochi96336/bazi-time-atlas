import {
  BERGER_MODEL,
  normalizedSolarLongitudeOffsetDays
} from "./berger-orbit.js";
import {
  resolveResearchSeasonalBoundary
} from "./research-seasonal-boundary-resolution.js";
import {
  futureDeltaTOneSigmaSeconds,
  longTermDeltaTPointEstimateSeconds
} from "../astronomy/deep-time-earth-rotation.js";

const HOURS_PER_DAY = 24;

function freeze(value) {
  return Object.freeze(value);
}

function assertYear(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer year`);
}

function assertLongitude(value) {
  if (!Number.isFinite(value)) throw new RangeError("longitudeDegrees must be finite");
}

function normalizedLongitude(value) {
  return ((value % 360) + 360) % 360;
}

/**
 * Research-only uniform-time seasonal phase proxy.
 *
 * The proxy advances the base TT seasonal event by a fixed 365.2422-day
 * seasonal-year skeleton, then adds only the Berger change in the selected
 * longitude's offset from the vernal equinox.
 *
 * This deliberately does NOT claim an absolute ephemeris solution. It omits
 * long-period changes in absolute orbital phase / mean longitude and therefore
 * must be calibrated against absolute evidence before use at deeper epochs.
 */
export function seasonalEventUniformTimeProxy({
  baseYear,
  targetYear,
  longitudeDegrees,
  baseTtJulianDay
}) {
  assertYear(baseYear, "baseYear");
  assertYear(targetYear, "targetYear");
  assertLongitude(longitudeDegrees);
  if (!Number.isFinite(baseTtJulianDay)) {
    throw new RangeError("baseTtJulianDay must be finite");
  }

  const longitude = normalizedLongitude(longitudeDegrees);
  const deltaYears = targetYear - baseYear;
  const baseOffsetDays = normalizedSolarLongitudeOffsetDays(baseYear, longitude);
  const targetOffsetDays = normalizedSolarLongitudeOffsetDays(targetYear, longitude);
  const shapeCorrectionDays = targetOffsetDays - baseOffsetDays;
  const seasonalSkeletonDays = deltaYears * BERGER_MODEL.normalizedTropicalYearDays;
  const ttJulianDay = baseTtJulianDay + seasonalSkeletonDays + shapeCorrectionDays;

  return freeze({
    modelId:"berger-shape-plus-fixed-tropical-year-phase-proxy-v1",
    status:"proxy",
    timeScale:"TT-like-uniform-day-coordinate",
    baseYear,
    targetYear,
    deltaYears,
    longitudeDegrees:longitude,
    baseTtJulianDay,
    ttJulianDay,
    normalizedTropicalYearDays:BERGER_MODEL.normalizedTropicalYearDays,
    seasonalSkeletonDays,
    baseOffsetDays,
    targetOffsetDays,
    shapeCorrectionDays,
    absoluteOrbitalPhaseResolved:false,
    targetEphemerisResolved:false,
    civilTimeResolved:false,
    productionAuthorityGranted:false
  });
}

export function assessSeasonalPhaseProxy({
  baseYear = 2026,
  targetYear,
  longitudeDegrees = 315
}) {
  assertYear(baseYear, "baseYear");
  assertYear(targetYear, "targetYear");
  assertLongitude(longitudeDegrees);

  const baseBoundary = resolveResearchSeasonalBoundary({
    year:baseYear,
    longitudeDegrees
  });
  if (baseBoundary.epochStatus !== "resolved" || !Number.isFinite(baseBoundary.ttJulianDay)) {
    return freeze({
      status:"base-epoch-unavailable",
      baseYear,
      targetYear,
      longitudeDegrees:normalizedLongitude(longitudeDegrees),
      baseBoundary,
      targetBoundary:null,
      proxy:null,
      validation:null,
      earthRotation:null,
      blocker:baseBoundary.blocker ?? "base-seasonal-epoch-unresolved"
    });
  }

  const proxy = seasonalEventUniformTimeProxy({
    baseYear,
    targetYear,
    longitudeDegrees,
    baseTtJulianDay:baseBoundary.ttJulianDay
  });
  const targetBoundary = resolveResearchSeasonalBoundary({
    year:targetYear,
    longitudeDegrees
  });

  let validation = null;
  if (targetBoundary.epochStatus === "resolved" && Number.isFinite(targetBoundary.ttJulianDay)) {
    const errorDays = proxy.ttJulianDay - targetBoundary.ttJulianDay;
    validation = freeze({
      evidenceStatus:targetBoundary.status,
      authorityClass:targetBoundary.authorityClass,
      targetTtJulianDay:targetBoundary.ttJulianDay,
      errorDays,
      errorHours:errorDays * HOURS_PER_DAY,
      absoluteErrorHours:Math.abs(errorDays * HOURS_PER_DAY),
      independentTargetYearTruth:targetBoundary.independentTargetYearTruth ?? null,
      productionAuthorityGranted:targetBoundary.productionAuthorityGranted ?? (
        targetBoundary.authorityClass === "reviewed-production-direct-event"
      )
    });
  }

  const earthRotation = targetYear > 2150
    ? freeze({
        deltaTPointEstimateSeconds:longTermDeltaTPointEstimateSeconds(targetYear),
        deltaTPointEstimateDays:longTermDeltaTPointEstimateSeconds(targetYear) / 86_400,
        oneSigmaSeconds:futureDeltaTOneSigmaSeconds(targetYear),
        oneSigmaDays:futureDeltaTOneSigmaSeconds(targetYear) / 86_400,
        deterministicCivilTime:false
      })
    : null;

  const targetResolved = targetBoundary.epochStatus === "resolved";
  return freeze({
    status:targetResolved
      ? "proxy-with-target-evidence"
      : "proxy-only-absolute-source-gap",
    baseYear,
    targetYear,
    longitudeDegrees:normalizedLongitude(longitudeDegrees),
    baseBoundary,
    targetBoundary,
    proxy,
    validation,
    earthRotation,
    blocker:targetResolved ? null : targetBoundary.blocker,
    absoluteOrbitalPhaseResolved:targetResolved,
    proxyIsAbsoluteAuthority:false,
    civilTimeResolved:false,
    productionAuthorityGranted:false
  });
}

export const LONG_RANGE_SEASONAL_PHASE_PROXY_CONTRACT = freeze({
  id:"research-long-range-seasonal-phase-proxy-v1",
  role:"research-calibration-only",
  baseTimeScale:"TT",
  seasonalSkeletonDays:BERGER_MODEL.normalizedTropicalYearDays,
  addsBergerShapeCorrection:true,
  resolvesAbsoluteOrbitalPhase:false,
  resolvesCivilTime:false,
  productionAuthorityGranted:false,
  promotionRule:"must-be-calibrated-against-absolute-seasonal-epoch-evidence"
});
