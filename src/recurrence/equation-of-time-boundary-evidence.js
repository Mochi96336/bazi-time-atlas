import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../astronomy/equation-of-time-4006-swiss-evidence.js";
import { DAY_BOUNDARY } from "../calendar/day-boundary.js";
import { dayHourLocalClockStability } from "../calendar/day-hour-clock-stability.js";

/**
 * Propagate the corrected year-4006 Swiss EoT production residual into the
 * calendar-owned Day/Hour boundary primitive.
 *
 * The dense 5-minute sweep is empirical evidence, not a continuous theorem.
 * Therefore even a candidate that clears the observed residual envelope is
 * reported only as empirically stable; deterministic recurrence authority
 * remains false until a separately-reviewed continuous upper bound exists.
 */
export function year4006SwissObservedDayHourStability(
  localClock,
  { dayBoundary = DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY } = {}
) {
  const evidence = EQUATION_OF_TIME_4006_SWISS_EVIDENCE;
  const dense = evidence.target4006.dense;
  const observedErrorEnvelopeSeconds = dense.productionErrorSeconds.maxAbs;
  const boundary = dayHourLocalClockStability(localClock, {
    dayBoundary,
    uncertaintySeconds:observedErrorEnvelopeSeconds
  });
  const stableAgainstObservedEnvelope = boundary.stable;

  return Object.freeze({
    ...boundary,
    boundaryStatus:boundary.status,
    targetYear:4006,
    evidenceId:evidence.id,
    evidenceKind:"empirical-grid-observed-production-max",
    cadenceMinutes:dense.cadenceMinutes,
    samples:dense.samples,
    observedErrorEnvelopeSeconds,
    continuousUpperBound:false,
    stableAgainstObservedEnvelope,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    status:stableAgainstObservedEnvelope
      ? "stable-against-observed-envelope-only"
      : "boundary-ambiguous-under-observed-envelope",
    reason:stableAgainstObservedEnvelope
      ? "Day/Hour membership clears the largest production EoT residual observed on the corrected 5-minute Swiss grid, but that empirical grid is not a continuous upper-bound proof."
      : "The corrected Swiss observed production residual envelope reaches a selected Day or Hour boundary, so membership is ambiguous even under the empirical grid envelope."
  });
}

export const YEAR_4006_SWISS_BOUNDARY_EVIDENCE_CONTRACT = Object.freeze({
  id:"year-4006-swiss-eot-boundary-evidence-v1",
  sourceEvidenceId:EQUATION_OF_TIME_4006_SWISS_EVIDENCE.id,
  targetYear:4006,
  evidenceKind:"empirical-grid-observed-production-max",
  continuousUpperBound:false,
  grantsRecurrenceAuthority:false,
  delegatesBoundarySemanticsTo:"day-hour-local-clock-boundary-stability-v1"
});
