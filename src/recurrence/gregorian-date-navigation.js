import { daysInGregorianMonth, gregorianOrdinal, validateGregorianDate } from "./gregorian-cycle.js";

// The free-date explorer uses integer Gregorian days. It never converts through
// JS Date or claims a timezone / a physical instant for historical deep time.
// Gregorian-cycle.js intentionally limits public dates to CE years 1..10,000,000.
const FIRST_ORDINAL = 0;
const LAST_DATE = Object.freeze({ year:10_000_000, month:12, day:31 });
const LAST_ORDINAL = gregorianOrdinal(LAST_DATE);
const DAYS_PER_400_YEAR_BLOCK = 146_097;

function yearStartOrdinal(year) {
  const prior = year - 1;
  return 365 * prior + Math.floor(prior / 4)
    - Math.floor(prior / 100) + Math.floor(prior / 400);
}

export function gregorianDateFromOrdinal(ordinal) {
  if (!Number.isSafeInteger(ordinal) || ordinal < FIRST_ORDINAL || ordinal > LAST_ORDINAL) {
    throw new RangeError("Gregorian ordinal is outside the supported CE date range");
  }

  // Bound the search to one 400-year block (Gregorian leap sequence repeats).
  const block = Math.floor(ordinal / DAYS_PER_400_YEAR_BLOCK);
  let lo = block * 400 + 1;
  let hi = Math.min(lo + 399, LAST_DATE.year);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (yearStartOrdinal(mid) <= ordinal) lo = mid;
    else hi = mid - 1;
  }

  // A block boundary can coincide with the last day of the previous 400-year
  // block only if arithmetic is wrong; reject rather than mislabel a date.
  const year = lo;
  let dayOfYear = ordinal - yearStartOrdinal(year);
  let month = 1;
  while (month <= 12) {
    const days = daysInGregorianMonth(year, month);
    if (dayOfYear < days) {
      return Object.freeze({ year, month, day:dayOfYear + 1 });
    }
    dayOfYear -= days;
    month += 1;
  }
  throw new Error("Gregorian ordinal inversion failed");
}

export function shiftGregorianDate(date, days) {
  if (!validateGregorianDate(date)) throw new RangeError("invalid Gregorian start date");
  if (!Number.isSafeInteger(days)) throw new RangeError("day displacement must be a safe integer");
  const ordinal = gregorianOrdinal(date) + days;
  if (!Number.isSafeInteger(ordinal)) throw new RangeError("day displacement exceeded safe integer range");
  return gregorianDateFromOrdinal(ordinal);
}

export function differenceInGregorianDays(baseDate, targetDate) {
  if (!validateGregorianDate(baseDate) || !validateGregorianDate(targetDate)) {
    throw new RangeError("both Gregorian dates must exist");
  }
  return gregorianOrdinal(targetDate) - gregorianOrdinal(baseDate);
}
