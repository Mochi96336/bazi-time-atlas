import { signedShortestPhase } from "./phase-fan-geometry.js";

/**
 * Projection only: recurrenceState remains the sole owner of all three phases.
 * These normalized signed positions are comparisons within each ring, not a
 * shared clock or calendar duration.
 */
const PHASE_ROWS = Object.freeze([
  Object.freeze({ key: "gregorian", label: "公曆結構", modulus: 400, unit: "年" }),
  Object.freeze({ key: "yearSequence", label: "年序", modulus: 60, unit: "年" }),
  Object.freeze({ key: "day", label: "日序", modulus: 60, unit: "日" })
]);

export function projectUnfoldedPhases(state) {
  if (!state || !state.phases) throw new TypeError("recurrence state with phases is required");
  return Object.freeze(PHASE_ROWS.map(spec => {
    const phase = state.phases[spec.key];
    if (phase !== null && (!Number.isFinite(phase) || phase < 0 || phase >= spec.modulus)) {
      throw new RangeError(`invalid ${spec.key} phase`);
    }
    const signed = phase === null ? null : signedShortestPhase(phase, spec.modulus);
    return Object.freeze({
      ...spec,
      available: phase !== null,
      phase,
      signed,
      fraction: signed === null ? null : signed / (spec.modulus / 2),
      closed: phase === 0
    });
  }));
}
