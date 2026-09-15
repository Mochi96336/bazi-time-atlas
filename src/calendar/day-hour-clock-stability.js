import { DAY_BOUNDARY, DAY_BOUNDARY_VALUES } from "./day-boundary.js";

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const HOUR_BRANCH_BOUNDARIES_SECONDS = Object.freeze(
  Array.from({ length:12 }, (_, index) => (2 * index + 1) * SECONDS_PER_HOUR)
);

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function normalizeClock(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("localClock must be an object");
  }
  const hour = input.hour;
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("localClock.hour must be an integer from 0 to 23");
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError("localClock.minute must be an integer from 0 to 59");
  }
  assertFinite("localClock.second", second);
  if (second < 0 || second >= 60) {
    throw new RangeError("localClock.second must be at least 0 and less than 60");
  }
  return Object.freeze({ hour, minute, second });
}

function assertDayBoundary(value) {
  if (!DAY_BOUNDARY_VALUES.includes(value)) {
    throw new RangeError(`dayBoundary must be one of: ${DAY_BOUNDARY_VALUES.join(", ")}`);
  }
}

function secondsOfDay(clock) {
  return clock.hour * SECONDS_PER_HOUR + clock.minute * 60 + clock.second;
}

function circularDistanceSeconds(a, b) {
  const direct = Math.abs(a - b);
  return Math.min(direct, SECONDS_PER_DAY - direct);
}

function nearestBoundary(seconds, boundaries) {
  let marginSeconds = Number.POSITIVE_INFINITY;
  let nearestSeconds = [];
  for (const boundarySeconds of boundaries) {
    const distance = circularDistanceSeconds(seconds, boundarySeconds);
    if (distance < marginSeconds) {
      marginSeconds = distance;
      nearestSeconds = [boundarySeconds];
    } else if (distance === marginSeconds) {
      nearestSeconds.push(boundarySeconds);
    }
  }
  return Object.freeze({ marginSeconds, nearestSeconds:Object.freeze(nearestSeconds) });
}

function dayBoundarySeconds(dayBoundary) {
  return dayBoundary === DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    ? 23 * SECONDS_PER_HOUR
    : 0;
}

/**
 * Evaluate whether a supplied, already-normalized local clock keeps the same
 * Day + Hour pillar membership under a symmetric clock-reading uncertainty.
 *
 * This function does not decide where the uncertainty came from and does not
 * grant astronomy/model authority. It is a deterministic boundary primitive:
 * callers may later feed it a separately-authorized EoT or time-conversion
 * error radius.
 *
 * Hour-branch boundaries are 23:00, 01:00, 03:00, ... 21:00. The selected Day
 * boundary is checked independently because `civil-midnight` can change the
 * effective day stem at 00:00 without changing the Zi hour branch; Five-Rats
 * can therefore change the Hour pillar even when the branch itself is stable.
 */
export function dayHourLocalClockStability(
  localClock,
  { dayBoundary = DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY, uncertaintySeconds = 0 } = {}
) {
  const clock = normalizeClock(localClock);
  assertDayBoundary(dayBoundary);
  assertFinite("uncertaintySeconds", uncertaintySeconds);
  if (uncertaintySeconds < 0) {
    throw new RangeError("uncertaintySeconds must be non-negative");
  }

  const localSeconds = secondsOfDay(clock);
  const hour = nearestBoundary(localSeconds, HOUR_BRANCH_BOUNDARIES_SECONDS);
  const day = nearestBoundary(localSeconds, [dayBoundarySeconds(dayBoundary)]);
  const governingMarginSeconds = Math.min(hour.marginSeconds, day.marginSeconds);

  // At zero uncertainty the supplied clock is exact even when it lies exactly
  // on a convention boundary. For any positive radius, touching a boundary is
  // ambiguous because the true clock may lie on either side.
  const hourBranchStable = uncertaintySeconds === 0 || hour.marginSeconds > uncertaintySeconds;
  const dayBoundaryStable = uncertaintySeconds === 0 || day.marginSeconds > uncertaintySeconds;
  const stable = hourBranchStable && dayBoundaryStable;
  const ambiguousKinds = [];
  if (!hourBranchStable) ambiguousKinds.push("hour-branch");
  if (!dayBoundaryStable) ambiguousKinds.push("day-boundary");

  return Object.freeze({
    localClock:clock,
    localSecondsOfDay:localSeconds,
    dayBoundary,
    uncertaintySeconds,
    uncertaintySemantics:"symmetric-clock-reading-radius",
    hourBranchMarginSeconds:hour.marginSeconds,
    dayBoundaryMarginSeconds:day.marginSeconds,
    governingMarginSeconds,
    remainingStableMarginSeconds:governingMarginSeconds - uncertaintySeconds,
    hourBranchStable,
    dayBoundaryStable,
    stable,
    status:stable ? "stable" : "boundary-ambiguous",
    ambiguousKinds:Object.freeze(ambiguousKinds),
    nearestHourBranchBoundariesSeconds:hour.nearestSeconds,
    dayBoundarySeconds:dayBoundarySeconds(dayBoundary),
    authorityGranted:false,
    method:"day-hour-local-clock-boundary-stability"
  });
}

export const DAY_HOUR_LOCAL_CLOCK_STABILITY_CONTRACT = Object.freeze({
  id:"day-hour-local-clock-boundary-stability-v1",
  hourBranchBoundaryHours:Object.freeze([23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]),
  dayBoundaryValues:DAY_BOUNDARY_VALUES,
  uncertaintySemantics:"symmetric-clock-reading-radius",
  grantsAstronomyAuthority:false
});
