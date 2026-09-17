import { resolveBirthPillars } from "../calendar/tyme-adapter.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  normalizeAtlasTimeContext
} from "../wheel/atlas-time-context.js";
import { civilFieldsFromInstant } from "../wheel/atlas-display-model.js";
import { discretePhaseWindowForRing } from "../wheel/discrete-phase.js";
import { sexagenaryCycle } from "../sexagenary-data.js";

const PILLAR_IDS = Object.freeze(["year", "month", "day", "hour"]);
const VALID_GANZHI = new Set(sexagenaryCycle.map(item => item.name));
const DEFAULT_MAX_RESULTS = 256;

function normalizeConstraintValue(id, value) {
  if (value === null || value === undefined || value === "" || value === "*") return null;
  if (typeof value !== "string" || !VALID_GANZHI.has(value)) {
    throw new RangeError(`${id} constraint must be one canonical sexagenary name or wildcard`);
  }
  return value;
}

export function normalizeInversePillarConstraints(value = {}) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("inverse pillar constraints must be an object");
  }

  const normalized = Object.fromEntries(
    PILLAR_IDS.map(id => [id, normalizeConstraintValue(id, value[id])])
  );
  if (!PILLAR_IDS.some(id => normalized[id] !== null)) {
    throw new RangeError("inverse pillar search requires at least one constrained pillar");
  }
  return Object.freeze(normalized);
}

function assertSearchRange(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new RangeError("inverse pillar search bounds must be finite instants");
  }
  if (endMs <= startMs) {
    throw new RangeError("inverse pillar search endMs must be greater than startMs");
  }
}

function resolvePillarsAtInstant(instantMs, timeContext) {
  const fields = civilFieldsFromInstant(instantMs, timeContext);
  return resolveBirthPillars(fields, {
    utcOffsetHours: timeContext.utcOffsetHours,
    dayBoundary: timeContext.dayBoundary
  }).pillars;
}

function matchesConstraints(pillars, constraints) {
  return PILLAR_IDS.every(id => constraints[id] === null || pillars[id]?.name === constraints[id]);
}

function activeConstraintIds(constraints) {
  return PILLAR_IDS.filter(id => constraints[id] !== null);
}

function nextRelevantBoundary(instantMs, ringIds, timeContext) {
  let next = Number.POSITIVE_INFINITY;
  for (const id of ringIds) {
    const window = discretePhaseWindowForRing(id, instantMs, timeContext);
    if (!window || !Number.isFinite(window.endMs) || window.endMs <= instantMs) {
      throw new Error(`cannot resolve the next ${id} boundary at ${instantMs}`);
    }
    next = Math.min(next, window.endMs);
  }
  return next;
}

function samePillarState(a, b) {
  return PILLAR_IDS.every(id => a[id]?.name === b[id]?.name);
}

function freezePillars(pillars) {
  return Object.freeze(Object.fromEntries(
    PILLAR_IDS.map(id => [id, Object.freeze({ ...pillars[id] })])
  ));
}

/**
 * Search real time intervals whose canonical four-pillar state satisfies the
 * supplied constraints.
 *
 * The solver does not brute-force seconds or fake ring offsets. It advances
 * directly from one exact canonical boundary to the next. Only boundaries for
 * constrained pillars participate, so a Day-only search jumps day-by-day while
 * an Hour-constrained search follows the two-hour boundaries.
 *
 * Returned intervals are half-open [startMs, endMs). Each result therefore
 * represents real instants for which every requested pillar constraint holds.
 */
export function searchInversePillarIntervals({
  constraints,
  startMs,
  endMs,
  timeContext = DEFAULT_ATLAS_TIME_CONTEXT,
  maxResults = DEFAULT_MAX_RESULTS
}) {
  assertSearchRange(startMs, endMs);
  if (!Number.isInteger(maxResults) || maxResults < 1) {
    throw new RangeError("maxResults must be a positive integer");
  }

  const normalizedConstraints = normalizeInversePillarConstraints(constraints);
  const context = normalizeAtlasTimeContext(timeContext);
  const ringIds = activeConstraintIds(normalizedConstraints);
  const matches = [];
  let cursorMs = startMs;
  let boundarySteps = 0;
  let truncated = false;

  while (cursorMs < endMs) {
    const pillars = resolvePillarsAtInstant(cursorMs, context);
    const boundaryMs = nextRelevantBoundary(cursorMs, ringIds, context);
    const segmentEndMs = Math.min(endMs, boundaryMs);
    boundarySteps += 1;

    if (matchesConstraints(pillars, normalizedConstraints)) {
      const previous = matches[matches.length - 1];
      if (
        previous
        && previous.endMs === cursorMs
        && samePillarState(previous.pillars, pillars)
      ) {
        previous.endMs = segmentEndMs;
      } else {
        matches.push({
          startMs: cursorMs,
          endMs: segmentEndMs,
          pillars: freezePillars(pillars)
        });
      }
      if (matches.length >= maxResults && segmentEndMs < endMs) {
        truncated = true;
        break;
      }
    }

    if (segmentEndMs <= cursorMs) {
      throw new Error(`inverse pillar search failed to advance at ${cursorMs}`);
    }
    cursorMs = segmentEndMs;
  }

  return Object.freeze({
    constraints: normalizedConstraints,
    timeContext: context,
    startMs,
    endMs,
    matches: Object.freeze(matches.map(match => Object.freeze({ ...match }))),
    truncated,
    stats: Object.freeze({
      boundarySteps,
      constrainedRings: Object.freeze([...ringIds])
    })
  });
}

export { PILLAR_IDS as INVERSE_PILLAR_IDS };
