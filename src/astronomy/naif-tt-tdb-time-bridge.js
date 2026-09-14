const J2000_JULIAN_DAY = 2451545.0;
const SECONDS_PER_DAY = 86400;

// Nominal DELTET constants documented by NASA/JPL NAIF SPICE.
const K_SECONDS = 1.657e-3;
const EARTH_MOON_BARYCENTER_ECCENTRICITY = 1.671e-2;
const MEAN_ANOMALY_AT_J2000_RADIANS = 6.239996;
const MEAN_ANOMALY_RATE_RADIANS_PER_SECOND = 1.99096871e-7;
const FIXED_POINT_ITERATIONS = 6;

export const NAIF_SPICE_TT_TDB_MODEL = Object.freeze({
  id:"naif-spice-deltet-tt-tdb",
  authority:"NASA/JPL NAIF SPICE Time Required Reading",
  sourceUrl:"https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/time.html",
  unitimUrl:"https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/unitim_c.html",
  inputScale:"TT",
  outputScale:"TDB",
  model:"TDB-TT = K*sin(E); E = M + EB*sin(M); M = M0 + M1*TDB_seconds",
  constants:Object.freeze({
    kSeconds:K_SECONDS,
    eb:EARTH_MOON_BARYCENTER_ECCENTRICITY,
    meanAnomalyAtJ2000Radians:MEAN_ANOMALY_AT_J2000_RADIANS,
    meanAnomalyRateRadiansPerSecond:MEAN_ANOMALY_RATE_RADIANS_PER_SECOND
  }),
  documentedApproximationAccuracySeconds:0.00003,
  completeRelativisticCoordinateTimeDefinition:false,
  civilTimeIndependent:true,
  note:"This intentionally reproduces the bounded NAIF/SPICE DELTET model used by UNITIM for TT/TDB conversion. It is not the full relativistic DE441 coordinate-time integral and must not be described as exact TDB."
});

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function tdbMinusTtSecondsFromTdbSeconds(tdbSecondsPastJ2000) {
  const meanAnomaly = MEAN_ANOMALY_AT_J2000_RADIANS
    + MEAN_ANOMALY_RATE_RADIANS_PER_SECOND * tdbSecondsPastJ2000;
  const eccentricAnomaly = meanAnomaly
    + EARTH_MOON_BARYCENTER_ECCENTRICITY * Math.sin(meanAnomaly);
  return K_SECONDS * Math.sin(eccentricAnomaly);
}

/**
 * Convert TT seconds past J2000 to the corresponding TDB seconds past J2000
 * using the NAIF/SPICE DELTET periodic approximation.
 *
 * The right-hand side is expressed on the TDB axis, so solve the millisecond
 * correction by fixed-point iteration rather than silently evaluating it on TT.
 */
export function ttSecondsPastJ2000ToTdbSeconds(ttSecondsPastJ2000) {
  assertFinite("ttSecondsPastJ2000", ttSecondsPastJ2000);
  let tdbSecondsPastJ2000 = ttSecondsPastJ2000;
  for (let iteration = 0; iteration < FIXED_POINT_ITERATIONS; iteration += 1) {
    tdbSecondsPastJ2000 = ttSecondsPastJ2000
      + tdbMinusTtSecondsFromTdbSeconds(tdbSecondsPastJ2000);
  }
  return tdbSecondsPastJ2000;
}

export function tdbMinusTtSecondsAtTtJulianDay(ttJulianDay) {
  assertFinite("ttJulianDay", ttJulianDay);
  const ttSecondsPastJ2000 = (ttJulianDay - J2000_JULIAN_DAY) * SECONDS_PER_DAY;
  const tdbSecondsPastJ2000 = ttSecondsPastJ2000ToTdbSeconds(ttSecondsPastJ2000);
  return tdbSecondsPastJ2000 - ttSecondsPastJ2000;
}

/**
 * Julian-day bridge used by the DE441 state adapter contract.
 *
 * Returning a single IEEE-754 Julian Day necessarily has coarser resolution
 * than the seconds-past-J2000 representation at deep epochs. Callers needing
 * the correction itself should use tdbMinusTtSecondsAtTtJulianDay().
 */
export function ttJulianDayToTdbJulianDay(ttJulianDay) {
  assertFinite("ttJulianDay", ttJulianDay);
  const ttSecondsPastJ2000 = (ttJulianDay - J2000_JULIAN_DAY) * SECONDS_PER_DAY;
  const tdbSecondsPastJ2000 = ttSecondsPastJ2000ToTdbSeconds(ttSecondsPastJ2000);
  return J2000_JULIAN_DAY + tdbSecondsPastJ2000 / SECONDS_PER_DAY;
}
