import { DAY_BOUNDARY } from "../calendar/day-boundary.js";
import { year4006SwissEotObservedBoundaryClearance } from "./equation-of-time-observed-boundary-clearance.js";
import { fixedZoneUt1ApparentSolarPointEstimate } from "./fixed-zone-ut1-apparent-solar.js";

function assertYear4006(localClock) {
  if (!localClock || typeof localClock !== "object" || Array.isArray(localClock)) {
    throw new TypeError("localClock must be an object");
  }
  if (localClock.year !== 4006) {
    throw new RangeError("year-4006 observed EoT boundary clearance requires localClock.year === 4006");
  }
}

/**
 * Compose the typed fixed-zone-from-UT1 solar-clock projection with the
 * corrected Swiss year-4006 observed EoT residual envelope.
 *
 * This answers a deliberately narrow question:
 *   "For this explicit fixed-UT1 local clock and longitude, does the resulting
 *    local-apparent-solar point estimate sit farther from the selected
 *    Day/Hour boundaries than the largest production EoT residual observed on
 *    the corrected 5-minute Swiss grid?"
 *
 * A positive answer is still evidence clearance only. The observed grid is not
 * a continuous upper bound and this composition does not include longitude,
 * input-clock, zone, or other uncertainty. It therefore cannot promote the
 * point estimate into deterministic pillar membership or recurrence authority.
 */
export function year4006FixedZoneEotObservedBoundaryClearance(
  localClock,
  longitudeDegrees,
  localOffsetHoursFromUt1,
  {
    dayBoundary = DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    deltaTSeconds
  } = {}
) {
  assertYear4006(localClock);

  const pointEstimate = fixedZoneUt1ApparentSolarPointEstimate(
    localClock,
    longitudeDegrees,
    localOffsetHoursFromUt1,
    { deltaTSeconds }
  );
  const clearance = year4006SwissEotObservedBoundaryClearance(
    pointEstimate.apparentSolarClock,
    { dayBoundary }
  );

  return Object.freeze({
    method:"year-4006-fixed-zone-ut1-eot-observed-boundary-clearance",
    targetYear:4006,
    inputClockSemantics:pointEstimate.inputClockSemantics,
    localClock:pointEstimate.localClock,
    localOffsetHoursFromUt1,
    longitudeDegrees:pointEstimate.longitudeDegrees,
    ut1JulianDay:pointEstimate.ut1JulianDay,
    meanSolarClock:pointEstimate.meanSolarClock,
    apparentSolarClock:pointEstimate.apparentSolarClock,
    longitudeCorrectionMinutes:pointEstimate.longitudeCorrectionMinutes,
    equationOfTimeMinutes:pointEstimate.equationOfTimeMinutes,
    totalCorrectionMinutes:pointEstimate.totalCorrectionMinutes,
    timelineAlignmentSeconds:pointEstimate.timelineAlignmentSeconds,
    dayBoundary:clearance.dayBoundary,
    hourBranchMarginSeconds:clearance.hourBranchMarginSeconds,
    dayBoundaryMarginSeconds:clearance.dayBoundaryMarginSeconds,
    governingMarginSeconds:clearance.governingMarginSeconds,
    observedEnvelopeSeconds:clearance.observedEnvelopeSeconds,
    remainingObservedMarginSeconds:clearance.remainingStableMarginSeconds,
    clearsObservedEnvelope:clearance.clearsObservedEnvelope,
    ambiguousKinds:clearance.ambiguousKinds,
    evidenceId:clearance.evidenceId,
    productionModelId:clearance.productionModelId,
    evidenceKind:clearance.evidenceKind,
    cadenceMinutes:clearance.cadenceMinutes,
    samples:clearance.samples,
    empiricalGridOnly:true,
    continuousUpperBound:false,
    coversOnlyEquationOfTimeResidual:true,
    includesEarthRotationUncertainty:false,
    includesLongitudeUncertainty:false,
    includesZoneOrInputClockUncertainty:false,
    futureUtcPolicyResolved:false,
    civilTimezonePolicyResolved:false,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    status:clearance.status,
    reason:clearance.reason,
    pointEstimate,
    boundaryClearance:clearance
  });
}

export const YEAR_4006_FIXED_ZONE_EOT_CLEARANCE_CONTRACT = Object.freeze({
  id:"year-4006-fixed-zone-ut1-eot-observed-boundary-clearance-v1",
  targetYear:4006,
  inputClockSemantics:"proleptic-gregorian-fixed-zone-from-ut1",
  pointEstimateProvider:"recurrence-fixed-zone-ut1-apparent-solar-point-estimate-v1",
  evidenceClearanceProvider:"year-4006-swiss-eot-observed-boundary-clearance-v1",
  uncertaintyContribution:"equation-of-time-model-residual-only",
  empiricalGridOnly:true,
  continuousUpperBound:false,
  includesEarthRotationUncertainty:false,
  includesLongitudeUncertainty:false,
  includesZoneOrInputClockUncertainty:false,
  futureUtcPolicyResolved:false,
  civilTimezonePolicyResolved:false,
  grantsDeterministicMembership:false,
  grantsRecurrenceAuthority:false
});
