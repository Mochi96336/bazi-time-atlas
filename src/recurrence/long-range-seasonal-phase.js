import {
  BERGER_MODEL,
  meanAnomalyAtSolarLongitudeTurns,
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

function signedTurnDelta(value) {
  let delta = ((value + 0.5) % 1 + 1) % 1 - 0.5;
  if (delta === -0.5) delta = 0.5;
  return delta;
}

/**
 * Follow the Berger event mean anomaly continuously from one catalogue year
 * to another.  Annual sampling is deliberate: the seasonal event's anomaly
 * moves only slowly from year to year, so the signed branch is unambiguous
 * while retaining any full perihelion-precession turn over long spans.
 */
export function unwrappedSeasonalEventMeanAnomalyTurns({
  baseYear,
  targetYear,
  longitudeDegrees
}) {
  assertYear(baseYear, "baseYear");
  assertYear(targetYear, "targetYear");
  assertLongitude(longitudeDegrees);
  if (targetYear === baseYear) return 0;

  const direction = Math.sign(targetYear - baseYear);
  let year = baseYear;
  let previous = meanAnomalyAtSolarLongitudeTurns(year, longitudeDegrees);
  let accumulated = 0;

  while (year !== targetYear) {
    year += direction;
    const current = meanAnomalyAtSolarLongitudeTurns(year, longitudeDegrees);
    accumulated += signedTurnDelta(current - previous);
    previous = current;
  }
  return accumulated;
}

export function seasonalOrbitClockTurns({
  baseYear,
  targetYear,
  longitudeDegrees
}) {
  const deltaYears = targetYear - baseYear;
  const anomalyTurns = unwrappedSeasonalEventMeanAnomalyTurns({
    baseYear,
    targetYear,
    longitudeDegrees
  });
  return deltaYears + anomalyTurns;
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

export function calibrateSeasonalOrbitClock({
  baseYear = 2026,
  calibrationYear = 4006
} = {}) {
  assertYear(baseYear, "baseYear");
  assertYear(calibrationYear, "calibrationYear");
  if (calibrationYear === baseYear) {
    throw new RangeError("calibrationYear must differ from baseYear");
  }

  const periods = [];
  for (let longitudeDegrees = 0; longitudeDegrees < 360; longitudeDegrees += 15) {
    const baseBoundary = resolveResearchSeasonalBoundary({
      year:baseYear,
      longitudeDegrees
    });
    const targetBoundary = resolveResearchSeasonalBoundary({
      year:calibrationYear,
      longitudeDegrees
    });
    if (
      baseBoundary.epochStatus !== "resolved"
      || targetBoundary.epochStatus !== "resolved"
      || !Number.isFinite(baseBoundary.ttJulianDay)
      || !Number.isFinite(targetBoundary.ttJulianDay)
    ) {
      return freeze({
        status:"calibration-evidence-unavailable",
        baseYear,
        calibrationYear,
        longitudeDegrees,
        blocker:targetBoundary.blocker ?? baseBoundary.blocker ?? "seasonal-epoch-unresolved"
      });
    }

    const orbitTurns = seasonalOrbitClockTurns({
      baseYear,
      targetYear:calibrationYear,
      longitudeDegrees
    });
    const elapsedDays = targetBoundary.ttJulianDay - baseBoundary.ttJulianDay;
    periods.push(freeze({
      longitudeDegrees,
      orbitTurns,
      elapsedDays,
      daysPerOrbitTurn:elapsedDays / orbitTurns
    }));
  }

  const values = periods.map(item => item.daysPerOrbitTurn);
  const meanDaysPerOrbitTurn = values.reduce((sum, value) => sum + value, 0) / values.length;
  const minDaysPerOrbitTurn = Math.min(...values);
  const maxDaysPerOrbitTurn = Math.max(...values);
  const rmsSpreadDays = Math.sqrt(
    values.reduce((sum, value) => sum + (value - meanDaysPerOrbitTurn) ** 2, 0) / values.length
  );

  return freeze({
    status:"calibrated",
    modelId:"berger-event-anomaly-orbit-clock-v1",
    baseYear,
    calibrationYear,
    sampleCount:periods.length,
    periods:freeze(periods),
    meanDaysPerOrbitTurn,
    minDaysPerOrbitTurn,
    maxDaysPerOrbitTurn,
    spreadSeconds:(maxDaysPerOrbitTurn - minDaysPerOrbitTurn) * 86_400,
    rmsSpreadSeconds:rmsSpreadDays * 86_400,
    productionAuthorityGranted:false
  });
}

export function seasonalEventOrbitClockProxy({
  baseYear = 2026,
  targetYear,
  longitudeDegrees,
  daysPerOrbitTurn,
  baseTtJulianDay
}) {
  assertYear(baseYear, "baseYear");
  assertYear(targetYear, "targetYear");
  assertLongitude(longitudeDegrees);
  if (!Number.isFinite(daysPerOrbitTurn) || daysPerOrbitTurn <= 0) {
    throw new RangeError("daysPerOrbitTurn must be positive and finite");
  }
  if (!Number.isFinite(baseTtJulianDay)) {
    throw new RangeError("baseTtJulianDay must be finite");
  }

  const orbitTurns = seasonalOrbitClockTurns({
    baseYear,
    targetYear,
    longitudeDegrees
  });
  return freeze({
    modelId:"berger-event-anomaly-orbit-clock-v1",
    status:"proxy",
    baseYear,
    targetYear,
    longitudeDegrees:normalizedLongitude(longitudeDegrees),
    daysPerOrbitTurn,
    orbitTurns,
    ttJulianDay:baseTtJulianDay + orbitTurns * daysPerOrbitTurn,
    absoluteEphemerisResolved:false,
    civilTimeResolved:false,
    productionAuthorityGranted:false
  });
}

export function assessSeasonalOrbitClock({
  baseYear = 2026,
  calibrationYear = 4006,
  targetYear,
  longitudeDegrees = 315
}) {
  const calibration = calibrateSeasonalOrbitClock({
    baseYear,
    calibrationYear
  });
  if (calibration.status !== "calibrated") {
    return freeze({
      status:"calibration-unavailable",
      baseYear,
      calibrationYear,
      targetYear,
      longitudeDegrees:normalizedLongitude(longitudeDegrees),
      calibration,
      blocker:calibration.blocker
    });
  }

  const baseBoundary = resolveResearchSeasonalBoundary({
    year:baseYear,
    longitudeDegrees
  });
  if (baseBoundary.epochStatus !== "resolved" || !Number.isFinite(baseBoundary.ttJulianDay)) {
    return freeze({
      status:"base-epoch-unavailable",
      baseYear,
      calibrationYear,
      targetYear,
      longitudeDegrees:normalizedLongitude(longitudeDegrees),
      calibration,
      blocker:baseBoundary.blocker ?? "base-seasonal-epoch-unresolved"
    });
  }

  const proxy = seasonalEventOrbitClockProxy({
    baseYear,
    targetYear,
    longitudeDegrees,
    daysPerOrbitTurn:calibration.meanDaysPerOrbitTurn,
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
      targetTtJulianDay:targetBoundary.ttJulianDay,
      proxyMinusTargetDays:errorDays,
      proxyMinusTargetHours:errorDays * HOURS_PER_DAY,
      absoluteProxyErrorHours:Math.abs(errorDays * HOURS_PER_DAY),
      authorityClass:targetBoundary.authorityClass,
      independentTargetYearTruth:targetBoundary.independentTargetYearTruth ?? null,
      productionAuthorityGranted:targetBoundary.productionAuthorityGranted ?? (
        targetBoundary.authorityClass === "reviewed-production-direct-event"
      )
    });
  }

  return freeze({
    status:validation ? "orbit-clock-with-target-evidence" : "orbit-clock-proxy-only",
    baseYear,
    calibrationYear,
    targetYear,
    longitudeDegrees:normalizedLongitude(longitudeDegrees),
    calibration,
    baseBoundary,
    targetBoundary,
    proxy,
    validation,
    blocker:validation ? null : targetBoundary.blocker,
    productionAuthorityGranted:false,
    civilTimeResolved:false
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
      proxyMinusTargetDays:errorDays,
      proxyMinusTargetHours:errorDays * HOURS_PER_DAY,
      absoluteProxyErrorHours:Math.abs(errorDays * HOURS_PER_DAY),
      // Positive phaseOffset means the observed seasonal event occurs later
      // than the fixed-365.2422 skeleton plus Berger within-year shape.
      phaseOffsetDays:-errorDays,
      phaseOffsetHours:-errorDays * HOURS_PER_DAY,
      phaseReference:"target-evidence-minus-fixed-tropical-year-plus-berger-shape",
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

export const SEASONAL_ORBIT_CLOCK_CONTRACT = freeze({
  id:"research-seasonal-orbit-clock-v1",
  role:"research-calibration-and-validation-only",
  phaseSource:"berger-event-mean-anomaly-plus-calibrated-orbit-clock",
  calibrationEvidence:"2026-to-4006-reviewed-de441-24-crossing",
  validationEvidence:"10026-source-derived-de441",
  civilTimeResolved:false,
  productionAuthorityGranted:false
});

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
