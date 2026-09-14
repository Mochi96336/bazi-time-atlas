import {
  SEASONAL_EPOCH_PROVIDER_ROLES,
  seasonalEpochCoverageBounds
} from "./seasonal-epoch-provider.js";

export const DIRECT_SEASONAL_VALIDATION_KINDS = Object.freeze({
  SAME_MODEL:"same-model-consistency",
  INDEPENDENT_EPHEMERIS:"independent-ephemeris"
});

export const DIRECT_SEASONAL_PROMOTION_POLICY = Object.freeze({
  requiredReferenceSemantics:"apparent-geocentric-solar-longitude-of-date",
  minimumSamplesAtTargetYear:24,
  maxEpochErrorSeconds:2
});

/**
 * Independent authority contract intended for future pinned validation vectors.
 *
 * Horizons quantity #31 is the quantity JPL explicitly recommends for Earth
 * seasons: apparent observer-centered ecliptic-of-date longitude of the Sun as
 * seen from the geocenter. The actual validation vectors are intentionally not
 * invented here; a future evidence record must pin the returned ephemeris
 * metadata and 24 target-year crossings before promotion can pass.
 */
export const JPL_HORIZONS_SEASONAL_REFERENCE = Object.freeze({
  id:"jpl-horizons-earth-season-reference",
  family:"jpl-planetary-ephemeris",
  authority:"NASA/JPL Horizons",
  sourceUrl:"https://ssd.jpl.nasa.gov/horizons/",
  target:"Sun",
  observerCenter:"Earth geocenter",
  quantity:"31 · observer-centered Earth ecliptic longitude/latitude",
  referenceSemantics:"apparent-geocentric-solar-longitude-of-date",
  timeScale:"TT",
  status:"reference-contract-only",
  note:"Use pinned Horizons output and record the actual planetary ephemeris named by the response header. This contract alone is not validation evidence."
});

export const SHOUXING_PIPELINE_PROOF_EVIDENCE = Object.freeze([
  Object.freeze({
    id:"tyme-shouxing-2026-24-term-consistency",
    providerId:"tyme4ts-1.5.2-shouxing-direct",
    kind:DIRECT_SEASONAL_VALIDATION_KINDS.SAME_MODEL,
    referenceFamily:"shouxing",
    referenceSemantics:"apparent-geocentric-solar-longitude-of-date",
    timeScale:"TT",
    sampledYears:Object.freeze([2026]),
    samplesByYear:Object.freeze({ 2026:24 }),
    maxEpochErrorSeconds:2,
    authority:"repo pinned Tyme 1.5.2 solar-term path",
    note:"Proof of pipeline consistency only. The direct solver and reference path share the ShouXing model, so this cannot independently validate deep-time accuracy."
  })
]);

function assertInteger(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function samplesAtYear(evidence, year) {
  const value = evidence?.samplesByYear?.[year];
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function evidenceCoversTarget(evidence, targetYear) {
  return Array.isArray(evidence?.sampledYears)
    && evidence.sampledYears.includes(targetYear)
    && samplesAtYear(evidence, targetYear) > 0;
}

function isIndependentTargetEvidence({ evidence, provider, targetYear, policy }) {
  return evidence?.providerId === provider.id
    && evidence?.kind === DIRECT_SEASONAL_VALIDATION_KINDS.INDEPENDENT_EPHEMERIS
    && evidence?.referenceFamily
    && evidence.referenceFamily !== provider.modelFamily
    && evidence.referenceSemantics === policy.requiredReferenceSemantics
    && evidence.timeScale === provider.timeScale
    && evidenceCoversTarget(evidence, targetYear)
    && samplesAtYear(evidence, targetYear) >= policy.minimumSamplesAtTargetYear
    && Number.isFinite(evidence.maxEpochErrorSeconds)
    && evidence.maxEpochErrorSeconds <= policy.maxEpochErrorSeconds;
}

/**
 * Decide whether a direct seasonal-event provider has enough independent
 * evidence to extend its validated coverage to one target year.
 *
 * Passing this gate means the provider is eligible for an explicit coverage
 * update. It does not mutate provider metadata and does not integrate the
 * provider into the production seasonal-epoch registry by itself.
 */
export function assessDirectSeasonalProviderPromotion({
  provider,
  targetYear,
  evidence = [],
  policy = DIRECT_SEASONAL_PROMOTION_POLICY
}) {
  if (!provider || provider.role !== SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT) {
    throw new TypeError("promotion assessment requires a direct-seasonal-event provider");
  }
  if (!provider.modelFamily || typeof provider.modelFamily !== "string") {
    throw new TypeError("direct provider must declare modelFamily for independence checks");
  }
  assertInteger(targetYear, "targetYear");
  if (!Array.isArray(evidence)) throw new TypeError("evidence must be an array");

  const declaredCoverage = seasonalEpochCoverageBounds(provider);
  const targetAlreadyDeclared = targetYear >= declaredCoverage.minYear
    && targetYear <= declaredCoverage.maxYear;
  const providerEvidence = evidence.filter(item => item?.providerId === provider.id);
  const targetEvidence = providerEvidence.filter(item => evidenceCoversTarget(item, targetYear));
  const sameModelTargetEvidence = targetEvidence.filter(item =>
    item.kind === DIRECT_SEASONAL_VALIDATION_KINDS.SAME_MODEL
    || item.referenceFamily === provider.modelFamily
  );
  const independentTargetEvidence = targetEvidence.filter(item =>
    isIndependentTargetEvidence({ evidence:item, provider, targetYear, policy })
  );
  const sameModelEvidenceYears = Object.freeze([
    ...new Set(providerEvidence
      .filter(item => item.kind === DIRECT_SEASONAL_VALIDATION_KINDS.SAME_MODEL
        || item.referenceFamily === provider.modelFamily)
      .flatMap(item => Array.isArray(item.sampledYears) ? item.sampledYears : []))
  ].sort((a, b) => a - b));

  const coverageExtensionEligible = independentTargetEvidence.length > 0;
  let status;
  let blocker;
  if (coverageExtensionEligible) {
    status = "independent-validation-pass";
    blocker = null;
  } else if (sameModelTargetEvidence.length) {
    status = "same-model-evidence-only";
    blocker = "independent-target-year-validation";
  } else {
    status = "independent-validation-missing";
    blocker = "independent-target-year-validation";
  }

  return Object.freeze({
    providerId:provider.id,
    providerModelFamily:provider.modelFamily,
    targetYear,
    declaredCoverage,
    targetAlreadyDeclared,
    status,
    blocker,
    policy,
    sameModelEvidenceYears,
    targetEvidenceIds:Object.freeze(targetEvidence.map(item => item.id)),
    independentTargetEvidenceIds:Object.freeze(independentTargetEvidence.map(item => item.id)),
    coverageExtensionEligible,
    productionPromotionEligible:coverageExtensionEligible && targetAlreadyDeclared,
    requiresCoverageMetadataUpdate:coverageExtensionEligible && !targetAlreadyDeclared
  });
}
