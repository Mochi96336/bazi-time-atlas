const SPEED_OF_LIGHT_AU_PER_DAY = 173.1446326742403;

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function vectorNorm(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vector, scalar) {
  return vector.map(value => value * scalar);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(vector, name) {
  const magnitude = vectorNorm(vector);
  if (!(magnitude > 0) || !Number.isFinite(magnitude)) {
    throw new RangeError(`${name} must have finite non-zero magnitude`);
  }
  return scale(vector, 1 / magnitude);
}

function rotateAroundAxis(vector, axis, angle) {
  const unitAxis = normalize(axis, "rotation axis");
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const crossTerm = cross(unitAxis, vector);
  const axialTerm = scale(unitAxis, dot(unitAxis, vector) * (1 - cosine));
  return [
    vector[0] * cosine + crossTerm[0] * sine + axialTerm[0],
    vector[1] * cosine + crossTerm[1] * sine + axialTerm[1],
    vector[2] * cosine + crossTerm[2] * sine + axialTerm[2]
  ];
}

/**
 * NASA/JPL NAIF stellar-aberration construction used by SPICE STELAB.
 *
 * r is already one-way-light-time corrected. v is the observer's
 * barycentric velocity. The apparent direction rotates r toward v by phi,
 * with sin(phi) = |v| sin(w) / c and axis r × v.
 */
export function applyNaifStellarAberration(positionAu, observerVelocityAuPerDay) {
  const radius = vectorNorm(positionAu);
  const speed = vectorNorm(observerVelocityAuPerDay);
  if (!(radius > 0)) throw new RangeError("positionAu must have non-zero magnitude");
  if (!Number.isFinite(speed) || speed >= SPEED_OF_LIGHT_AU_PER_DAY) {
    throw new RangeError("observerVelocityAuPerDay must be finite and subluminal");
  }
  if (speed === 0) return Object.freeze([...positionAu]);

  const axis = cross(positionAu, observerVelocityAuPerDay);
  const axisMagnitude = vectorNorm(axis);
  if (axisMagnitude === 0) return Object.freeze([...positionAu]);

  const sinW = axisMagnitude / (radius * speed);
  const sinPhi = Math.min(1, Math.max(-1, speed * sinW / SPEED_OF_LIGHT_AU_PER_DAY));
  const phi = Math.asin(sinPhi);
  return Object.freeze(rotateAroundAxis(positionAu, axis, phi));
}

export const DE441_APPARENT_ICRF_MODEL = Object.freeze({
  id:"de441-naif-lt-plus-stellar-aberration-proof",
  authority:"NASA/JPL DE441 + NAIF SPICE aberration semantics",
  inputStateFrame:"ICRF barycentric",
  inputStateTimeScale:"TDB",
  outputFrame:"ICRF apparent direction",
  lightTime:"one-iteration Newtonian reception correction (LT)",
  stellarAberration:"NAIF STELAB rotation",
  gravitationalDeflectionForSunCenter:false,
  speedOfLightAuPerDay:SPEED_OF_LIGHT_AU_PER_DAY,
  proofOnly:true,
  productionIntegrated:false,
  note:"Horizons research evidence shows Sun-center observer quantity #45 agrees with vector LT+S to microarcsecond output precision; no extra gravitational-deflection residual is observable for this target."
});

/**
 * Compose the already-proven TT→TDB and DE441 state-window adapters into a
 * proof-only apparent Sun direction.
 *
 * LT follows the SPICE one-iteration convention: use the geometric range at
 * reception as the first light-time estimate, evaluate the Sun at et-lt_1,
 * then form T(et-lt_1)-O(et). The resulting range/c is the LT table value.
 */
export function createDe441ApparentIcrfProofAdapter({ stateAdapter }) {
  if (!stateAdapter || stateAdapter.sourceEphemeris !== "DE441") {
    throw new TypeError("a DE441 state adapter is required");
  }
  if (stateAdapter.referenceFrame !== "ICRF" || stateAdapter.ephemerisTimeScale !== "TDB") {
    throw new TypeError("state adapter must expose ICRF/TDB states");
  }
  if (typeof stateAdapter.ttToEphemerisJulianDay !== "function"
    || typeof stateAdapter.stateAtEphemerisJulianDay !== "function") {
    throw new TypeError("state adapter must expose TT→TDB and state lookup functions");
  }

  return Object.freeze({
    id:"de441-apparent-icrf-proof",
    proofOnly:true,
    productionIntegrated:false,
    model:DE441_APPARENT_ICRF_MODEL,
    stateAdapter,
    apparentSunFromEarthAtTtJulianDay(ttJulianDay) {
      assertFinite("ttJulianDay", ttJulianDay);
      const receptionTdbJulianDay = stateAdapter.ttToEphemerisJulianDay(ttJulianDay);
      const reception = stateAdapter.stateAtEphemerisJulianDay(receptionTdbJulianDay);
      const geometricPositionAu = subtract(reception.sun.positionAu, reception.earth.positionAu);
      const firstLightTimeDays = vectorNorm(geometricPositionAu) / SPEED_OF_LIGHT_AU_PER_DAY;
      const emissionTdbJulianDay = receptionTdbJulianDay - firstLightTimeDays;
      const emission = stateAdapter.stateAtEphemerisJulianDay(emissionTdbJulianDay);
      const lightTimeCorrectedPositionAu = subtract(
        emission.sun.positionAu,
        reception.earth.positionAu
      );
      const oneIterationLightTimeDays = vectorNorm(lightTimeCorrectedPositionAu)
        / SPEED_OF_LIGHT_AU_PER_DAY;
      const apparentPositionAu = applyNaifStellarAberration(
        lightTimeCorrectedPositionAu,
        reception.earth.velocityAuPerDay
      );
      return Object.freeze({
        ttJulianDay,
        receptionTdbJulianDay,
        emissionTdbJulianDay,
        firstLightTimeDays,
        oneIterationLightTimeDays,
        geometricPositionAu:Object.freeze(geometricPositionAu),
        lightTimeCorrectedPositionAu:Object.freeze(lightTimeCorrectedPositionAu),
        apparentPositionAu,
        apparentUnitVector:Object.freeze(normalize(apparentPositionAu, "apparentPositionAu"))
      });
    }
  });
}
