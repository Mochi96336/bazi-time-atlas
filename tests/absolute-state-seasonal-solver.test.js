import test from "node:test";
import assert from "node:assert/strict";
import {
  ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
  aberrateNaturalDirection,
  apparentGeocentricSolarLongitudeOfDate,
  roughSeasonalCrossingTtJulianDay,
  signedAngularResidualDegrees,
  solveSeasonalCrossingFromAbsoluteState,
  validateAbsoluteStateAdapter,
  validateMeanEclipticOfDateTransform
} from "../src/astronomy/absolute-state-seasonal-solver.js";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const RATE_DEGREES_PER_DAY = 360 / 365.2422;
const RATE_RADIANS_PER_DAY = RATE_DEGREES_PER_DAY * DEG_TO_RAD;

const IDENTITY_MEAN_ECLIPTIC_TRANSFORM = Object.freeze({
  id:"test-identity-mean-ecliptic-of-date",
  referenceSemantics:ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
  icrfDirectionToMeanEclipticOfDate({ directionIcrf }) {
    return [...directionIcrf];
  }
});

function circularStateAdapter({ rootTtJulianDay, rootLongitudeDegrees = 0, tdbOffsetSeconds = 0 }) {
  return Object.freeze({
    id:"test-circular-absolute-state-adapter",
    providerId:"jpl-de441",
    referenceFrame:"ICRF",
    ephemerisTimeScale:"TDB",
    ttToEphemerisJulianDay(ttJulianDay) {
      return ttJulianDay + tdbOffsetSeconds / 86400;
    },
    stateAtEphemerisJulianDay(ephemerisJulianDay) {
      const ttEquivalent = ephemerisJulianDay - tdbOffsetSeconds / 86400;
      const lambda = (rootLongitudeDegrees
        + RATE_DEGREES_PER_DAY * (ttEquivalent - rootTtJulianDay)) * DEG_TO_RAD;
      // Put the Sun at the barycentric origin and Earth on the opposite ray,
      // so Sun-Earth points at the desired geocentric solar longitude.
      const earthPosition = [-Math.cos(lambda), -Math.sin(lambda), 0];
      const earthVelocity = [
        Math.sin(lambda) * RATE_RADIANS_PER_DAY,
        -Math.cos(lambda) * RATE_RADIANS_PER_DAY,
        0
      ];
      return {
        earth:{ positionAu:earthPosition, velocityAuPerDay:earthVelocity },
        sun:{ positionAu:[0, 0, 0], velocityAuPerDay:[0, 0, 0] }
      };
    }
  });
}

test("absolute-state contract keeps DE-style TDB/ICRF input explicit", () => {
  const adapter = circularStateAdapter({ rootTtJulianDay:2461120.1 });
  assert.equal(validateAbsoluteStateAdapter(adapter), adapter);
  assert.equal(validateMeanEclipticOfDateTransform(IDENTITY_MEAN_ECLIPTIC_TRANSFORM),
    IDENTITY_MEAN_ECLIPTIC_TRANSFORM);

  assert.throws(() => validateAbsoluteStateAdapter({ ...adapter, referenceFrame:"ecliptic" }), /ICRF/);
  assert.throws(() => validateAbsoluteStateAdapter({ ...adapter, ephemerisTimeScale:"TT" }), /TDB/);
  assert.throws(() => validateMeanEclipticOfDateTransform({
    ...IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    referenceSemantics:"true-ecliptic-of-date"
  }), /mean-ecliptic-of-date/);
});

test("wrapped angular residual remains signed across the 0° seasonal boundary", () => {
  assert.ok(Math.abs(signedAngularResidualDegrees(359.9, 0) + 0.1) < 1e-12);
  assert.ok(Math.abs(signedAngularResidualDegrees(0.1, 0) - 0.1) < 1e-12);
  assert.ok(Math.abs(signedAngularResidualDegrees(0.1, 359.9) - 0.2) < 1e-12);
});

test("app-owned state path produces the geometric mean-ecliptic longitude on TT", () => {
  const rootTtJulianDay = 2461120.116;
  const adapter = circularStateAdapter({ rootTtJulianDay, tdbOffsetSeconds:0.0012 });
  const result = apparentGeocentricSolarLongitudeOfDate({
    ttJulianDay:rootTtJulianDay,
    stateAdapter:adapter,
    frameTransform:IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    lightTime:false,
    stellarAberration:false
  });

  assert.equal(result.providerId, "jpl-de441");
  assert.equal(result.referenceSemantics,
    "geocentric-apparent-solar-longitude-mean-ecliptic-of-date");
  assert.equal(result.timeScale, "TT");
  assert.ok(Math.abs(result.longitudeDegrees) < 1e-10 || Math.abs(result.longitudeDegrees - 360) < 1e-10);
  assert.ok(Math.abs((result.observationEphemerisJulianDay - result.ttJulianDay) * 86400 - 0.0012) < 5e-5);
});

test("stellar aberration is a real apparent-direction step, not a frame label", () => {
  const direction = aberrateNaturalDirection({
    naturalDirection:[1, 0, 0],
    observerBarycentricVelocityAuPerDay:[0, -RATE_RADIANS_PER_DAY, 0],
    sunObserverDistanceAu:1
  });
  const longitudeArcseconds = Math.atan2(direction[1], direction[0]) * RAD_TO_DEG * 3600;
  assert.ok(longitudeArcseconds < -20 && longitudeArcseconds > -21);
  assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-14);
});

test("root solver crosses 359°→0° continuously on an absolute state basis", () => {
  const rootTtJulianDay = 2461120.11606357;
  const adapter = circularStateAdapter({ rootTtJulianDay });
  const solved = solveSeasonalCrossingFromAbsoluteState({
    year:2026,
    longitudeDegrees:0,
    seedTtJulianDay:rootTtJulianDay + 0.8,
    stateAdapter:adapter,
    frameTransform:IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    corrections:{ lightTime:false, stellarAberration:false },
    toleranceSeconds:0.01
  });

  assert.equal(solved.providerId, "jpl-de441");
  assert.equal(solved.targetLongitudeDegrees, 0);
  assert.ok(Math.abs(solved.ttJulianDay - rootTtJulianDay) * 86400 < 0.02);
  assert.ok(solved.residualDegrees < 1e-7);
});

test("root solver expands its bracket without changing the target crossing", () => {
  const rootTtJulianDay = 3184391.347367893;
  const adapter = circularStateAdapter({
    rootTtJulianDay,
    rootLongitudeDegrees:90
  });
  const solved = solveSeasonalCrossingFromAbsoluteState({
    year:4006,
    longitudeDegrees:90,
    seedTtJulianDay:rootTtJulianDay + 5,
    initialHalfBracketDays:1,
    maxHalfBracketDays:8,
    stateAdapter:adapter,
    frameTransform:IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    corrections:{ lightTime:false, stellarAberration:false },
    toleranceSeconds:0.01
  });

  assert.ok(solved.bracketHalfWidthDays >= 8);
  assert.ok(Math.abs(solved.ttJulianDay - rootTtJulianDay) * 86400 < 0.02);
  assert.ok(solved.residualDegrees < 1e-7);
});

test("catalogue-year seed keeps 270° in previous December and 315° before March", () => {
  const spring = roughSeasonalCrossingTtJulianDay({ year:2026, longitudeDegrees:0 });
  const winter = roughSeasonalCrossingTtJulianDay({ year:2026, longitudeDegrees:270 });
  const startOfSpring = roughSeasonalCrossingTtJulianDay({ year:2026, longitudeDegrees:315 });

  assert.ok(spring - winter > 85 && spring - winter < 100);
  assert.ok(startOfSpring > winter);
  assert.ok(startOfSpring < spring);
});

test("solver fails closed when no target crossing can be bracketed", () => {
  const rootTtJulianDay = 2461120.116;
  const frozenAdapter = {
    ...circularStateAdapter({ rootTtJulianDay }),
    stateAtEphemerisJulianDay() {
      return {
        earth:{ positionAu:[-1, 0, 0], velocityAuPerDay:[0, 0, 0] },
        sun:{ positionAu:[0, 0, 0], velocityAuPerDay:[0, 0, 0] }
      };
    }
  };

  assert.throws(() => solveSeasonalCrossingFromAbsoluteState({
    year:2026,
    longitudeDegrees:90,
    seedTtJulianDay:rootTtJulianDay,
    stateAdapter:frozenAdapter,
    frameTransform:IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    corrections:{ lightTime:false, stellarAberration:false },
    initialHalfBracketDays:1,
    maxHalfBracketDays:4
  }), /could not bracket/);
});
