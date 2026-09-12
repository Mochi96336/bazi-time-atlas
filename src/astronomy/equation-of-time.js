import { JulianDay, ShouXingUtil, SolarTime } from "../../vendor/tyme4ts-1.5.2.mjs";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const MINUTES_PER_DEGREE = 4;
const MINUTES_PER_REVOLUTION = 1440;
const APPARENT_MEAN_LONGITUDE_CORRECTION_DEGREES = 0.0057183;

const MEAN_OBLIQUITY_COEFFICIENTS = Object.freeze([
  84381.448,
  -4680.93,
  -1.55,
  1999.25,
  -51.38,
  -249.67,
  -39.05,
  7.12,
  27.87,
  5.79,
  2.45
]);

const SUN_MEAN_LONGITUDE_COEFFICIENTS = Object.freeze([
  280.4664567,
  360007.6982779,
  0.03032028,
  1 / 49931,
  -1 / 15300,
  -1 / 2000000
]);

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function validateOffset(utcOffsetHours) {
  assertFinite("utcOffsetHours", utcOffsetHours);
  if (utcOffsetHours < -14 || utcOffsetHours > 14) {
    throw new RangeError("utcOffsetHours must be between -14 and +14");
  }
}

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function polynomial(coefficients, x) {
  return coefficients.reduceRight((acc, coefficient) => acc * x + coefficient, 0);
}

/** NREL SPA Appendix A.2 mean Sun longitude, degrees in [0, 360). */
export function sunMeanLongitudeDegrees(julianMillenniumEphemeris) {
  assertFinite("julianMillenniumEphemeris", julianMillenniumEphemeris);
  return normalizeDegrees(polynomial(SUN_MEAN_LONGITUDE_COEFFICIENTS, julianMillenniumEphemeris));
}

/** NREL SPA equation 24 mean obliquity, degrees. */
export function meanObliquityDegrees(julianMillenniumEphemeris) {
  assertFinite("julianMillenniumEphemeris", julianMillenniumEphemeris);
  const u = julianMillenniumEphemeris / 10;
  return polynomial(MEAN_OBLIQUITY_COEFFICIENTS, u) / 3600;
}

function rightAscensionDegrees(apparentLongitudeDegrees, obliquityDegrees) {
  const lambda = apparentLongitudeDegrees * DEG_TO_RAD;
  const epsilon = obliquityDegrees * DEG_TO_RAD;
  return normalizeDegrees(Math.atan2(
    Math.cos(epsilon) * Math.sin(lambda),
    Math.cos(lambda)
  ) * RAD_TO_DEG);
}

function wrapEquationMinutes(minutes) {
  let value = minutes;
  while (value > 20) value -= MINUTES_PER_REVOLUTION;
  while (value < -20) value += MINUTES_PER_REVOLUTION;
  return value;
}

function timeContext(input, utcOffsetHours, deltaTSeconds) {
  validateOffset(utcOffsetHours);
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  const local = SolarTime.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour,
    minute,
    second
  );

  const localJulianDay = local.getJulianDay().getDay();
  const utcJulianDay = localJulianDay - utcOffsetHours / 24;
  const utcDaysFromJ2000 = utcJulianDay - JulianDay.J2000;

  let deltaTDays;
  if (deltaTSeconds === undefined) {
    deltaTDays = ShouXingUtil.dtT(utcDaysFromJ2000);
  } else {
    assertFinite("deltaTSeconds", deltaTSeconds);
    deltaTDays = deltaTSeconds / 86400;
  }

  const ttDaysFromJ2000 = utcDaysFromJ2000 + deltaTDays;
  const julianCenturyEphemeris = ttDaysFromJ2000 / 36525;
  const julianMillenniumEphemeris = julianCenturyEphemeris / 10;

  return {
    utcJulianDay,
    utcDaysFromJ2000,
    deltaTSeconds: deltaTDays * 86400,
    julianCenturyEphemeris,
    julianMillenniumEphemeris
  };
}

/**
 * Equation of Time in minutes, with the astronomical sign convention
 * apparent solar time minus mean solar time.
 *
 * The apparent solar longitude and longitude nutation come from the same
 * pinned Tyme/ShouXing core used by this atlas for solar-term longitude.
 * NREL SPA Appendix A supplies the mean-Sun longitude and Equation A1
 * relation. The mean obliquity polynomial is SPA equation 24; nutation in
 * obliquity and the Sun's tiny geocentric ecliptic latitude are intentionally
 * omitted here and guarded by differential/reference tests before this is
 * allowed to drive any Birth convention.
 *
 * `input` is a local civil clock reading and `utcOffsetHours` locates that
 * reading on the UTC timeline. `deltaTSeconds` is optional and exists mainly
 * for exact published-reference reproduction; normal calls use Tyme's ΔT.
 */
export function equationOfTime(input, utcOffsetHours, { deltaTSeconds } = {}) {
  const context = timeContext(input, utcOffsetHours, deltaTSeconds);
  const t = context.julianCenturyEphemeris;
  const jme = context.julianMillenniumEphemeris;

  const apparentLongitudeDegrees = normalizeDegrees(ShouXingUtil.saLon(t, -1) * RAD_TO_DEG);
  const nutationLongitudeDegrees = ShouXingUtil.nutationLon2(t) * RAD_TO_DEG;
  const obliquityDegrees = meanObliquityDegrees(jme);
  const geocentricRightAscensionDegrees = rightAscensionDegrees(
    apparentLongitudeDegrees,
    obliquityDegrees
  );
  const meanLongitudeDegrees = sunMeanLongitudeDegrees(jme);

  const rawDegrees = meanLongitudeDegrees
    - geocentricRightAscensionDegrees
    + nutationLongitudeDegrees * Math.cos(obliquityDegrees * DEG_TO_RAD)
    - APPARENT_MEAN_LONGITUDE_CORRECTION_DEGREES;
  const minutes = wrapEquationMinutes(rawDegrees * MINUTES_PER_DEGREE);

  return {
    minutes,
    method: "tyme-apparent-sun+nrel-spa-a1",
    meanLongitudeDegrees,
    apparentLongitudeDegrees,
    geocentricRightAscensionDegrees,
    nutationLongitudeDegrees,
    obliquityDegrees,
    ...context
  };
}
