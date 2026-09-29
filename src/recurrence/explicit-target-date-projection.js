import { recurrenceState, validateGregorianDate } from "./gregorian-cycle.js";

/**
 * Explicit date input chooses the visible comparison date, not the baseline.
 * Map this intent back to the one canonical base+delta model; the native
 * annual-strip scrub remains limited to its current civil year.
 */
export function projectExplicitResearchTargetDate(baseDate, deltaYears, targetDate) {
  if (!validateGregorianDate(baseDate) ||
      !Number.isInteger(deltaYears) || deltaYears < 0) {
    throw new RangeError("invalid current recurrence controls");
  }
  if (!validateGregorianDate(targetDate)) {
    return Object.freeze({status:"invalid-target-date"});
  }
  const year=targetDate.year-deltaYears;
  if (year < 1 || year > 10_000_000) {
    return Object.freeze({status:"baseline-year-out-of-range"});
  }
  const proposed=Object.freeze({
    year,
    month:targetDate.month,
    day:targetDate.day
  });
  if (!validateGregorianDate(proposed)) {
    return Object.freeze({status:"unrepresentable-baseline-date"});
  }
  let projected;
  try {
    projected=recurrenceState(proposed,deltaYears);
  } catch {
    return Object.freeze({status:"out-of-range"});
  }
  if (!projected.targetValid ||
      projected.targetDate.year!==targetDate.year ||
      projected.targetDate.month!==targetDate.month ||
      projected.targetDate.day!==targetDate.day) {
    return Object.freeze({status:"cannot-preserve-delta"});
  }
  return Object.freeze({status:"applied",baseDate:proposed,targetDate:projected.targetDate,deltaYears});
}
