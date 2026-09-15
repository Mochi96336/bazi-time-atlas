import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../astronomy/equation-of-time-4006-swiss-evidence.js";
import { DAY_BOUNDARY } from "../calendar/day-boundary.js";
import { dayHourLocalClockStability } from "../calendar/day-hour-clock-stability.js";

/**
 * Propagate only the corrected year-4006 Swiss EoT production residual into
 * the calendar-owned Day/Hour boundary primitive.
 *
 * This is deliberately one uncertainty contribution, not a complete target-
 * instant uncertainty budget. Deep-time TT↔UT1 / Delta-T, target-instant
 * projection, longitude and other clock/model uncertainties remain separate.
 *
 * The dense 5-minute sweep is also empirical evidence, not a continuous
 * theorem. Therefore even a candidate that clears the observed EoT residual
 * envelope is only stable against this observed EoT contribution; it is not
 * deterministic Day/Hour membership and grants no recurrence authority.
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
  const eotContributionStableAgainstObservedEnvelope = boundary.stable;

  return Object.freeze({
    ...boundary,
    boundaryStatus:boundary.status,
    targetYear:4006,
    evidenceId:evidence.id,
    evidenceKind:"empirical-grid-observed-production-max",
    uncertaintyContribution:"equation-of-time-only",
    cadenceMinutes:dense.cadenceMinutes,
    samples:dense.samples,
    observedErrorEnvelopeSeconds,
    continuousUpperBound:false,
    eotContributionStableAgainstObservedEnvelope,
    coversOnlyEquationOfTimeError:true,
    otherClockUncertaintyIncluded:false,
    sufficientForFullMembership:false,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    status:eotContributionStableAgainstObservedEnvelope
      ? "eot-contribution-stable-against-observed-envelope-only"
      : "eot-contribution-reaches-boundary-under-observed-envelope",
    reason:eotContributionStableAgainstObservedEnvelope
      ? "The candidate clears the largest production EoT residual observed on the corrected 5-minute Swiss grid. This covers only the EoT contribution; the grid is not a continuous upper bound and other target-instant uncertainty remains separate."
      : "The corrected Swiss observed EoT production residual reaches a selected Day or Hour boundary, so this candidate is not stable even against the empirical EoT contribution alone."
  });
}

export const YEAR_4006_SWISS_BOUNDARY_EVIDENCE_CONTRACT = Object.freeze({
  id:"year-4006-swiss-eot-boundary-evidence-v1",
  sourceEvidenceId:EQUATION_OF_TIME_4006_SWISS_EVIDENCE.id,
  targetYear:4006,
  evidenceKind:"empirical-grid-observed-production-max",
  uncertaintyContribution:"equation-of-time-only",
  continuousUpperBound:false,
  coversOnlyEquationOfTimeError:true,
  includesOtherClockUncertainty:false,
  sufficientForFullMembership:false,
  grantsRecurrenceAuthority:false,
  delegatesBoundarySemanticsTo:"day-hour-local-clock-boundary-stability-v1"
});
