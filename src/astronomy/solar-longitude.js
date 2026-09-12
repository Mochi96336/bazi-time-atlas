import { JulianDay, ShouXingUtil, SolarTime } from "../../vendor/tyme4ts-1.5.2.mjs";

const DEG_PER_RAD = 180 / Math.PI;

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Apparent geocentric solar ecliptic longitude for one actual instant.
 *
 * `input` is a local civil clock reading. `utcOffsetHours` says how that clock
 * maps to UTC; no longitude/true-solar-time correction is applied here.
 *
 * Tyme's JulianDay conversion treats the supplied clock fields as a plain
 * civil timestamp. We subtract the explicit UTC offset, convert UTC to TT with
 * Tyme's own ΔT model, then evaluate the same ShouXingUtil.saLon astronomy core
 * used by Tyme's solar-term solver.
 */
export function apparentSolarLongitude(input, utcOffsetHours) {
  assertFinite("utcOffsetHours", utcOffsetHours);
  if (utcOffsetHours < -14 || utcOffsetHours > 14) {
    throw new RangeError("utcOffsetHours must be between -14 and +14");
  }

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
  const ttDaysFromJ2000 = utcDaysFromJ2000 + ShouXingUtil.dtT(utcDaysFromJ2000);
  const ttCenturiesFromJ2000 = ttDaysFromJ2000 / 36525;
  const longitudeRadians = ShouXingUtil.saLon(ttCenturiesFromJ2000, -1);

  return normalizeDegrees(longitudeRadians * DEG_PER_RAD);
}

export function shortestAngularError(actualDegrees, expectedDegrees) {
  const delta = normalizeDegrees(actualDegrees - expectedDegrees);
  return Math.min(delta, 360 - delta);
}
