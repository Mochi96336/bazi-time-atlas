import { DAY_BOUNDARY, isDayBoundary } from "../calendar/day-boundary.js";

export const DEFAULT_ATLAS_TIME_CONTEXT = Object.freeze({
  utcOffsetHours: 8,
  dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
});

export const ATLAS_TIME_CONTEXT_QUERY_KEYS = Object.freeze(["utc", "dayBoundary"]);

function validateUtcOffsetHours(value) {
  if (!Number.isFinite(value) || value < -14 || value > 14) {
    throw new RangeError("utcOffsetHours must be a finite number from -14 to +14");
  }
}

export function formatAtlasUtcOffset(value) {
  validateUtcOffsetHours(value);
  const totalMinutes = Math.round(Math.abs(value) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const sign = value < 0 ? "−" : "+";
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeAtlasTimeContext(value = DEFAULT_ATLAS_TIME_CONTEXT) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("atlas time context must be an object");
  }

  const utcOffsetHours = value.utcOffsetHours ?? DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours;
  const dayBoundary = value.dayBoundary ?? DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary;

  validateUtcOffsetHours(utcOffsetHours);
  if (!isDayBoundary(dayBoundary)) {
    throw new RangeError(`unsupported dayBoundary: ${dayBoundary}`);
  }

  if (
    utcOffsetHours === DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours
    && dayBoundary === DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary
  ) {
    return DEFAULT_ATLAS_TIME_CONTEXT;
  }

  return Object.freeze({ utcOffsetHours, dayBoundary });
}

function searchParamsFrom(value) {
  if (value instanceof URLSearchParams) return value;
  return new URLSearchParams(String(value ?? ""));
}

/**
 * Read the optional fixed-offset / day-boundary context from an Atlas query.
 * Any malformed explicit context fails closed to the production defaults;
 * partial custom state is never applied.
 */
export function atlasTimeContextFromSearch(search) {
  const params = searchParamsFrom(search);
  const hasUtc = params.has("utc");
  const hasDayBoundary = params.has("dayBoundary");
  if (!hasUtc && !hasDayBoundary) return DEFAULT_ATLAS_TIME_CONTEXT;

  try {
    const rawUtc = hasUtc ? params.get("utc") : null;
    if (hasUtc && (rawUtc === null || rawUtc.trim() === "")) {
      throw new RangeError("utc query value cannot be blank");
    }

    return normalizeAtlasTimeContext({
      utcOffsetHours: hasUtc ? Number(rawUtc) : DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours,
      dayBoundary: hasDayBoundary
        ? params.get("dayBoundary")
        : DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary
    });
  } catch {
    return DEFAULT_ATLAS_TIME_CONTEXT;
  }
}

/**
 * Canonically persist Atlas temporal context into an existing query object.
 * Default values are omitted so the normal Atlas URL stays minimal.
 */
export function writeAtlasTimeContextSearch(params, value = DEFAULT_ATLAS_TIME_CONTEXT) {
  if (!(params instanceof URLSearchParams)) {
    throw new TypeError("params must be URLSearchParams");
  }
  const context = normalizeAtlasTimeContext(value);

  for (const key of ATLAS_TIME_CONTEXT_QUERY_KEYS) params.delete(key);
  if (context.utcOffsetHours !== DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours) {
    params.set("utc", String(context.utcOffsetHours));
  }
  if (context.dayBoundary !== DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary) {
    params.set("dayBoundary", context.dayBoundary);
  }
  return params;
}
