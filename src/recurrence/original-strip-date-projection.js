import { recurrenceState, validateGregorianDate } from "./gregorian-cycle.js";

/**
 * Reproject a date chosen on the ORIGINAL target-year strip through the
 * EXISTING (base date + delta years) Research control.
 *
 * It is a pure mapping, never a second selected-date owner. A target date
 * that cannot be expressed with the current base year (e.g. 2023 +1 year,
 * requested 2024/02/29) must be rejected rather than silently changing Δ
 * or normalizing a leap day.
 */
export function projectOriginalStripSelection(base, deltaYears, requestedTarget) {
  if (!validateGregorianDate(base) ||
      !Number.isInteger(deltaYears) || deltaYears < 0) {
    throw new RangeError("invalid original recurrence selection");
  }
  const original = recurrenceState(base, deltaYears);
  if (!original.targetValid) return Object.freeze({status:"invalid-current-target"});
  if (!validateGregorianDate(requestedTarget)) return Object.freeze({status:"invalid-date"});
  if (requestedTarget.year !== original.targetDate.year) {
    return Object.freeze({status:"outside-current-target-year"});
  }
  const mappedBase = Object.freeze({
    year:base.year,
    month:requestedTarget.month,
    day:requestedTarget.day
  });
  if (!validateGregorianDate(mappedBase)) {
    return Object.freeze({status:"base-calendar-day-unavailable"});
  }
  const projected = recurrenceState(mappedBase, deltaYears);
  if (!projected.targetValid ||
      projected.targetDate.year!==requestedTarget.year ||
      projected.targetDate.month!==requestedTarget.month ||
      projected.targetDate.day!==requestedTarget.day) {
    return Object.freeze({status:"cannot-preserve-delta"});
  }
  return Object.freeze({
    status:"applied",
    baseDate:mappedBase,
    targetDate:projected.targetDate,
    deltaYears
  });
}
