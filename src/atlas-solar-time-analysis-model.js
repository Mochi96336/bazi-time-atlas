import { compareDayHourTimeBases } from "./calendar/time-basis-sensitivity.js";
import { civilFieldsFromInstant } from "./wheel/atlas-display-model.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  normalizeAtlasTimeContext
} from "./wheel/atlas-time-context.js";

export function normalizeAtlasLongitude(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("longitudeDegrees must be a finite number or null");
  }
  if (value < -180 || value > 180) {
    throw new RangeError("longitudeDegrees must be between -180 and +180");
  }
  return value;
}

/**
 * Compare civil, local-mean-solar and local-apparent-solar Day/Hour results
 * for the Atlas Selected Instant without changing that physical instant.
 *
 * Longitude deliberately has no implicit default. A UTC offset locates a civil
 * clock on the time axis; it is not a geographic longitude. Until the caller
 * supplies an explicit east-positive longitude, the model stays unbound and
 * performs no solar-time calculation.
 */
export function atlasSolarTimeAnalysisState({
  selectedMs,
  timeContext = DEFAULT_ATLAS_TIME_CONTEXT,
  longitudeDegrees = null
} = {}) {
  if (typeof selectedMs !== "number" || !Number.isFinite(selectedMs)) {
    throw new TypeError("selectedMs must be a finite number");
  }

  const context = normalizeAtlasTimeContext(timeContext);
  const longitude = normalizeAtlasLongitude(longitudeDegrees);
  if (longitude === null) {
    return Object.freeze({
      bound:false,
      selectedMs,
      longitudeDegrees:null,
      timeContext:context,
      method:"atlas-day-hour-time-basis-sensitivity"
    });
  }

  const civilInput = Object.freeze(civilFieldsFromInstant(selectedMs, context));
  const comparison = compareDayHourTimeBases(civilInput, {
    longitudeDegrees:longitude,
    utcOffsetHours:context.utcOffsetHours,
    dayBoundary:context.dayBoundary
  });

  return Object.freeze({
    ...comparison,
    bound:true,
    selectedMs,
    civilInput,
    timeContext:context,
    method:"atlas-day-hour-time-basis-sensitivity"
  });
}
