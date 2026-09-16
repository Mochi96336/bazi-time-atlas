export const EQUATION_OF_TIME_EVIDENCE_KIND = Object.freeze({
  MODERN_REFERENCE_DIFFERENTIAL:"modern-reference-differential",
  EMPIRICAL_GRID_OBSERVED_PRODUCTION_MAX_ABS:"empirical-grid-observed-production-max-abs",
  CONTINUOUS_CERTIFIED_UPPER_BOUND:"continuous-certified-upper-bound"
});

export const EQUATION_OF_TIME_EVIDENCE_KIND_VALUES = Object.freeze(
  Object.values(EQUATION_OF_TIME_EVIDENCE_KIND)
);

function assertEvidenceRecord(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new TypeError("Equation-of-Time evidence must be an object");
  }
  if (typeof evidence.evidenceId !== "string" || evidence.evidenceId.trim() === "") {
    throw new TypeError("Equation-of-Time evidenceId must be a non-empty string");
  }
  if (!EQUATION_OF_TIME_EVIDENCE_KIND_VALUES.includes(evidence.evidenceKind)) {
    throw new RangeError(
      `Equation-of-Time evidenceKind must be one of: ${EQUATION_OF_TIME_EVIDENCE_KIND_VALUES.join(", ")}`
    );
  }
}

function result(fields) {
  return Object.freeze({
    continuousUpperBound:false,
    continuousBoundaryClearanceEligible:false,
    requiresTargetBoundaryClearance:false,
    unconditionalEotAuthorityEligible:false,
    certifiedUpperBoundSeconds:null,
    authorityGap:null,
    ...fields
  });
}

/**
 * Classify registry-owned Equation-of-Time evidence by what it can prove.
 *
 * This function does not grant recurrence authority. It only answers whether
 * one evidence record is structurally strong enough to participate in a
 * future target-specific boundary-clearance proof.
 *
 * A finite non-zero continuous residual bound is still conditional evidence:
 * a target can sit arbitrarily close to a Day/Hour boundary. Only a certified
 * exact-zero residual could satisfy the EoT layer without a target-specific
 * boundary-clearance step. Other uncertainty channels remain separate.
 */
export function equationOfTimeEvidenceQualification(evidence) {
  assertEvidenceRecord(evidence);

  if (evidence.evidenceKind === EQUATION_OF_TIME_EVIDENCE_KIND.MODERN_REFERENCE_DIFFERENTIAL) {
    if (evidence.continuousUpperBound === true) {
      throw new RangeError("modern reference differential cannot claim a continuous upper bound");
    }
    return result({
      evidenceId:evidence.evidenceId,
      evidenceKind:evidence.evidenceKind,
      authorityGap:"reference-evidence-is-not-recurrence-validation"
    });
  }

  if (evidence.evidenceKind === EQUATION_OF_TIME_EVIDENCE_KIND.EMPIRICAL_GRID_OBSERVED_PRODUCTION_MAX_ABS) {
    if (evidence.continuousUpperBound === true) {
      throw new RangeError("empirical grid evidence cannot claim a continuous upper bound");
    }
    return result({
      evidenceId:evidence.evidenceId,
      evidenceKind:evidence.evidenceKind,
      authorityGap:"empirical-grid-is-not-continuous-bound"
    });
  }

  if (evidence.continuousUpperBound !== true) {
    throw new RangeError("continuous certified evidence must declare continuousUpperBound=true");
  }
  if (!Number.isFinite(evidence.certifiedUpperBoundSeconds) || evidence.certifiedUpperBoundSeconds < 0) {
    throw new RangeError("continuous certified evidence requires certifiedUpperBoundSeconds >= 0");
  }
  if (typeof evidence.certificationMethod !== "string" || evidence.certificationMethod.trim() === "") {
    throw new TypeError("continuous certified evidence requires a certificationMethod");
  }

  const exact = evidence.certifiedUpperBoundSeconds === 0;
  return result({
    evidenceId:evidence.evidenceId,
    evidenceKind:evidence.evidenceKind,
    continuousUpperBound:true,
    continuousBoundaryClearanceEligible:true,
    requiresTargetBoundaryClearance:!exact,
    unconditionalEotAuthorityEligible:exact,
    certifiedUpperBoundSeconds:evidence.certifiedUpperBoundSeconds,
    certificationMethod:evidence.certificationMethod,
    authorityGap:exact ? null : "nonzero-continuous-bound-requires-target-boundary-clearance"
  });
}

export const EQUATION_OF_TIME_EVIDENCE_QUALIFICATION_CONTRACT = Object.freeze({
  id:"recurrence-equation-of-time-evidence-qualification-v1",
  registryEvidenceOnly:true,
  empiricalGridCanGrantContinuousBound:false,
  modernReferenceCanGrantContinuousBound:false,
  continuousCertifiedBoundCanEnterBoundaryClearance:true,
  nonzeroContinuousBoundRequiresTargetBoundaryClearance:true,
  continuousBoundAloneDoesNotGrantPillarMembership:true,
  otherUncertaintyChannelsRemainSeparate:true,
  exactZeroContinuousResidualMaySatisfyEotLayerWithoutBoundaryClearance:true
});
