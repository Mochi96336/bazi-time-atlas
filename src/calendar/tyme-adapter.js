import {
  DefaultEightCharProvider,
  JulianDay,
  LunarHour,
  LunarSect2EightCharProvider,
  SolarTime
} from "../../vendor/tyme4ts-1.5.2.mjs";
import { DAY_BOUNDARY, isDayBoundary } from "./day-boundary.js";

export { DAY_BOUNDARY } from "./day-boundary.js";
export const SOLAR_TERM_REFERENCE_UTC_OFFSET = 8;

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function assertInteger(name, value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
  }
}

function validateInput(input) {
  assertInteger("year", input.year, -9999, 9999);
  assertInteger("month", input.month, 1, 12);
  assertInteger("day", input.day, 1, 31);
  assertInteger("hour", input.hour, 0, 23);
  assertInteger("minute", input.minute ?? 0, 0, 59);
  assertInteger("second", input.second ?? 0, 0, 59);
}

function validateUtcOffset(value) {
  if (!Number.isFinite(value) || value < -14 || value > 14) {
    throw new RangeError("utcOffsetHours must be a finite number from -14 to +14");
  }
}

function validateDayBoundary(dayBoundary) {
  if (!isDayBoundary(dayBoundary)) {
    throw new RangeError(`unsupported dayBoundary: ${dayBoundary}`);
  }
}

function pillarView(sixtyCycle) {
  return {
    name: sixtyCycle.getName(),
    stem: sixtyCycle.getHeavenStem().getName(),
    branch: sixtyCycle.getEarthBranch().getName()
  };
}

function plainPillar(stem, branch) {
  return { name: `${stem}${branch}`, stem, branch };
}

function withProvider(provider, fn) {
  const previous = LunarHour.provider;
  LunarHour.provider = provider;
  try {
    return fn();
  } finally {
    LunarHour.provider = previous;
  }
}

/**
 * Five Rats / 日上起時: derive the hour stem from the effective day stem and
 * the already-determined hour branch. Keeping this tiny deterministic rule in
 * the adapter makes the civil-midnight convention internally consistent at
 * 23:00–23:59, where Tyme's LunarSect2 provider intentionally keeps the old
 * day pillar but retains its default late-Zi hour pillar.
 */
function hourPillarFromDayStem(dayStem, hourBranch) {
  const dayStemIndex = STEMS.indexOf(dayStem);
  const branchIndex = BRANCHES.indexOf(hourBranch);
  if (dayStemIndex < 0 || branchIndex < 0) {
    throw new RangeError("unknown stem or branch while deriving hour pillar");
  }
  const ziStemIndex = (dayStemIndex % 5) * 2;
  const hourStem = STEMS[(ziStemIndex + branchIndex) % 10];
  return plainPillar(hourStem, hourBranch);
}

function resolveEightChar(solarTime, dayBoundary) {
  if (dayBoundary === DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY) {
    return withProvider(new DefaultEightCharProvider(), () =>
      solarTime.getLunarHour().getEightChar()
    );
  }
  if (dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT) {
    return withProvider(new LunarSect2EightCharProvider(), () =>
      solarTime.getLunarHour().getEightChar()
    );
  }
  throw new RangeError(`unsupported dayBoundary: ${dayBoundary}`);
}

function dayHourFromSolarTime(solarTime, sourceHour, dayBoundary) {
  const eightChar = resolveEightChar(solarTime, dayBoundary);
  const day = pillarView(eightChar.getDay());
  let hour = pillarView(eightChar.getHour());

  if (dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT && sourceHour === 23) {
    hour = hourPillarFromDayStem(day.stem, hour.branch);
  }

  return { day, hour };
}

/**
 * Resolve only Day + Hour pillars from one already-normalized local clock.
 *
 * This helper deliberately knows nothing about UTC, longitude, solar terms or
 * which clock basis produced the supplied fields. Callers may therefore use
 * the exact same day-boundary + Five-Rats logic for civil, mean-solar or
 * apparent-solar what-if comparisons without moving the Year/Month instant.
 */
export function resolveDayHourPillars(input, options = {}) {
  validateInput(input);
  const dayBoundary = options.dayBoundary ?? DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY;
  validateDayBoundary(dayBoundary);

  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  const solarTime = SolarTime.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour,
    minute,
    second
  );
  const pillars = dayHourFromSolarTime(solarTime, input.hour, dayBoundary);

  return {
    input: {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute,
      second
    },
    convention: {
      dayBoundary,
      hourStemRule: "five-rats-from-effective-day-stem",
      timeBasis: options.timeBasis ?? "provided-local-clock"
    },
    pillars
  };
}

/**
 * Tyme's solar-term clock is expressed in UTC+8. Convert one birthplace-local
 * civil timestamp to the UTC+8 clock reading of the SAME physical instant.
 * This conversion is used only for year/month solar-term boundaries.
 */
function toSolarTermReferenceTime(localSolarTime, utcOffsetHours) {
  const shiftDays = (SOLAR_TERM_REFERENCE_UTC_OFFSET - utcOffsetHours) / 24;
  return JulianDay
    .fromJulianDay(localSolarTime.getJulianDay().getDay() + shiftDays)
    .getSolarTime();
}

// ---------------------------------------------------------------------------
// Exact memoisation. Every Tyme EightChar evaluation builds a lunar date (new
// moon series) and solar-term search; a wheel drag resolves a new instant on
// every frame. Both caches below key on what the pillars provably depend on,
// so Tyme stays the only calendar authority:
//   - Day/Hour depend only on the local date, the hour branch (with 23:00 kept
//     distinct: it carries the next day's stem) and the day-boundary rule.
//   - Year/Month are constant between one Jie and the next (Li Chun is a Jie).
//     The interval is taken from Tyme's own SolarTerm instants, and reuse is
//     strictly inside it, so an instant on a boundary second is recomputed.
const DAY_HOUR_CACHE_LIMIT = 512;
const JIE_INTERVAL_CACHE_LIMIT = 16;
const dayHourCache = new Map();
let jieIntervalCache = [];

function clockKey(time) {
  return fieldsClockKey({
    year: time.getYear(), month: time.getMonth(), day: time.getDay(),
    hour: time.getHour(), minute: time.getMinute(), second: time.getSecond()
  });
}

function fieldsClockKey(fields) {
  return (((((fields.year * 12 + fields.month - 1) * 31 + fields.day - 1) * 24
    + fields.hour) * 60 + (fields.minute ?? 0)) * 60) + (fields.second ?? 0);
}

/**
 * Exact Year/Month for UTC+8 solar-term clock fields if a previously resolved
 * Jie interval already covers them; null otherwise. Never computes.
 */
export function peekCachedYearMonth(referenceFields) {
  const key = fieldsClockKey(referenceFields);
  const hit = jieIntervalCache.find(entry => entry.startKey < key && key < entry.endKey);
  return hit ? { year: { ...hit.year }, month: { ...hit.month } } : null;
}

function cachedDayHour(solarTime, sourceHour, dayBoundary) {
  const branchSlot = sourceHour === 23 ? 23 : ~~((sourceHour + 1) / 2);
  const key = `${dayBoundary}|${solarTime.getYear()}|${solarTime.getMonth()}|${solarTime.getDay()}|${branchSlot}`;
  let pillars = dayHourCache.get(key);
  if (!pillars) {
    pillars = dayHourFromSolarTime(solarTime, sourceHour, dayBoundary);
    if (dayHourCache.size >= DAY_HOUR_CACHE_LIMIT) dayHourCache.delete(dayHourCache.keys().next().value);
    dayHourCache.set(key, pillars);
  }
  return { day: { ...pillars.day }, hour: { ...pillars.hour } };
}

function cachedYearMonth(referenceSolarTime) {
  const key = clockKey(referenceSolarTime);
  const hit = jieIntervalCache.find(entry => entry.startKey < key && key < entry.endKey);
  if (hit) return { year: { ...hit.year }, month: { ...hit.month } };

  // Year/month are taken from the same astronomical instant expressed on
  // Tyme's UTC+8 solar-term reference clock. Day-boundary choice cannot alter
  // them, so use the default provider for this projection.
  const referenceEightChar = resolveEightChar(
    referenceSolarTime,
    DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  );
  const year = pillarView(referenceEightChar.getYear());
  const month = pillarView(referenceEightChar.getMonth());

  let jie = referenceSolarTime.getTerm();
  if (jie.isQi()) jie = jie.next(-1);
  const startKey = clockKey(jie.getJulianDay().getSolarTime());
  const endKey = clockKey(jie.next(2).getJulianDay().getSolarTime());
  if (startKey <= key && key < endKey) {
    jieIntervalCache = [{ startKey, endKey, year, month }, ...jieIntervalCache]
      .slice(0, JIE_INTERVAL_CACHE_LIMIT);
  }
  return { year: { ...year }, month: { ...month } };
}

/**
 * Resolve four pillars from birthplace-local civil date/time components.
 *
 * Year/month are instant-based solar-term rules, so the same physical instant
 * is converted to Tyme's UTC+8 solar-term reference clock before evaluating
 * Li Chun / Jie boundaries. Day/hour remain local-clock rules and therefore
 * stay on the supplied birthplace-local date and time.
 *
 * True-solar-time / longitude correction is intentionally NOT applied here.
 */
export function resolveBirthPillars(input, options = {}) {
  validateInput(input);
  const dayBoundary = options.dayBoundary ?? DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY;
  validateDayBoundary(dayBoundary);

  const utcOffsetHours = options.utcOffsetHours ?? SOLAR_TERM_REFERENCE_UTC_OFFSET;
  validateUtcOffset(utcOffsetHours);

  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  const localSolarTime = SolarTime.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour,
    minute,
    second
  );
  const referenceSolarTime = toSolarTermReferenceTime(localSolarTime, utcOffsetHours);

  let year;
  let month;
  let day;
  let hour;
  if (options.cache === false) {
    const referenceEightChar = resolveEightChar(
      referenceSolarTime,
      DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    );
    year = pillarView(referenceEightChar.getYear());
    month = pillarView(referenceEightChar.getMonth());
    // Day/hour are birthplace-local civil-time rules.
    ({ day, hour } = dayHourFromSolarTime(localSolarTime, input.hour, dayBoundary));
  } else {
    ({ year, month } = cachedYearMonth(referenceSolarTime));
    ({ day, hour } = cachedDayHour(localSolarTime, input.hour, dayBoundary));
  }

  return {
    input: {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute,
      second
    },
    convention: {
      yearBoundary: "exact-li-chun",
      monthBoundary: "exact-jie",
      dayBoundary,
      hourStemRule: "five-rats-from-effective-day-stem",
      timeBasis: "birthplace-local-civil-time",
      utcOffsetHours,
      solarTermReferenceUtcOffset: SOLAR_TERM_REFERENCE_UTC_OFFSET
    },
    pillars: { year, month, day, hour }
  };
}
