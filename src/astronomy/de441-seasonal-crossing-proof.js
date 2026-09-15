import {
  normalizeDegrees,
  signedAngularResidualDegrees
} from "./absolute-state-seasonal-solver.js";
import { createDe441ApparentIcrfProofAdapter } from "./de441-apparent-icrf-proof.js";

const SECONDS_PER_DAY = 86400;
const RAD_TO_DEG = 180 / Math.PI;

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function assertFrameAdapter(adapter) {
  if (!adapter || adapter.proofOnly !== true || typeof adapter.icrfApparentToEclipticOfDate !== "function") {
    throw new TypeError("a proof-only Horizons ecliptic-of-date frame adapter is required");
  }
}

/**
 * Compose the already-proven DE441 state, TT→TDB, one-iteration light-time,
 * NAIF STELAB and Horizons ecliptic-of-date frame pieces without registering
 * any of them in the production seasonal pipeline.
 */
export function createDe441SeasonalCrossingProofChain({ stateAdapter, frameAdapter }) {
  if (!stateAdapter || stateAdapter.proofOnly !== true || stateAdapter.sourceEphemeris !== "DE441") {
    throw new TypeError("a proof-only DE441 state adapter is required");
  }
  assertFrameAdapter(frameAdapter);
  const apparentIcrfAdapter = createDe441ApparentIcrfProofAdapter({ stateAdapter });

  function solarLongitudeAtTtJulianDay(ttJulianDay) {
    assertFinite("ttJulianDay", ttJulianDay);
    const apparent = apparentIcrfAdapter.apparentSunFromEarthAtTtJulianDay(ttJulianDay);
    const ecliptic = frameAdapter.icrfApparentToEclipticOfDate(
      ttJulianDay,
      apparent.apparentUnitVector
    );
    if (!Array.isArray(ecliptic) || ecliptic.length !== 3
      || ecliptic.some(value => !Number.isFinite(value))) {
      throw new TypeError("frame adapter must return a finite 3-vector");
    }
    const longitudeDegrees = normalizeDegrees(Math.atan2(ecliptic[1], ecliptic[0]) * RAD_TO_DEG);
    const latitudeDegrees = Math.atan2(ecliptic[2], Math.hypot(ecliptic[0], ecliptic[1])) * RAD_TO_DEG;
    return Object.freeze({
      ttJulianDay,
      longitudeDegrees,
      latitudeDegrees,
      apparentIcrfAdapterId:apparentIcrfAdapter.id,
      stateAdapterId:stateAdapter.id,
      frameAdapterId:frameAdapter.id
    });
  }

  function solveCrossing({
    longitudeDegrees,
    seedTtJulianDay,
    initialHalfBracketDays = 0.05,
    toleranceSeconds = 0.005
  }) {
    assertFinite("longitudeDegrees", longitudeDegrees);
    assertFinite("seedTtJulianDay", seedTtJulianDay);
    assertFinite("initialHalfBracketDays", initialHalfBracketDays);
    assertFinite("toleranceSeconds", toleranceSeconds);
    if (!(initialHalfBracketDays > 0)) throw new RangeError("initialHalfBracketDays must be > 0");
    if (!(toleranceSeconds > 0)) throw new RangeError("toleranceSeconds must be > 0");

    const targetLongitudeDegrees = normalizeDegrees(longitudeDegrees);
    let left = seedTtJulianDay - initialHalfBracketDays;
    let right = seedTtJulianDay + initialHalfBracketDays;
    let leftResidual = signedAngularResidualDegrees(
      solarLongitudeAtTtJulianDay(left).longitudeDegrees,
      targetLongitudeDegrees
    );
    let rightResidual = signedAngularResidualDegrees(
      solarLongitudeAtTtJulianDay(right).longitudeDegrees,
      targetLongitudeDegrees
    );
    if (leftResidual !== 0 && rightResidual !== 0
      && Math.sign(leftResidual) === Math.sign(rightResidual)) {
      throw new RangeError(
        `could not bracket ${targetLongitudeDegrees}° crossing within ±${initialHalfBracketDays} d of TT JD ${seedTtJulianDay}`
      );
    }

    const toleranceDays = toleranceSeconds / SECONDS_PER_DAY;
    let iterations = 0;
    while ((right - left) > toleranceDays && iterations < 80) {
      const mid = (left + right) / 2;
      const midResidual = signedAngularResidualDegrees(
        solarLongitudeAtTtJulianDay(mid).longitudeDegrees,
        targetLongitudeDegrees
      );
      if (midResidual === 0) {
        left = mid;
        right = mid;
        break;
      }
      if (Math.sign(leftResidual) === Math.sign(midResidual)) {
        left = mid;
        leftResidual = midResidual;
      } else {
        right = mid;
        rightResidual = midResidual;
      }
      iterations += 1;
    }

    const ttJulianDay = (left + right) / 2;
    const solved = solarLongitudeAtTtJulianDay(ttJulianDay);
    return Object.freeze({
      proofOnly:true,
      productionIntegrated:false,
      targetLongitudeDegrees,
      seedTtJulianDay,
      initialHalfBracketDays,
      toleranceSeconds,
      iterations,
      ttJulianDay,
      solvedLongitudeDegrees:solved.longitudeDegrees,
      residualDegrees:Math.abs(signedAngularResidualDegrees(
        solved.longitudeDegrees,
        targetLongitudeDegrees
      )),
      stateAdapterId:stateAdapter.id,
      apparentIcrfAdapterId:apparentIcrfAdapter.id,
      frameAdapterId:frameAdapter.id
    });
  }

  return Object.freeze({
    id:"de441-seasonal-crossing-e2e-proof",
    proofOnly:true,
    productionIntegrated:false,
    stateAdapter,
    frameAdapter,
    apparentIcrfAdapter,
    solarLongitudeAtTtJulianDay,
    solveCrossing
  });
}
