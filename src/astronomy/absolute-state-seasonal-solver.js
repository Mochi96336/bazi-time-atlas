const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const SECONDS_PER_DAY = 86400;
const TROPICAL_YEAR_DAYS = 365.2422;
const SPEED_OF_LIGHT_AU_PER_DAY = 173.1446326846693;
const SOLAR_SCHWARZSCHILD_RADIUS_AU = 1.97412574336e-8;

export const ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS =
  "geocentric-apparent-solar-longitude-mean-ecliptic-of-date";

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function assertVector(name, value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some(item => !Number.isFinite(item))) {
    throw new TypeError(`${name} must be a finite 3-vector`);
  }
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a, factor) {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function magnitude(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function unit(a, name = "vector") {
  const length = magnitude(a);
  if (!(length > 0)) throw new RangeError(`${name} must have non-zero length`);
  return scale(a, 1 / length);
}

export function normalizeDegrees(value) {
  assertFinite("angle", value);
  return ((value % 360) + 360) % 360;
}

export function signedAngularResidualDegrees(actualDegrees, targetDegrees) {
  const delta = (actualDegrees - targetDegrees) * DEG_TO_RAD;
  return Math.atan2(Math.sin(delta), Math.cos(delta)) * RAD_TO_DEG;
}

/**
 * Apply stellar aberration to a natural source direction.
 *
 * This is a small JavaScript adaptation of the ERFA/SOFA `eraAb` algorithm.
 * ERFA is BSD-licensed and derived with permission from IAU SOFA. The tiny
 * solar-potential term is retained so the contract is suitable for a future
 * DE441 adapter rather than only for a geometric proof.
 */
export function aberrateNaturalDirection({
  naturalDirection,
  observerBarycentricVelocityAuPerDay,
  sunObserverDistanceAu
}) {
  assertVector("naturalDirection", naturalDirection);
  assertVector("observerBarycentricVelocityAuPerDay", observerBarycentricVelocityAuPerDay);
  assertFinite("sunObserverDistanceAu", sunObserverDistanceAu);
  if (!(sunObserverDistanceAu > 0)) throw new RangeError("sunObserverDistanceAu must be > 0");

  const pnat = unit(naturalDirection, "naturalDirection");
  const beta = scale(observerBarycentricVelocityAuPerDay, 1 / SPEED_OF_LIGHT_AU_PER_DAY);
  const beta2 = dot(beta, beta);
  if (!(beta2 < 1)) throw new RangeError("observer velocity must be subluminal");
  const bm1 = Math.sqrt(1 - beta2);
  const pdv = dot(pnat, beta);
  const w1 = 1 + pdv / (1 + bm1);
  const w2 = SOLAR_SCHWARZSCHILD_RADIUS_AU / sunObserverDistanceAu;
  const proper = pnat.map((component, index) =>
    component * bm1 + w1 * beta[index] + w2 * (beta[index] - pdv * component)
  );
  return Object.freeze(unit(proper, "aberrated direction"));
}

function validateState(state, label) {
  if (!state || typeof state !== "object") throw new TypeError(`${label} state is required`);
  assertVector(`${label}.positionAu`, state.positionAu);
  assertVector(`${label}.velocityAuPerDay`, state.velocityAuPerDay);
}

export function validateAbsoluteStateAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") throw new TypeError("absolute-state adapter is required");
  if (!adapter.id || typeof adapter.id !== "string") throw new TypeError("absolute-state adapter.id is required");
  if (!adapter.providerId || typeof adapter.providerId !== "string") {
    throw new TypeError("absolute-state adapter.providerId is required");
  }
  if (adapter.referenceFrame !== "ICRF") {
    throw new TypeError("absolute-state adapter must expose ICRF barycentric states");
  }
  if (adapter.ephemerisTimeScale !== "TDB") {
    throw new TypeError("absolute-state adapter must expose TDB ephemeris states");
  }
  if (typeof adapter.ttToEphemerisJulianDay !== "function") {
    throw new TypeError("absolute-state adapter must define ttToEphemerisJulianDay");
  }
  if (typeof adapter.stateAtEphemerisJulianDay !== "function") {
    throw new TypeError("absolute-state adapter must define stateAtEphemerisJulianDay");
  }
  return adapter;
}

export function validateMeanEclipticOfDateTransform(transform) {
  if (!transform || typeof transform !== "object") throw new TypeError("mean-ecliptic-of-date transform is required");
  if (!transform.id || typeof transform.id !== "string") throw new TypeError("frame transform.id is required");
  if (transform.referenceSemantics !== ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS) {
    throw new TypeError("frame transform must target the Earth-season mean-ecliptic-of-date observable");
  }
  if (typeof transform.icrfDirectionToMeanEclipticOfDate !== "function") {
    throw new TypeError("frame transform must define icrfDirectionToMeanEclipticOfDate");
  }
  return transform;
}

function statesAt(adapter, ephemerisJulianDay) {
  const states = adapter.stateAtEphemerisJulianDay(ephemerisJulianDay);
  if (!states || typeof states !== "object") throw new TypeError("state adapter must return Earth and Sun states");
  validateState(states.earth, "earth");
  validateState(states.sun, "sun");
  return states;
}

/**
 * Construct the apparent geocentric Sun direction at one TT epoch from an
 * absolute Earth/Sun state basis.
 *
 * Source states stay in ICRF/TDB. The app owns the light-time iteration,
 * stellar-aberration step and the call into a separately declared
 * mean-ecliptic-of-date transform. No UTC/civil-time semantics enter here.
 */
export function apparentGeocentricSolarLongitudeOfDate({
  ttJulianDay,
  stateAdapter,
  frameTransform,
  lightTime = true,
  stellarAberration = true,
  lightTimeIterations = 3
}) {
  assertFinite("ttJulianDay", ttJulianDay);
  validateAbsoluteStateAdapter(stateAdapter);
  validateMeanEclipticOfDateTransform(frameTransform);
  if (!Number.isInteger(lightTimeIterations) || lightTimeIterations < 1 || lightTimeIterations > 8) {
    throw new RangeError("lightTimeIterations must be an integer in 1..8");
  }

  const observationEphemerisJulianDay = stateAdapter.ttToEphemerisJulianDay(ttJulianDay);
  assertFinite("observation ephemeris Julian Day", observationEphemerisJulianDay);
  const observationStates = statesAt(stateAdapter, observationEphemerisJulianDay);
  const earth = observationStates.earth;
  const sunAtObservation = observationStates.sun;
  const sunObserverDistanceAu = magnitude(subtract(sunAtObservation.positionAu, earth.positionAu));
  if (!(sunObserverDistanceAu > 0)) throw new RangeError("Sun and Earth positions must be distinct");

  let emissionEphemerisJulianDay = observationEphemerisJulianDay;
  let sun = sunAtObservation;
  let lightTimeDays = 0;
  if (lightTime) {
    for (let iteration = 0; iteration < lightTimeIterations; iteration += 1) {
      const rangeAu = magnitude(subtract(sun.positionAu, earth.positionAu));
      lightTimeDays = rangeAu / SPEED_OF_LIGHT_AU_PER_DAY;
      emissionEphemerisJulianDay = observationEphemerisJulianDay - lightTimeDays;
      sun = statesAt(stateAdapter, emissionEphemerisJulianDay).sun;
    }
  }

  const naturalDirectionIcrf = unit(
    subtract(sun.positionAu, earth.positionAu),
    "geocentric solar direction"
  );
  const apparentDirectionIcrf = stellarAberration
    ? aberrateNaturalDirection({
      naturalDirection:naturalDirectionIcrf,
      observerBarycentricVelocityAuPerDay:earth.velocityAuPerDay,
      sunObserverDistanceAu
    })
    : naturalDirectionIcrf;
  const eclipticDirection = frameTransform.icrfDirectionToMeanEclipticOfDate({
    ttJulianDay,
    directionIcrf:apparentDirectionIcrf
  });
  assertVector("mean-ecliptic-of-date direction", eclipticDirection);
  const longitudeDegrees = normalizeDegrees(Math.atan2(eclipticDirection[1], eclipticDirection[0]) * RAD_TO_DEG);
  const latitudeDegrees = Math.atan2(
    eclipticDirection[2],
    Math.hypot(eclipticDirection[0], eclipticDirection[1])
  ) * RAD_TO_DEG;

  return Object.freeze({
    stateAdapterId:stateAdapter.id,
    providerId:stateAdapter.providerId,
    frameTransformId:frameTransform.id,
    referenceSemantics:ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
    timeScale:"TT",
    ttJulianDay,
    observationEphemerisJulianDay,
    emissionEphemerisJulianDay,
    lightTimeDays,
    lightTimeSeconds:lightTimeDays * SECONDS_PER_DAY,
    longitudeDegrees,
    latitudeDegrees
  });
}

function gregorianJulianDay(year, month, day) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError("month must be in 1..12");
  assertFinite("day", day);
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716))
    + Math.floor(30.6001 * (m + 1))
    + day + b - 1524.5;
}

export function roughSeasonalCrossingTtJulianDay({ year, longitudeDegrees }) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  assertFinite("longitudeDegrees", longitudeDegrees);
  const target = normalizeDegrees(longitudeDegrees);
  const marchEquinoxGuess = gregorianJulianDay(year, 3, 20.5);
  let fraction = target / 360;
  // Preserve the atlas/Tyme catalogue-year selector: winter solstice belongs
  // to the previous December, followed by 285°..345° in Jan..Mar of `year`.
  if (target >= 270) fraction -= 1;
  return marchEquinoxGuess + fraction * TROPICAL_YEAR_DAYS;
}

function residualAt({ ttJulianDay, longitudeDegrees, stateAdapter, frameTransform, corrections }) {
  const longitude = apparentGeocentricSolarLongitudeOfDate({
    ttJulianDay,
    stateAdapter,
    frameTransform,
    ...corrections
  }).longitudeDegrees;
  return {
    longitudeDegrees:longitude,
    residualDegrees:signedAngularResidualDegrees(longitude, longitudeDegrees)
  };
}

/**
 * Root-solve one Earth-season longitude crossing on TT from an absolute state
 * adapter. The bracket is centered on a rough calendar seed and expands only
 * as needed; bisection then works on the wrapped signed angular residual.
 */
export function solveSeasonalCrossingFromAbsoluteState({
  year,
  longitudeDegrees,
  stateAdapter,
  frameTransform,
  seedTtJulianDay = roughSeasonalCrossingTtJulianDay({ year, longitudeDegrees }),
  initialHalfBracketDays = 2,
  maxHalfBracketDays = 16,
  toleranceSeconds = 0.05,
  corrections = undefined
}) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  assertFinite("longitudeDegrees", longitudeDegrees);
  assertFinite("seedTtJulianDay", seedTtJulianDay);
  assertFinite("initialHalfBracketDays", initialHalfBracketDays);
  assertFinite("maxHalfBracketDays", maxHalfBracketDays);
  assertFinite("toleranceSeconds", toleranceSeconds);
  if (!(initialHalfBracketDays > 0)) throw new RangeError("initialHalfBracketDays must be > 0");
  if (!(maxHalfBracketDays >= initialHalfBracketDays)) {
    throw new RangeError("maxHalfBracketDays must be >= initialHalfBracketDays");
  }
  if (!(toleranceSeconds > 0)) throw new RangeError("toleranceSeconds must be > 0");
  validateAbsoluteStateAdapter(stateAdapter);
  validateMeanEclipticOfDateTransform(frameTransform);

  const targetLongitudeDegrees = normalizeDegrees(longitudeDegrees);
  let halfWidth = initialHalfBracketDays;
  let left;
  let right;
  let leftEval;
  let rightEval;

  while (true) {
    left = seedTtJulianDay - halfWidth;
    right = seedTtJulianDay + halfWidth;
    leftEval = residualAt({
      ttJulianDay:left,
      longitudeDegrees:targetLongitudeDegrees,
      stateAdapter,
      frameTransform,
      corrections
    });
    rightEval = residualAt({
      ttJulianDay:right,
      longitudeDegrees:targetLongitudeDegrees,
      stateAdapter,
      frameTransform,
      corrections
    });
    if (leftEval.residualDegrees === 0 || rightEval.residualDegrees === 0
      || Math.sign(leftEval.residualDegrees) !== Math.sign(rightEval.residualDegrees)) break;
    if (halfWidth >= maxHalfBracketDays) {
      throw new RangeError(`could not bracket ${targetLongitudeDegrees}° seasonal crossing near TT JD ${seedTtJulianDay}`);
    }
    halfWidth = Math.min(maxHalfBracketDays, halfWidth * 2);
  }

  const toleranceDays = toleranceSeconds / SECONDS_PER_DAY;
  let iterations = 0;
  let mid = left;
  let midEval = leftEval;
  while ((right - left) > toleranceDays && iterations < 80) {
    mid = (left + right) / 2;
    midEval = residualAt({
      ttJulianDay:mid,
      longitudeDegrees:targetLongitudeDegrees,
      stateAdapter,
      frameTransform,
      corrections
    });
    if (midEval.residualDegrees === 0) {
      left = mid;
      right = mid;
      break;
    }
    if (Math.sign(leftEval.residualDegrees) === Math.sign(midEval.residualDegrees)) {
      left = mid;
      leftEval = midEval;
    } else {
      right = mid;
      rightEval = midEval;
    }
    iterations += 1;
  }

  const ttJulianDay = (left + right) / 2;
  const solved = apparentGeocentricSolarLongitudeOfDate({
    ttJulianDay,
    stateAdapter,
    frameTransform,
    ...corrections
  });
  return Object.freeze({
    providerId:stateAdapter.providerId,
    stateAdapterId:stateAdapter.id,
    frameTransformId:frameTransform.id,
    referenceSemantics:ABSOLUTE_STATE_SEASONAL_REFERENCE_SEMANTICS,
    timeScale:"TT",
    yearBasis:"atlas-solar-term-catalogue",
    year,
    targetLongitudeDegrees,
    seedTtJulianDay,
    bracketHalfWidthDays:halfWidth,
    iterations,
    ttJulianDay,
    solvedLongitudeDegrees:solved.longitudeDegrees,
    residualDegrees:Math.abs(signedAngularResidualDegrees(solved.longitudeDegrees, targetLongitudeDegrees))
  });
}
