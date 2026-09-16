import { normalizeAtlasTimeContext } from "../wheel/atlas-time-context.js";

export const TIME_CONTEXT_COMMAND = "atlas:set-time-context";

export function timeContextFromCommandDetail(detail) {
  const value = detail?.timeContext;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  if (!Object.hasOwn(value, "utcOffsetHours") || !Object.hasOwn(value, "dayBoundary")) return null;

  try {
    return normalizeAtlasTimeContext({
      utcOffsetHours: value.utcOffsetHours,
      dayBoundary: value.dayBoundary
    });
  } catch {
    return null;
  }
}
