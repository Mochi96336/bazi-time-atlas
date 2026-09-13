import {
  solarTermEventsBetween,
  solarTermNamedEventsBetween
} from "../astronomy/solar-term-boundaries.js";
import { normalizeDegrees, shortestAngleDelta } from "../wheel/polar-geometry.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const BOUNDARY_ENTRY_EPSILON_MS = 1_000;
const MONTH_SEARCH_DAYS = 400;
const YEAR_SEARCH_DAYS = 800;
const SOLAR_RATE_PROBE_MS = 6 * HOUR_MS;
const MIN_SOLAR_RATE_DEG_PER_DAY = 0.5;
const MAX_SOLAR_RATE_DEG_PER_DAY = 1.5;

function assertDirection(direction) {
  if (direction !== -1 && direction !== 1) throw new RangeError("direction must be -1 or 1");
}

function boundaryStartsAround(instantMs, ringId) {
  if (ringId === "month") {
    return solarTermEventsBetween(
      instantMs - MONTH_SEARCH_DAYS * DAY_MS,
      instantMs + MONTH_SEARCH_DAYS * DAY_MS
    ).filter(event => event.kind === "jie").map(event => event.instantMs);
  }
  if (ringId === "year") {
    return solarTermNamedEventsBetween(
      instantMs - YEAR_SEARCH_DAYS * DAY_MS,
      instantMs + YEAR_SEARCH_DAYS * DAY_MS,
      ["立春"]
    ).map(event => event.instantMs);
  }
  throw new RangeError(`ring ${ringId} does not use calendrical interval boundaries`);
}

function stepIntervalByStarts(instantMs, starts, direction) {
  assertDirection(direction);
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const ordered = [...starts].filter(Number.isFinite).sort((a, b) => a - b);
  const currentIndex = ordered.findLastIndex(value => value <= instantMs);
  if (currentIndex < 0) throw new RangeError("no active interval boundary found before instant");

  const targetIndex = direction > 0 ? currentIndex + 1 : currentIndex - 1;
  const target = ordered[targetIndex];
  if (!Number.isFinite(target)) throw new RangeError("adjacent interval boundary is outside search window");
  return target + BOUNDARY_ENTRY_EPSILON_MS;
}

export function consumeDiscreteDrag(remainderDegrees, deltaDegrees, stepDegrees = 6) {
  if (![remainderDegrees, deltaDegrees, stepDegrees].every(Number.isFinite) || stepDegrees <= 0) {
    throw new RangeError("drag degrees must be finite and stepDegrees must be positive");
  }
  const total = remainderDegrees + deltaDegrees;
  const steps = total < 0 ? Math.ceil(total / stepDegrees) : Math.floor(total / stepDegrees);
  return Object.freeze({
    steps,
    remainderDegrees: total - steps * stepDegrees
  });
}

export function stepLinkedDiscreteInstant(ringId, instantMs, timeDirection) {
  assertDirection(timeDirection);
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");

  if (ringId === "day") return instantMs + timeDirection * DAY_MS;
  if (ringId === "month" || ringId === "year") {
    return stepIntervalByStarts(instantMs, boundaryStartsAround(instantMs, ringId), timeDirection);
  }
  throw new RangeError(`ring ${ringId} is not a discrete linked scrub ring`);
}

function localSolarRate(longitudeAtMs, instantMs, probeMs = SOLAR_RATE_PROBE_MS) {
  const before = longitudeAtMs(instantMs - probeMs);
  const after = longitudeAtMs(instantMs + probeMs);
  if (![before, after].every(Number.isFinite)) throw new RangeError("longitudeAtMs must return finite degrees");
  const elapsedDays = (2 * probeMs) / DAY_MS;
  const rate = shortestAngleDelta(after, before) / elapsedDays;
  if (!Number.isFinite(rate) || rate < MIN_SOLAR_RATE_DEG_PER_DAY || rate > MAX_SOLAR_RATE_DEG_PER_DAY) {
    throw new RangeError(`unexpected apparent solar rate: ${rate}`);
  }
  return rate;
}

export function solveLinkedLongitudeDrag({
  instantMs,
  dragDeltaDegrees,
  longitudeAtMs,
  maxIterations = 6,
  toleranceDegrees = 1e-5
}) {
  if (!Number.isFinite(instantMs) || !Number.isFinite(dragDeltaDegrees)) {
    throw new RangeError("instantMs and dragDeltaDegrees must be finite");
  }
  if (typeof longitudeAtMs !== "function") throw new TypeError("longitudeAtMs must be a function");
  if (!Number.isInteger(maxIterations) || maxIterations < 1) throw new RangeError("maxIterations must be a positive integer");
  if (!Number.isFinite(toleranceDegrees) || toleranceDegrees <= 0) throw new RangeError("toleranceDegrees must be positive");
  if (Math.abs(dragDeltaDegrees) < 1e-12) return instantMs;

  const initialLongitude = longitudeAtMs(instantMs);
  if (!Number.isFinite(initialLongitude)) throw new RangeError("longitudeAtMs must return finite degrees");
  const targetLongitude = normalizeDegrees(initialLongitude - dragDeltaDegrees);
  const initialRate = localSolarRate(longitudeAtMs, instantMs);
  let candidateMs = instantMs - (dragDeltaDegrees / initialRate) * DAY_MS;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const candidateLongitude = longitudeAtMs(candidateMs);
    if (!Number.isFinite(candidateLongitude)) throw new RangeError("longitudeAtMs must return finite degrees");
    const errorDegrees = shortestAngleDelta(candidateLongitude, targetLongitude);
    if (Math.abs(errorDegrees) <= toleranceDegrees) return candidateMs;
    const rate = localSolarRate(longitudeAtMs, candidateMs);
    candidateMs -= (errorDegrees / rate) * DAY_MS;
  }
  return candidateMs;
}

export function applyLinkedRingDrag({
  ringId,
  instantMs,
  deltaDegrees,
  remainderDegrees = 0,
  longitudeAtMs
}) {
  if (ringId === "solar" || ringId === "zodiac") {
    return Object.freeze({
      instantMs: solveLinkedLongitudeDrag({ instantMs, dragDeltaDegrees: deltaDegrees, longitudeAtMs }),
      remainderDegrees: 0,
      appliedSteps: 0
    });
  }

  if (ringId === "year" || ringId === "month" || ringId === "day") {
    const consumed = consumeDiscreteDrag(remainderDegrees, deltaDegrees, 6);
    let nextMs = instantMs;
    if (consumed.steps !== 0) {
      const timeDirection = consumed.steps > 0 ? -1 : 1;
      for (let index = 0; index < Math.abs(consumed.steps); index += 1) {
        nextMs = stepLinkedDiscreteInstant(ringId, nextMs, timeDirection);
      }
    }
    return Object.freeze({
      instantMs: nextMs,
      remainderDegrees: consumed.remainderDegrees,
      appliedSteps: consumed.steps
    });
  }

  throw new RangeError(`unknown linked scrub ring: ${ringId}`);
}

export const LINKED_SCRUB_CONSTANTS = Object.freeze({
  dayMs: DAY_MS,
  boundaryEntryEpsilonMs: BOUNDARY_ENTRY_EPSILON_MS
});
