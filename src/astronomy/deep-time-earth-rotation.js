import { DEEP_TIME_EARTH_ROTATION_EVIDENCE } from "./deep-time-earth-rotation-evidence.js";

const SECONDS_PER_DAY = 86_400;
const LONG_TERM_PARABOLA_START_YEAR = 2150;
const FUTURE_UNCERTAINTY_CALIBRATION_YEAR = 2005;
const FUTURE_UNCERTAINTY_OBSERVED_SPAN_YEARS = 2500;
const FUTURE_UNCERTAINTY_Q_MS2_PER_YEAR = 0.058;

function assertFinite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function isGregorianLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInGregorianYear(year) {
  return isGregorianLeapYear(year) ? 366 : 365;
}

function gregorianCalendarAtJulianDay(julianDay) {
  assertFinite(julianDay, "julianDay");
  const shifted = julianDay + 0.5;
  const z = Math.floor(shifted);
  const f = shifted - z;
  const alpha = Math.floor((z - 1_867_216.25) / 36_524.25);
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day };
}

export function prolepticGregorianDecimalYearAtJulianDay(julianDay) {
  const { year, month, day } = gregorianCalendarAtJulianDay(julianDay);
  const monthLengths = [31, isGregorianLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const completedMonthDays = monthLengths.slice(0, month - 1).reduce((sum, value) => sum + value, 0);
  const dayOfYearZeroBased = completedMonthDays + day - 1;
  return year + dayOfYearZeroBased / daysInGregorianYear(year);
}

export function deepTimeEarthRotationEstimateSupportsYear(year) {
  return Number.isInteger(year) && year > LONG_TERM_PARABOLA_START_YEAR;
}

export function longTermDeltaTPointEstimateSeconds(decimalYear) {
  assertFinite(decimalYear, "decimalYear");
  if (decimalYear <= LONG_TERM_PARABOLA_START_YEAR) {
    throw new RangeError(`long-term Delta T extrapolation requires decimalYear > ${LONG_TERM_PARABOLA_START_YEAR}`);
  }
  const u = (decimalYear - 1820) / 100;
  return -20 + 32 * u * u;
}

export function futureDeltaTOneSigmaSeconds(decimalYear) {
  assertFinite(decimalYear, "decimalYear");
  if (decimalYear < FUTURE_UNCERTAINTY_CALIBRATION_YEAR) {
    throw new RangeError(`future Delta T uncertainty requires decimalYear >= ${FUTURE_UNCERTAINTY_CALIBRATION_YEAR}`);
  }
  const n = decimalYear - FUTURE_UNCERTAINTY_CALIBRATION_YEAR;
  const m = FUTURE_UNCERTAINTY_OBSERVED_SPAN_YEARS;
  const q = FUTURE_UNCERTAINTY_Q_MS2_PER_YEAR;
  return 365.25 * n * Math.sqrt((n * q / 3) * (1 + n / m)) / 1000;
}

/**
 * Estimate UT1 from a TT Julian day in the deep future while preserving the
 * uncertainty that dominates the conversion. The ±1σ interval is descriptive,
 * not a hard bound; callers must not treat it as proof of a unique civil clock.
 */
export function estimateDeepTimeUt1FromTtJulianDay(ttJulianDay) {
  assertFinite(ttJulianDay, "ttJulianDay");
  const decimalYear = prolepticGregorianDecimalYearAtJulianDay(ttJulianDay);
  const deltaTSecondsEstimate = longTermDeltaTPointEstimateSeconds(decimalYear);
  const oneSigmaUncertaintySeconds = futureDeltaTOneSigmaSeconds(decimalYear);
  const ut1JulianDayEstimate = ttJulianDay - deltaTSecondsEstimate / SECONDS_PER_DAY;
  const oneSigmaUt1JulianDayMin = ttJulianDay
    - (deltaTSecondsEstimate + oneSigmaUncertaintySeconds) / SECONDS_PER_DAY;
  const oneSigmaUt1JulianDayMax = ttJulianDay
    - (deltaTSecondsEstimate - oneSigmaUncertaintySeconds) / SECONDS_PER_DAY;

  return Object.freeze({
    evidenceId:DEEP_TIME_EARTH_ROTATION_EVIDENCE.id,
    inputTimeScale:"TT",
    outputTimeScale:"UT1",
    ttJulianDay,
    decimalYear,
    deltaTSecondsEstimate,
    oneSigmaUncertaintySeconds,
    ut1JulianDayEstimate,
    oneSigmaUt1JulianDayMin,
    oneSigmaUt1JulianDayMax,
    uncertaintySemantics:"one-standard-error-not-hard-bound",
    modelClass:"deep-time-extrapolation",
    extrapolated:true,
    pointEstimateAvailable:true,
    uncertaintyQuantified:true,
    deterministicUt1:false,
    utcResolved:false,
    civilTimeResolved:false,
    deterministicDayHourBridge:false
  });
}

export const DEEP_TIME_EARTH_ROTATION_MODEL = Object.freeze({
  id:"nasa-long-term-deltat-plus-huber-uncertainty-v1",
  evidenceId:DEEP_TIME_EARTH_ROTATION_EVIDENCE.id,
  inputTimeScale:"TT",
  outputTimeScale:"UT1",
  longTermParabolaStartYear:LONG_TERM_PARABOLA_START_YEAR,
  uncertaintyCalibrationYear:FUTURE_UNCERTAINTY_CALIBRATION_YEAR,
  uncertaintySemantics:"one-standard-error-not-hard-bound",
  deterministic:false,
  resolvesUtc:false,
  resolvesCivilTime:false
});