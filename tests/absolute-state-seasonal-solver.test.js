import test from "node:test";
import assert from "node:assert/strict";
import {
  ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
  INCOMPLETE_APPARENT_SEMANTICS,
  MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
  aberrateNaturalDirection,
  apparentGeocentricSolarLongitudeOfDate,
  roughSeasonalCrossingTtJulianDay,
  signedAngularResidualDegrees,
  solveSeasonalCrossingFromAbsoluteState,
  validateAbsoluteStateAdapter,
  validateApparentDirectionModel,
  validateMeanEclipticOfDateTransform
} from "../src/astronomy/absolute-state-seasonal-solver.js";

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const RATE_DEGREES_PER_DAY = 360 / 365.2422;
const RATE_RADIANS_PER_DAY = RATE_DEGREES_PER_DAY * DEG_TO_RAD;

const IDENTITY_MEAN_ECLIPTIC_TRANSFORM = Object.freeze({
  id:"test-identity-mean-ecliptic-of-date",
  frameSemantics:MEAN_ECLIPTIC_OF_DATE_FRAME_SEMANTICS,
  icrfDirectionToMeanEclipticOfDate({ directionIcrf }) {
    return [...directionIcrf];
  }
});

const TEST_COMPLETE_APPARENT_DIRECTION_MODEL = Object.freeze({
  id:"test-double-complete-apparent-direction",
  referenceSemantics:ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
  includesGravitationalDeflection:true,
  includesStellarAberration:true,
  naturalToApparentIcrf({ naturalDirectionIcrf }) {
    // Contract test double only: it advertises completeness so the solver can
    // exercise the exact-semantics gate. It is not a production correction.
    return [...naturalDirectionIcrf];
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

const INCOMPLETE_CORRECTIONS = Object.freeze({
  allowIncompleteApparentModel:true,
  lightTime:false,
  stellarAberration:false
});

test("absolute-state contract keeps DE-style TDB/ICRF input and mean-ecliptic frame explicit", () => {
  const adapter = circularStateAdapter({ rootTtJulianDay:2461120.1 });
  assert.equal(validateAbsoluteStateAdapter(adapter), adapter);
  assert.equal(validateMeanEclipticOfDateTransform(IDENTITY_MEAN_ECLIPTIC_TRANSFORM),
    IDENTITY_MEAN_ECLIPTIC_TRANSFORM);

  assert.throws(() => validateAbsoluteStateAdapter({ ...adapter, referenceFrame:"ecliptic" }), /ICRF/);
  assert.throws(() => validateAbsoluteStateAdapter({ ...adapter, ephemerisTimeScale:"TT" }), /TDB/);
  assert.throws(() => validateMeanEclipticOfDateTransform({
    ...IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    frameSemantics:"true-ecliptic-of-date"
  }), /mean-ecliptic-of-date/);
});

test("quantity-31 apparent contract requires both gravitational deflection and stellar aberration", () => {
  assert.equal(validateApparentDirectionModel(TEST_COMPLETE_APPARENT_DIRECTION_MODEL),
    TEST_COMPLETE_APPARENT_DIRECTION_MODEL);
  assert.throws(() => validateApparentDirectionModel({
    ...TEST_COMPLETE_APPARENT_DIRECTION_MODEL,
    includesGravitationalDeflection:false
  }), /gravitational light deflection/);
  assert.throws(() => validateApparentDirectionModel({
    ...TEST_COMPLETE_APPARENT_DIRECTION_MODEL,
    includesStellarAberration:false
  }), /stellar aberration/);
});

test("wrapped angular residual remains signed across the 0° seasonal boundary", () => {
  assert.ok(Math.abs(signedAngularResidualDegrees(359.9, 0) + 0.1) < 1e-12);
  assert.ok(Math.abs(signedAngularResidualDegrees(0.1, 0) - 0.1) < 1e-12);
  assert.ok(Math.abs(signedAngularResidualDegrees(0.1, 359.9) - 0.2) < 1e-12);
});

test("incomplete synthetic state path is explicitly marked and cannot claim quantity-31 semantics", () => {
  const rootTtJulianDay = 2461120.116;
  const adapter = circularStateAdapter({ rootTtJulianDay, tdbOffsetSeconds:0.0012 });

  assert.throws(() => apparentGeocentricSolarLongitudeOfDate({
    ttJulianDay:rootTtJulianDay,
    stateAdapter:adapter,
    frameTransform:IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    lightTime:false,
    stellarAberration:false
  }), /quantity-31 semantics/);

  const result = apparentGeocentricSolarLongitudeOfDate({
    ttJulianDay:rootTtJulianDay,
    stateAdapter:adapter,
    frameTransform:IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    ...INCOMPLETE_CORRECTIONS
  });
  assert.equal(result.providerId, "jpl-de441");
  assert.equal(result.referenceSemantics, null);
  assert.equal(result.partialSemantics, INCOMPLETE_APPARENT_SEMANTICS);
  assert.equal(result.apparentModelComplete, false);
  assert.equal(result.gravitationalDeflectionApplied, false);
  assert.equal(result.timeScale, "TT");
  assert.ok(Math.abs(result.longitudeDegrees) < 1e-10 || Math.abs(result.longitudeDegrees - 360) < 1e-10);
  assert.ok(Math.abs((result.observationEphemerisJulianDay - result.ttJulianDay) * 86400 - 0.0012) < 5e-5);
});

test("declared complete apparent model is the only path that emits quantity-31 semantics", () => {
  const rootTtJulianDay = 2461120.116;
  const adapter = circularStateAdapter({ rootTtJulianDay });
  const result = apparentGeocentricSolarLongitudeOfDate({
    ttJulianDay:rootTtJulianDay,
    stateAdapter:adapter,
    frameTransform:IDENTITY_MEAN_ECLIPTIC_TRANSFORM,
    apparentDirectionModel:TEST_COMPLETE_APPARENT_DIRECTION_MODEL,
    lightTime:false
  });
  assert.equal(result.referenceSemantics, ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS);
  assert.equal(result.partialSemantics, null);
  assert.equal(result.apparentModelComplete, true);
  assert.equal(result.gravitationalDeflectionApplied, true);
  assert.equal(result.stellarAberrationApplied, true);
});

test("stellar aberration helper is real but is not mislabeled as full apparent correction", () => {
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
    corrections:INCOMPLETE_CORRECTIONS,
    toleranceSeconds:0.01
  });

  assert.equal(solved.providerId, "jpl-de441");
  assert.equal(solved.targetLongitudeDegrees, 0);
  assert.equal(solved.referenceSemantics, null);
  assert.equal(solved.apparentModelComplete, false);
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
    corrections:INCOMPLETE_CORRECTIONS,
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
    corrections:INCOMPLETE_CORRECTIONS,
    initialHalfBracketDays:1,
    maxHalfBracketDays:4
  }), /could not bracket/);
});
