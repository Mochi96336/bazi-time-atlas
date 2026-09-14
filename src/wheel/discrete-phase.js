import {
  jieBoundaryContext,
  solarTermNamedEventsBetween
} from "../astronomy/solar-term-boundaries.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const DISCRETE_RING_IDS = Object.freeze(["hour", "year", "month", "day"]);
export const PHASE_REFERENCE_UTC_OFFSET_HOURS = 8;

function localFieldsAt(instantMs) {
  const shifted = new Date(instantMs + PHASE_REFERENCE_UTC_OFFSET_HOURS * HOUR_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours()
  };
}

function instantFromLocalFields(year, month, day, hour) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, 0, 0, 0);
  return date.getTime() - PHASE_REFERENCE_UTC_OFFSET_HOURS * HOUR_MS;
}

function boundedProgress(instantMs, startMs, endMs) {
  if (![instantMs, startMs, endMs].every(Number.isFinite) || endMs <= startMs) return null;
  return Math.max(0, Math.min(1, (instantMs - startMs) / (endMs - startMs)));
}

function phaseWindow(id, instantMs, startMs, endMs, source, boundaryKind) {
  const progress = boundedProgress(instantMs, startMs, endMs);
  if (progress === null) return null;
  return Object.freeze({
    id,
    startMs,
    endMs,
    progress,
    source,
    boundaryKind,
    referenceUtcOffsetHours: PHASE_REFERENCE_UTC_OFFSET_HOURS
  });
}

export function hourPhaseWindow(instantMs) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const fields = localFieldsAt(instantMs);
  // Chinese double-hours start at odd local clock hours: 子 begins at 23:00,
  // 丑 at 01:00, ... 亥 at 21:00 under the atlas' fixed UTC+08 reference.
  const startHour = fields.hour % 2 === 1 ? fields.hour : fields.hour - 1;
  const startMs = instantFromLocalFields(fields.year, fields.month, fields.day, startHour);
  return phaseWindow("hour", instantMs, startMs, startMs + 2 * HOUR_MS, "double-hour", "calendar-discrete");
}

export function dayPhaseWindow(instantMs) {
  if (!Number.isFinite(instantMs)) throw new RangeError("instantMs must be finite");
  const fields = localFieldsAt(instantMs);
  let startMs = instantFromLocalFields(fields.year, fields.month, fields.day, 23);
  // DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY: the next sexagenary day starts at 子初 23:00.
  if (startMs > instantMs) startMs -= DAY_MS;
  return phaseWindow("day", instantMs, startMs, startMs + DAY_MS, "zi-initial", "calendar-discrete");
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

export function discretePhaseWindowForRing(id, instantMs) {
  if (id === "hour") return hourPhaseWindow(instantMs);
  if (id === "day") return dayPhaseWindow(instantMs);
  if (id === "month") return monthPhaseWindow(instantMs);
  if (id === "year") return yearPhaseWindow(instantMs);
  throw new RangeError(`unknown discrete phase ring: ${id}`);
}

export function discretePhaseWindows(instantMs) {
  return Object.freeze({
    hour: hourPhaseWindow(instantMs),
    year: yearPhaseWindow(instantMs),
    month: monthPhaseWindow(instantMs),
    day: dayPhaseWindow(instantMs)
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
