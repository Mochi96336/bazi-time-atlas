import { JulianDay, SolarTime } from "../../vendor/tyme4ts-1.5.2.mjs";

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function validateOffset(utcOffsetHours) {
  assertFinite("utcOffsetHours", utcOffsetHours);
  if (utcOffsetHours < -14 || utcOffsetHours > 14) {
    throw new RangeError("utcOffsetHours must be between -14 and +14");
  }
}

function validateLongitude(longitudeDegrees) {
  assertFinite("longitudeDegrees", longitudeDegrees);
  if (longitudeDegrees < -180 || longitudeDegrees > 180) {
    throw new RangeError("longitudeDegrees must be between -180 and +180");
  }
}

function solarTimeFields(time) {
  return {
    year: time.getYear(),
    month: time.getMonth(),
    day: time.getDay(),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond()
  };
}

/**
 * Signed civil-clock → local-mean-solar correction in minutes.
 *
 * East longitude is positive. `utcOffsetHours` must be the effective civil
 * offset at the birth instant (including DST/political offset when relevant).
 * The formula is equivalent to converting the civil timestamp to UTC first,
 * then adding longitude / 15 hours.
 */
export function longitudeCorrectionMinutes(longitudeDegrees, utcOffsetHours) {
  validateLongitude(longitudeDegrees);
  validateOffset(utcOffsetHours);
  return longitudeDegrees * 4 - utcOffsetHours * 60;
}

/**
 * Convert one local civil clock reading to local mean solar time (LMST).
 *
 * This is longitude correction only. It deliberately does not apply the
 * date-dependent Equation of Time and therefore must not be labelled local
 * apparent / "true" solar time.
 */
export function localMeanSolarTime(input, longitudeDegrees, utcOffsetHours) {
  validateLongitude(longitudeDegrees);
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

  const civilJulianDay = local.getJulianDay().getDay();
  const utcJulianDay = civilJulianDay - utcOffsetHours / 24;
  const meanSolarJulianDay = utcJulianDay + longitudeDegrees / 360;
  const meanSolar = JulianDay.fromJulianDay(meanSolarJulianDay).getSolarTime();

  return {
    civil: solarTimeFields(local),
    meanSolar: solarTimeFields(meanSolar),
    longitudeDegrees,
    utcOffsetHours,
    correctionMinutes: longitudeCorrectionMinutes(longitudeDegrees, utcOffsetHours),
    method: "local-mean-solar-time"
  };
}
