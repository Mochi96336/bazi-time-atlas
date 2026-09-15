import { EQUATION_OF_TIME_4006_SWISS_EVIDENCE } from "../astronomy/equation-of-time-4006-swiss-evidence.js";
import { DAY_BOUNDARY } from "../calendar/day-boundary.js";
import { dayHourLocalClockStability } from "../calendar/day-hour-clock-stability.js";

/**
 * Compare a year-4006 local-apparent-solar clock estimate against the largest
 * shipped-production EoT residual observed on the corrected 5-minute Swiss
 * research grid.
 *
 * This is deliberately a clearance diagnostic, not an authority adapter:
 * - the 5-minute sweep is empirical, not a continuous upper bound;
 * - the supplied clock must already be the local-apparent-solar point estimate;
 * - only EoT-model residual is represented here;
 * - Earth rotation, longitude, zone, input-clock and other uncertainties are
 *   outside this result.
 *
 * Clearing the observed envelope therefore does not prove stable membership.
 * Failing clearance means only that this empirical envelope reaches a selected
 * Day/Hour boundary and cannot certify that candidate.
 */
export function year4006SwissEotObservedBoundaryClearance(
  apparentSolarClockEstimate,
  { dayBoundary = DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY } = {}
) {
  const evidence = EQUATION_OF_TIME_4006_SWISS_EVIDENCE;
  const dense = evidence.target4006.dense;
  const observedEnvelopeSeconds = dense.productionErrorSeconds.maxAbs;
  const boundary = dayHourLocalClockStability(apparentSolarClockEstimate, {
    dayBoundary,
    uncertaintySeconds:observedEnvelopeSeconds
  });
  const clearsObservedEnvelope = boundary.stable;

  return Object.freeze({
    ...boundary,
    boundaryStatus:boundary.status,
    targetYear:4006,
    evidenceId:evidence.id,
    productionModelId:evidence.productionModelId,
    evidenceKind:"empirical-grid-observed-production-max-abs",
    inputClockSemantics:"local-apparent-solar-point-estimate",
    uncertaintyContribution:"equation-of-time-model-residual-only",
    cadenceMinutes:dense.cadenceMinutes,
    samples:dense.samples,
    observedEnvelopeSeconds,
    empiricalGridOnly:true,
    continuousUpperBound:false,
    coversOnlyEquationOfTimeResidual:true,
    includesEarthRotationUncertainty:false,
    includesLongitudeUncertainty:false,
    includesZoneOrInputClockUncertainty:false,
    clearsObservedEnvelope,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    status:clearsObservedEnvelope
      ? "clears-observed-eot-envelope-only"
      : "observed-eot-envelope-reaches-boundary",
    reason:clearsObservedEnvelope
      ? "The candidate clears the largest production EoT residual observed on the corrected 5-minute Swiss grid. The grid is not a continuous upper bound, so this is evidence clearance only and cannot prove deterministic Day/Hour membership."
      : "The corrected Swiss observed production EoT envelope reaches a selected Day or Hour boundary. This empirical evidence therefore cannot certify the candidate, but it is not itself a claim about the unknown true residual at that exact instant."
  });
}

export const YEAR_4006_SWISS_EOT_BOUNDARY_CLEARANCE_CONTRACT = Object.freeze({
  id:"year-4006-swiss-eot-observed-boundary-clearance-v1",
  sourceEvidenceId:EQUATION_OF_TIME_4006_SWISS_EVIDENCE.id,
  productionModelId:EQUATION_OF_TIME_4006_SWISS_EVIDENCE.productionModelId,
  targetYear:4006,
  evidenceKind:"empirical-grid-observed-production-max-abs",
  inputClockSemantics:"local-apparent-solar-point-estimate",
  uncertaintyContribution:"equation-of-time-model-residual-only",
  empiricalGridOnly:true,
  continuousUpperBound:false,
  coversOnlyEquationOfTimeResidual:true,
  grantsDeterministicMembership:false,
  grantsRecurrenceAuthority:false,
  delegatesBoundarySemanticsTo:"day-hour-local-clock-boundary-stability-v1"
});
