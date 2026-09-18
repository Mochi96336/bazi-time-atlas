import {
  solarTermEventsBetween,
  solarTermNamedEventsBetween
} from "../astronomy/solar-term-boundaries.js";
import { discretePhaseWindowForRing } from "../wheel/discrete-phase.js";
import { normalizeDegrees, shortestAngleDelta } from "../wheel/polar-geometry.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const HOUR_PILLAR_MS = 2 * HOUR_MS;
const TOOTH_DEGREES = 6;
const BOUNDARY_ENTRY_EPSILON_MS = 1_000;
const BOUNDARY_SAMPLE_EPSILON_MS = 1;
const MONTH_SEARCH_DAYS = 400;
const YEAR_SEARCH_DAYS = 800;
const SOLAR_RATE_PROBE_MS = 6 * HOUR_MS;
const MIN_SOLAR_RATE_DEG_PER_DAY = 0.5;
const MAX_SOLAR_RATE_DEG_PER_DAY = 1.5;
const MAX_TEMPORAL_BOUNDARY_CROSSINGS = 128;
const ANGLE_EPSILON = 1e-12;

function assertDirection(direction) {
  if (direction !== -1 && direction !== 1) throw new RangeError("direction must be -1 or 1");
}

function isDiscreteRing(ringId) {
  return ringId === "hour" || ringId === "day" || ringId === "month" || ringId === "year";
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

// Kept as a compatibility helper for proof tests and old research probes. Runtime
// linked drag no longer consumes detented six-degree steps.
export function consumeDiscreteDrag(remainderDegrees, deltaDegrees, stepDegrees = TOOTH_DEGREES) {
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

// Kept for explicit boundary stepping tests. Runtime linked drag uses
// solveLinkedTemporalDrag() so sub-tooth motion changes the Selected Instant.
export function stepLinkedDiscreteInstant(ringId, instantMs, timeDirection) {
  assertDirection(timeDirection);
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");

  if (ringId === "hour") return instantMs + timeDirection * HOUR_PILLAR_MS;
  if (ringId === "day") return instantMs + timeDirection * DAY_MS;
  if (ringId === "month" || ringId === "year") {
    return stepIntervalByStarts(instantMs, boundaryStartsAround(instantMs, ringId), timeDirection);
  }
  throw new RangeError(`ring ${ringId} is not a discrete linked scrub ring`);
}

/**
 * Invert a linked ring gesture through the same real phase intervals that drive
 * the rendered temporal track. One tooth is always six degrees, but its elapsed
 * time is the actual active interval: 2h, Zi-initial day, Jie→Jie, or LiChun→LiChun.
 *
 * Positive ring rotation means the user moved the wheel clockwise, so master
 * time moves backward. Crossing a boundary consumes the remaining fraction of
 * the current tooth and then continues through the adjacent real interval; no
 * six-degree detent or fixed 30d/365d approximation is involved.
 */
function solveLinkedTemporalDragInto(target, ringId, instantMs, dragDeltaDegrees, timeContext) {
  if (!isDiscreteRing(ringId)) throw new RangeError(`ring ${ringId} is not a temporal linked scrub ring`);
  if (!Number.isFinite(instantMs) || !Number.isFinite(dragDeltaDegrees)) {
    throw new RangeError("instantMs and dragDeltaDegrees must be finite");
  }
  if (Math.abs(dragDeltaDegrees) < ANGLE_EPSILON) {
    target.instantMs = instantMs;
    target.crossedBoundaries = 0;
    return target;
  }

  const timeDirection = dragDeltaDegrees > 0 ? -1 : 1;
  let remainingDegrees = Math.abs(dragDeltaDegrees);
  let cursorMs = instantMs;
  let window = discretePhaseWindowForRing(ringId, cursorMs, timeContext);
  let progress = window?.progress;
  let crossedBoundaries = 0;

  if (!window || !Number.isFinite(progress)) throw new RangeError(`no phase window for ${ringId}`);

  for (let crossing = 0; crossing <= MAX_TEMPORAL_BOUNDARY_CROSSINGS; crossing += 1) {
    const durationMs = window.endMs - window.startMs;
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new RangeError(`invalid phase duration for ${ringId}`);

    const availableFraction = timeDirection > 0 ? 1 - progress : progress;
    const availableDegrees = Math.max(0, availableFraction * TOOTH_DEGREES);

    if (remainingDegrees <= availableDegrees + ANGLE_EPSILON) {
      const nextProgress = Math.max(0, Math.min(1,
        progress + timeDirection * remainingDegrees / TOOTH_DEGREES
      ));
      target.instantMs = window.startMs + nextProgress * durationMs;
      target.crossedBoundaries = crossedBoundaries;
      return target;
    }

    remainingDegrees -= availableDegrees;
    crossedBoundaries += 1;

    if (timeDirection > 0) {
      cursorMs = window.endMs;
      window = discretePhaseWindowForRing(ringId, cursorMs, timeContext);
      progress = 0;
    } else {
      cursorMs = window.startMs;
      // Phase windows are half-open [start,end). Sampling one millisecond before
      // the boundary identifies the adjacent earlier interval, while progress=1
      // keeps the mathematical cursor exactly on the shared boundary.
      window = discretePhaseWindowForRing(ringId, cursorMs - BOUNDARY_SAMPLE_EPSILON_MS, timeContext);
      progress = 1;
    }

    if (!window) throw new RangeError(`adjacent phase window unavailable for ${ringId}`);
  }

  throw new RangeError(`linked ${ringId} drag crossed too many temporal boundaries`);
}

export function solveLinkedTemporalDrag({ ringId, instantMs, dragDeltaDegrees, timeContext }) {
  const result = solveLinkedTemporalDragInto({}, ringId, instantMs, dragDeltaDegrees, timeContext);
  return Object.freeze({
    instantMs:result.instantMs,
    crossedBoundaries:result.crossedBoundaries
  });
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
  if (Math.abs(dragDeltaDegrees) < ANGLE_EPSILON) return instantMs;

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

export function applyLinkedRingDragInto(
  target,
  ringId,
  instantMs,
  deltaDegrees,
  timeContext,
  longitudeAtMs
) {
  if (!target || typeof target !== "object") throw new TypeError("target must be an object");

  if (ringId === "solar" || ringId === "zodiac") {
    target.instantMs = solveLinkedLongitudeDrag({
      instantMs,
      dragDeltaDegrees:deltaDegrees,
      longitudeAtMs
    });
    target.remainderDegrees = 0;
    target.appliedSteps = 0;
    target.crossedBoundaries = 0;
    return target;
  }

  if (isDiscreteRing(ringId)) {
    solveLinkedTemporalDragInto(target, ringId, instantMs, deltaDegrees, timeContext);
    target.remainderDegrees = 0;
    target.appliedSteps = 0;
    return target;
  }

  throw new RangeError(`unknown linked scrub ring: ${ringId}`);
}

export function applyLinkedRingDrag({
  ringId,
  instantMs,
  deltaDegrees,
  remainderDegrees = 0,
  longitudeAtMs,
  timeContext
}) {
  if (isDiscreteRing(ringId) && !Number.isFinite(remainderDegrees)) {
    throw new RangeError("remainderDegrees must be finite");
  }
  const result = applyLinkedRingDragInto({}, ringId, instantMs, deltaDegrees, timeContext, longitudeAtMs);
  return Object.freeze({
    instantMs:result.instantMs,
    remainderDegrees:result.remainderDegrees,
    appliedSteps:result.appliedSteps,
    crossedBoundaries:result.crossedBoundaries
  });
}

export const LINKED_SCRUB_CONSTANTS = Object.freeze({
  dayMs: DAY_MS,
  hourPillarMs: HOUR_PILLAR_MS,
  toothDegrees: TOOTH_DEGREES,
  boundaryEntryEpsilonMs: BOUNDARY_ENTRY_EPSILON_MS
});
