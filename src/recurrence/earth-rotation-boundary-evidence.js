import { estimateDeepTimeUt1FromTtJulianDay } from "../astronomy/deep-time-earth-rotation.js";
import { DAY_BOUNDARY } from "../calendar/day-boundary.js";
import { dayHourLocalClockStability } from "../calendar/day-hour-clock-stability.js";

/**
 * Propagate the repository's deep-time TT→UT1 uncertainty into the calendar
 * Day/Hour boundary primitive without upgrading a statistical interval into a
 * deterministic bound.
 *
 * `localClock` is the local-clock point estimate corresponding to the supplied
 * TT target under the caller's already-selected longitude/zone/clock basis.
 * This adapter does not create that mapping itself; it only asks whether the
 * ±1σ Earth-rotation uncertainty around that point estimate reaches a Day or
 * Hour boundary.
 */
export function deepTimeEarthRotationOneSigmaBoundaryAssessment(
  ttJulianDay,
  localClock,
  { dayBoundary = DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY } = {}
) {
  const earthRotation = estimateDeepTimeUt1FromTtJulianDay(ttJulianDay);
  const boundary = dayHourLocalClockStability(localClock, {
    dayBoundary,
    uncertaintySeconds:earthRotation.oneSigmaUncertaintySeconds
  });

  return Object.freeze({
    ...boundary,
    boundaryStatus:boundary.status,
    earthRotationEvidenceId:earthRotation.evidenceId,
    decimalYear:earthRotation.decimalYear,
    deltaTSecondsEstimate:earthRotation.deltaTSecondsEstimate,
    oneSigmaUncertaintySeconds:earthRotation.oneSigmaUncertaintySeconds,
    uncertaintyContribution:"tt-to-ut1-earth-rotation",
    uncertaintySemantics:earthRotation.uncertaintySemantics,
    statisticalIntervalOnly:true,
    hardUpperBound:false,
    pointEstimateAvailable:earthRotation.pointEstimateAvailable,
    deterministicUt1:earthRotation.deterministicUt1,
    hourBranchStableAtOneSigma:boundary.hourBranchStable,
    dayBoundaryStableAtOneSigma:boundary.dayBoundaryStable,
    dayHourStableAtOneSigma:boundary.stable,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    reason:boundary.stable
      ? "The selected Day/Hour membership clears the model's ±1σ TT→UT1 interval, but 1σ is descriptive rather than a hard bound and therefore cannot prove deterministic membership."
      : "The model's ±1σ TT→UT1 interval reaches a selected Day or Hour boundary; the point estimate cannot even preserve that membership across its one-standard-error interval."
  });
}

export const EARTH_ROTATION_BOUNDARY_EVIDENCE_CONTRACT = Object.freeze({
  id:"deep-time-earth-rotation-boundary-evidence-v1",
  uncertaintyContribution:"tt-to-ut1-earth-rotation",
  uncertaintySemantics:"one-standard-error-not-hard-bound",
  statisticalIntervalOnly:true,
  hardUpperBound:false,
  grantsDeterministicMembership:false,
  grantsRecurrenceAuthority:false,
  delegatesBoundarySemanticsTo:"day-hour-local-clock-boundary-stability-v1"
});
