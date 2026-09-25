import {
  DE441_10026_SEASONAL_CROSSING_EVIDENCE
} from "../astronomy/de441-10026-seasonal-crossing-evidence.js";
import {
  cachedResearchSeasonalEvidenceForLongitude
} from "./research-seasonal-evidence-cache.js";

const EVIDENCE = Object.freeze([
  DE441_10026_SEASONAL_CROSSING_EVIDENCE
]);

function normalizedLongitude(value) {
  if (!Number.isFinite(value)) throw new RangeError("longitudeDegrees must be finite");
  return ((value % 360) + 360) % 360;
}

function freeze(value) {
  return Object.freeze(value);
}

/**
 * Research-only seasonal-event evidence.
 *
 * This registry exists so Research views can consume a pinned, reproducible
 * source-derived TT crossing without registering it as a production provider.
 * Every returned event carries the evidence claim boundary unchanged.
 */
export function researchSeasonalEvidenceForLongitude({ year, longitudeDegrees }) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  const longitude = normalizedLongitude(longitudeDegrees);
  const cached = cachedResearchSeasonalEvidenceForLongitude({
    year,
    longitudeDegrees:longitude
  });
  if (cached) return cached;

  const evidence = EVIDENCE.find(item => item.catalogueYear === year);
  if (!evidence) return null;

  if (longitude !== evidence.liChun.longitudeDegrees) return null;
  const term = Object.freeze({
    name:"立春",
    longitudeDegrees:evidence.liChun.longitudeDegrees,
    ttJulianDay:evidence.liChun.ttJulianDay
  });

  return freeze({
    id:`${evidence.id}:${longitude}`,
    evidenceId:evidence.id,
    validationKind:evidence.validationKind,
    authority:evidence.authority,
    sourceEphemeris:evidence.sourceEphemeris,
    year,
    name:term.name,
    longitudeDegrees:longitude,
    timeScale:evidence.timeScale,
    ttJulianDay:term.ttJulianDay,
    independentTargetYearTruth:evidence.claimBoundary.independentTargetYearTruth,
    sourceDerivedTargetYear:evidence.claimBoundary.sourceDerivedTargetYear,
    frameIndependentlyValidatedAtTargetYear:
      evidence.claimBoundary.frameIndependentlyValidatedAtTargetYear,
    productionIntegrated:evidence.claimBoundary.productionIntegrated,
    productionAuthorityGranted:evidence.claimBoundary.productionAuthorityGranted,
    civilTimeResolved:evidence.claimBoundary.civilTimeResolved,
    researchRun:evidence.researchRun,
    transport:"pinned-js-li-chun-summary",
    payloadIntegrityVerified:false,
    payloadSha256:null,
    chunkId:null
  });
}

export const RESEARCH_SEASONAL_EVIDENCE_REGISTRY = freeze({
  id:"research-source-derived-seasonal-evidence-registry-v1",
  evidenceIds:freeze(EVIDENCE.map(item => item.id)),
  cachePreferred:true,
  binaryTransport:"verified-binary-chunk",
  fallbackTransport:"pinned-js-li-chun-summary",
  fallbackCoverage:"li-chun-only",
  productionAuthorityGranted:false,
  independentTargetYearTruthRequiredForProductionPromotion:true
});
