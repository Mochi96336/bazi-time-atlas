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

const providerByConvention = {
  [DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY]: () => new DefaultEightCharProvider(),
  [DAY_BOUNDARY.CIVIL_MIDNIGHT]: () => new LunarSect2EightCharProvider()
};

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
 * Resolve four pillars from local civil date/time components.
 *
 * Deliberately does not create a JavaScript Date: callers must provide the
 * birthplace-local civil clock reading. Time-zone conversion and true-solar
 * correction are separate responsibilities and are not silently applied here.
 */
export function resolveBirthPillars(input, options = {}) {
  validateInput(input);
  const dayBoundary = options.dayBoundary ?? DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY;
  const providerFactory = providerByConvention[dayBoundary];
  if (!providerFactory) {
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

  const eightChar = withProvider(providerFactory(), () =>
    solarTime.getLunarHour().getEightChar()
  );

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
      timeBasis: "local-civil-time"
    },
    pillars: {
      year: pillarView(eightChar.getYear()),
      month: pillarView(eightChar.getMonth()),
      day: pillarView(eightChar.getDay()),
      hour: pillarView(eightChar.getHour())
    }
  };
}
