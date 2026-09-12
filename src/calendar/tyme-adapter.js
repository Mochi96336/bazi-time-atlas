import {
  DefaultEightCharProvider,
  LunarHour,
  LunarSect2EightCharProvider,
  SolarTime
} from "tyme4ts";

export const DAY_BOUNDARY = Object.freeze({
  ZI_INITIAL_NEXT_DAY: "zi-initial-next-day",
  CIVIL_MIDNIGHT: "civil-midnight"
});

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

/**
 * Resolve four pillars from local civil date/time components.
 *
 * Deliberately does not create a JavaScript Date: callers must provide the
 * birthplace-local civil clock reading. Time-zone conversion and true-solar
 * correction are separate responsibilities and are not silently applied here.
 */
export function resolveBirthPillars(input, options = {}) {
  validateInput(input);
  const dayBoundary = options.dayBoundary ?? DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY;
  if (!Object.values(DAY_BOUNDARY).includes(dayBoundary)) {
    throw new RangeError(`unsupported dayBoundary: ${dayBoundary}`);
  }

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

  const eightChar = resolveEightChar(solarTime, dayBoundary);
  const year = pillarView(eightChar.getYear());
  const month = pillarView(eightChar.getMonth());
  const day = pillarView(eightChar.getDay());
  let hour = pillarView(eightChar.getHour());

  // Tyme's Sect2 provider preserves the civil-date day pillar at late Zi but
  // intentionally keeps the library's default Zi-hour stem. Our user-facing
  // CIVIL_MIDNIGHT mode instead applies one coherent rule: first determine the
  // effective day pillar, then feed that day stem into Five Rats.
  if (dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT && input.hour === 23) {
    hour = hourPillarFromDayStem(day.stem, hour.branch);
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
      timeBasis: "local-civil-time"
    },
    pillars: { year, month, day, hour }
  };
}
