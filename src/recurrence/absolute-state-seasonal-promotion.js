import {
  SEASONAL_EPOCH_PROVIDER_ROLES,
  seasonalEpochCoverageBounds
} from "./seasonal-epoch-provider.js";

export const ABSOLUTE_STATE_SEASONAL_VALIDATION_KINDS = Object.freeze({
  AUTHORITATIVE_OBSERVABLE_RECONSTRUCTION:"authoritative-observable-reconstruction"
});

export const ABSOLUTE_STATE_SEASONAL_PROMOTION_POLICY = Object.freeze({
  requiredReferenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  requiredTimeScale:"TT",
  requiredValidationKind:ABSOLUTE_STATE_SEASONAL_VALIDATION_KINDS.AUTHORITATIVE_OBSERVABLE_RECONSTRUCTION,
  minimumSamplesAtTargetYear:24,
  maxEpochErrorSeconds:2,
  requiredPromotionBoundaryFlags:Object.freeze([
    "ttToTdbValidated",
    "de441StateInterpolationValidated",
    "lightTimeValidated",
    "stellarAberrationValidated",
    "sunCenterApparentIcrfValidated",
    "sunCenterApparentCorrectionModelValidated",
    "eclipticOfDateFrameValidated",
    "crossingRootSolveValidated",
    "productionShapedSolverParityValidated"
  ])
});

function assertInteger(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function samplesAtYear(evidence, year) {
  const count = evidence?.samplesByYear?.[year];
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

function evidenceCoversTarget(evidence, targetYear) {
  return Array.isArray(evidence?.sampledYears)
    && evidence.sampledYears.includes(targetYear)
    && samplesAtYear(evidence, targetYear) > 0;
}

function missingBoundaryFlags(evidence, policy) {
  return policy.requiredPromotionBoundaryFlags.filter(flag =>
    evidence?.promotionBoundary?.[flag] !== true
  );
}

function isCandidate({ evidence, provider, targetYear, policy }) {
  return evidence?.providerId === provider.id
    && evidence?.validationKind === policy.requiredValidationKind
    && evidence?.referenceSemantics === policy.requiredReferenceSemantics
    && evidence?.timeScale === policy.requiredTimeScale
    && evidenceCoversTarget(evidence, targetYear)
    && samplesAtYear(evidence, targetYear) >= policy.minimumSamplesAtTargetYear;
}

/**
 * Assess whether an absolute-state seasonal reconstruction has enough pinned,
 * authoritative target-year evidence to proceed to a separate production
 * integration review.
 *
 * Passing this gate does not register an adapter, widen runtime coverage, or
 * mark a target year usable. Source ephemeris coverage and bundled runtime
 * adapter coverage remain separate concepts by design.
 */
export function assessAbsoluteStateSeasonalPromotion({
  provider,
  targetYear,
  evidence = [],
  policy = ABSOLUTE_STATE_SEASONAL_PROMOTION_POLICY
}) {
  if (!provider || provider.role !== SEASONAL_EPOCH_PROVIDER_ROLES.ABSOLUTE_STATE_BASIS) {
    throw new TypeError("promotion assessment requires an absolute-state-basis provider");
  }
  assertInteger(targetYear, "targetYear");
  if (!Array.isArray(evidence)) throw new TypeError("evidence must be an array");

  const sourceCoverage = seasonalEpochCoverageBounds(provider);
  const sourceCoversTarget = targetYear >= sourceCoverage.minYear
    && targetYear <= sourceCoverage.maxYear;
  const providerEvidence = evidence.filter(item => item?.providerId === provider.id);
  const targetEvidence = providerEvidence.filter(item => evidenceCoversTarget(item, targetYear));
  const candidates = targetEvidence.filter(item =>
    isCandidate({ evidence:item, provider, targetYear, policy })
  );
  const assessedCandidates = candidates.map(item => Object.freeze({
    id:item.id,
    maxEpochErrorSeconds:item.proofResult?.maxEpochErrorSeconds,
    missingPromotionBoundaryFlags:Object.freeze(missingBoundaryFlags(item, policy)),
    epochBudgetPass:Number.isFinite(item.proofResult?.maxEpochErrorSeconds)
      && item.proofResult.maxEpochErrorSeconds <= policy.maxEpochErrorSeconds
  }));
  const passing = assessedCandidates.filter(item =>
    item.epochBudgetPass && item.missingPromotionBoundaryFlags.length === 0
  );

  let status;
  let blocker;
  if (!sourceCoversTarget) {
    status = "outside-source-coverage";
    blocker = "source-ephemeris-coverage";
  } else if (passing.length) {
    status = "authoritative-reconstruction-pass";
    blocker = null;
  } else if (assessedCandidates.some(item => !item.epochBudgetPass)) {
    status = "authoritative-reconstruction-failed";
    blocker = "epoch-error-budget";
  } else if (assessedCandidates.some(item => item.missingPromotionBoundaryFlags.length > 0)) {
    status = "authoritative-reconstruction-incomplete";
    blocker = "scientific-chain-validation";
  } else {
    status = "authoritative-reconstruction-missing";
    blocker = "authoritative-target-year-validation";
  }

  const integrationEligible = sourceCoversTarget && passing.length > 0;
  return Object.freeze({
    providerId:provider.id,
    targetYear,
    sourceCoverage,
    sourceCoversTarget,
    policy,
    status,
    blocker,
    targetEvidenceIds:Object.freeze(targetEvidence.map(item => item.id)),
    candidateEvidenceIds:Object.freeze(assessedCandidates.map(item => item.id)),
    passingEvidenceIds:Object.freeze(passing.map(item => item.id)),
    candidateAssessments:Object.freeze(assessedCandidates),
    integrationEligible,
    productionPromotionEligible:false,
    requiresProductionIntegration:integrationEligible,
    note:"Integration eligibility is evidence-only. Production runtime coverage must be declared separately and must not inherit the full source-ephemeris coverage automatically."
  });
}
