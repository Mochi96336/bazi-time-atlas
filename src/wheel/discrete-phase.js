import {
  jieBoundaryContext,
  solarTermNamedEventsBetween
} from "../astronomy/solar-term-boundaries.js";
import { DAY_BOUNDARY } from "../calendar/day-boundary.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  normalizeAtlasTimeContext
} from "./atlas-time-context.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const DISCRETE_RING_IDS = Object.freeze(["hour", "year", "month", "day"]);
// Compatibility export for tests/callers that describe the default reference.
export const PHASE_REFERENCE_UTC_OFFSET_HOURS = DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours;

function localFieldsAt(instantMs, context) {
  const shifted = new Date(instantMs + context.utcOffsetHours * HOUR_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours()
  };
}

function instantFromLocalFields(year, month, day, hour, context) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, 0, 0, 0);
  return date.getTime() - context.utcOffsetHours * HOUR_MS;
}

function boundedProgress(instantMs, startMs, endMs) {
  if (![instantMs, startMs, endMs].every(Number.isFinite) || endMs <= startMs) return null;
  return Math.max(0, Math.min(1, (instantMs - startMs) / (endMs - startMs)));
}

function phaseWindow(
  id,
  instantMs,
  startMs,
  endMs,
  source,
  boundaryKind,
  referenceUtcOffsetHours = PHASE_REFERENCE_UTC_OFFSET_HOURS,
  dayBoundary = null
) {
  const progress = boundedProgress(instantMs, startMs, endMs);
  if (progress === null) return null;
  const phase = {
    id,
    startMs,
    endMs,
    progress,
    source,
    boundaryKind,
    referenceUtcOffsetHours
  };
  if (dayBoundary !== null) phase.dayBoundary = dayBoundary;
  return Object.freeze(phase);
}

function hourPhaseWindowFromFields(instantMs, context, fields) {
  // Chinese double-hours start at odd local clock hours: 子 begins at 23:00,
  // 丑 at 01:00, ... 亥 at 21:00 in the selected fixed-offset civil clock.
  const startHour = fields.hour % 2 === 1 ? fields.hour : fields.hour - 1;
  const startMs = instantFromLocalFields(fields.year, fields.month, fields.day, startHour, context);
  return phaseWindow(
    "hour",
    instantMs,
    startMs,
    startMs + 2 * HOUR_MS,
    "double-hour",
    "calendar-discrete",
    context.utcOffsetHours
  );
}

export function hourPhaseWindow(instantMs, timeContext = DEFAULT_ATLAS_TIME_CONTEXT) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const context = normalizeAtlasTimeContext(timeContext);
  return hourPhaseWindowFromFields(instantMs, context, localFieldsAt(instantMs, context));
}

function dayPhaseWindowFromFields(instantMs, context, fields) {
  const startHour = context.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT ? 0 : 23;
  let startMs = instantFromLocalFields(fields.year, fields.month, fields.day, startHour, context);
  if (startMs > instantMs) startMs -= DAY_MS;
  const source = context.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? "civil-midnight"
    : "zi-initial";
  return phaseWindow(
    "day",
    instantMs,
    startMs,
    startMs + DAY_MS,
    source,
    "calendar-discrete",
    context.utcOffsetHours,
    context.dayBoundary
  );
}

export function dayPhaseWindow(instantMs, timeContext = DEFAULT_ATLAS_TIME_CONTEXT) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const context = normalizeAtlasTimeContext(timeContext);
  return dayPhaseWindowFromFields(instantMs, context, localFieldsAt(instantMs, context));
}

export function monthPhaseWindow(instantMs) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const { previous, next } = jieBoundaryContext(instantMs);
  if (!previous || !next) return null;
  return phaseWindow("month", instantMs, previous.instantMs, next.instantMs, "jie", "astronomical-discrete");
}

export function yearPhaseWindow(instantMs) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const events = solarTermNamedEventsBetween(
    instantMs - 400 * DAY_MS,
    instantMs + 400 * DAY_MS,
    ["立春"]
  );
  let previous = null;
  let next = null;
  for (const event of events) {
    if (event.instantMs <= instantMs) previous = event;
    if (event.instantMs > instantMs) {
      next = event;
      break;
    }
  }
  if (!previous || !next) return null;
  return phaseWindow("year", instantMs, previous.instantMs, next.instantMs, "li-chun", "astronomical-discrete");
}

export function discretePhaseWindowForRing(
  id,
  instantMs,
  timeContext = DEFAULT_ATLAS_TIME_CONTEXT
) {
  if (id === "hour") return hourPhaseWindow(instantMs, timeContext);
  if (id === "day") return dayPhaseWindow(instantMs, timeContext);
  if (id === "month") return monthPhaseWindow(instantMs);
  if (id === "year") return yearPhaseWindow(instantMs);
  throw new RangeError(`unknown discrete phase ring: ${id}`);
}

export function discretePhaseWindows(instantMs, timeContext = DEFAULT_ATLAS_TIME_CONTEXT) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const context = normalizeAtlasTimeContext(timeContext);
  const fields = localFieldsAt(instantMs, context);
  return Object.freeze({
    hour: hourPhaseWindowFromFields(instantMs, context, fields),
    year: yearPhaseWindow(instantMs),
    month: monthPhaseWindow(instantMs),
    day: dayPhaseWindowFromFields(instantMs, context, fields)
  });
}

// Exact concurrence is intentionally strict. Two boundaries are grouped only
// when their resolved end instants are the same millisecond; there is no
// tolerance window that could turn merely-near events into a claimed alignment.
export function exactNextBoundaryGroups(phases) {
  if (!phases || typeof phases !== "object") return Object.freeze([]);
  const grouped = new Map();
  for (const id of DISCRETE_RING_IDS) {
    const endMs = phases[id]?.endMs;
    if (!Number.isFinite(endMs)) continue;
    const key = String(endMs);
    if (!grouped.has(key)) grouped.set(key, { instantMs:endMs, ringIds:[] });
    grouped.get(key).ringIds.push(id);
  }

  return Object.freeze(
    [...grouped.values()]
      .sort((a, b) => a.instantMs - b.instantMs)
      .map(group => Object.freeze({
        instantMs: group.instantMs,
        ringIds: Object.freeze([...group.ringIds]),
        shared: group.ringIds.length > 1
      }))
  );
}

export function phaseAngleWithinTooth(activeIndex, progress, insetDegrees = 0.45) {
  if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= 60) return null;
  if (!Number.isFinite(progress)) return null;
  const bounded = Math.max(0, Math.min(1, progress));
  const start = activeIndex * 6 + insetDegrees;
  const end = (activeIndex + 1) * 6 - insetDegrees;
  return start + (end - start) * bounded;
}
