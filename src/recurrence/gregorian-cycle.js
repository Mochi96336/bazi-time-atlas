const MONTH_START = Object.freeze([0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]);

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function assertYear(year) {
  if (!Number.isInteger(year) || year < 1 || year > 10_000_000) {
    throw new RangeError("year must be an integer from 1 to 10000000");
  }
}

export function isGregorianLeapYear(year) {
  assertYear(year);
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInGregorianMonth(year, month) {
  assertYear(year);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("month must be an integer from 1 to 12");
  }
  if (month === 2) return isGregorianLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function validateGregorianDate({ year, month, day }) {
  try {
    assertYear(year);
    if (!Number.isInteger(month) || month < 1 || month > 12) return false;
    return Number.isInteger(day) && day >= 1 && day <= daysInGregorianMonth(year, month);
  } catch {
    return false;
  }
}

export function gregorianOrdinal({ year, month, day }) {
  if (!validateGregorianDate({ year, month, day })) throw new RangeError("invalid proleptic Gregorian date");
  const previousYear = year - 1;
  let ordinal = 365 * previousYear
    + Math.floor(previousYear / 4)
    - Math.floor(previousYear / 100)
    + Math.floor(previousYear / 400);
  ordinal += MONTH_START[month - 1] + day - 1;
  if (month > 2 && isGregorianLeapYear(year)) ordinal += 1;
  return ordinal;
}

export function recurrenceState(baseDate, deltaYears) {
  if (!validateGregorianDate(baseDate)) throw new RangeError("invalid baseDate");
  if (!Number.isInteger(deltaYears) || deltaYears < 0) throw new RangeError("deltaYears must be a non-negative integer");
  const targetDate = {
    year: baseDate.year + deltaYears,
    month: baseDate.month,
    day: baseDate.day
  };
  assertYear(targetDate.year);
  const targetValid = validateGregorianDate(targetDate);
  const dayDelta = targetValid ? gregorianOrdinal(targetDate) - gregorianOrdinal(baseDate) : null;
  const yearPhase = mod(deltaYears, 60);
  const gregorianPhase = mod(deltaYears, 400);
  const dayPhase = dayDelta === null ? null : mod(dayDelta, 60);

  return Object.freeze({
    baseDate: Object.freeze({ ...baseDate }),
    targetDate: Object.freeze(targetDate),
    deltaYears,
    targetValid,
    dayDelta,
    phases: Object.freeze({
      year: yearPhase,
      gregorian: gregorianPhase,
      day: dayPhase
    }),
    closed: Object.freeze({
      year: yearPhase === 0,
      gregorian: gregorianPhase === 0,
      day: dayPhase === 0
    })
  });
}

export function findFirstLocalYearDayRecurrence(baseDate, options = {}) {
  if (!validateGregorianDate(baseDate)) throw new RangeError("invalid baseDate");
  const maxYears = options.maxYears ?? 24_000;
  if (!Number.isInteger(maxYears) || maxYears < 60) throw new RangeError("maxYears must be an integer >= 60");

  for (let deltaYears = 60; deltaYears <= maxYears; deltaYears += 60) {
    const state = recurrenceState(baseDate, deltaYears);
    if (state.closed.year && state.closed.day) return state;
  }
  return null;
}

export function findGlobalGregorianYearDayPeriod(options = {}) {
  const maxYears = options.maxYears ?? 24_000;
  if (!Number.isInteger(maxYears) || maxYears < 400) throw new RangeError("maxYears must be an integer >= 400");
  const daysPerGregorian400Years = 146_097;

  for (let deltaYears = 400; deltaYears <= maxYears; deltaYears += 400) {
    const blocks = deltaYears / 400;
    if (deltaYears % 60 !== 0) continue;
    if ((daysPerGregorian400Years * blocks) % 60 !== 0) continue;
    return Object.freeze({
      deltaYears,
      dayDelta: daysPerGregorian400Years * blocks,
      gregorianBlocks: blocks
    });
  }
  return null;
}

export function canonicalRecurrenceCandidates(baseDate) {
  const local = findFirstLocalYearDayRecurrence(baseDate);
  const values = [60, 400, 1200, local?.deltaYears, 8000, 24_000]
    .filter(Number.isInteger);
  return [...new Set(values)]
    .sort((a, b) => a - b)
    .map(deltaYears => recurrenceState(baseDate, deltaYears));
}

export const GLOBAL_GREGORIAN_YEAR_DAY_PERIOD = 24_000;
export const GREGORIAN_400_YEAR_DAYS = 146_097;
