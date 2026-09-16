import { DAY_BOUNDARY, isDayBoundary } from "../calendar/day-boundary.js";

export const DEFAULT_ATLAS_TIME_CONTEXT = Object.freeze({
  utcOffsetHours: 8,
  dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
});

function validateUtcOffsetHours(value) {
  if (!Number.isFinite(value) || value < -14 || value > 14) {
    throw new RangeError("utcOffsetHours must be a finite number from -14 to +14");
  }
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
