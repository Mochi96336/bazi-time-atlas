import {
  resolveSeasonalBoundary
} from "./seasonal-boundary-authority.js";
import {
  researchSeasonalEvidenceForLongitude
} from "./research-seasonal-evidence-registry.js";

function freeze(value) {
  return Object.freeze(value);
}

/**
 * Research-only overlay for pinned seasonal-event evidence.
 *
 * Canonical seasonal authority is always resolved first. Pinned Research
 * evidence may only fill a qualified source-covered/runtime-missing gap; it
 * never replaces a production direct-event runtime, the bounded model path,
 * or a fail-closed absolute-source gap.
 */
export function resolveResearchSeasonalBoundary({ year, longitudeDegrees }) {
  const canonicalBoundary = resolveSeasonalBoundary({ year, longitudeDegrees });

  if (canonicalBoundary.status !== "source-covered-runtime-missing") {
    return canonicalBoundary;
  }

  const researchEvent = researchSeasonalEvidenceForLongitude({
    year,
    longitudeDegrees
  });
  if (!researchEvent) return canonicalBoundary;

  const sourceIds = canonicalBoundary.sourceIds ?? Object.freeze([]);
  if (
    researchEvent.sourceEphemeris !== "DE441"
    || !sourceIds.includes("jpl-de441")
  ) {
    return canonicalBoundary;
  }

  return freeze({
    status:"resolved-research-evidence",
    epochStatus:"resolved",
    authorityClass:"source-derived-research-evidence",
    providerId:null,
    providerRole:null,
    timeScale:researchEvent.timeScale,
    ttJulianDay:researchEvent.ttJulianDay,
    event:researchEvent,
    evidenceId:researchEvent.evidenceId,
    sourceIds,
    sourceCoverage:canonicalBoundary.sourceCoverage,
    runtimeCoverage:null,
    evidenceIds:Object.freeze([researchEvent.evidenceId]),
    evidenceClass:researchEvent.validationKind,
    independentTargetYearTruth:researchEvent.independentTargetYearTruth,
    sourceDerivedTargetYear:researchEvent.sourceDerivedTargetYear,
    productionAuthorityGranted:researchEvent.productionAuthorityGranted,
    canonicalAuthorityStatus:canonicalBoundary.status,
    canonicalAuthorityClass:canonicalBoundary.authorityClass,
    blocker:"target-year-independent-validation"
  });
}

export const RESEARCH_SEASONAL_BOUNDARY_RESOLUTION_CONTRACT = freeze({
  id:"research-seasonal-boundary-overlay-v1",
  canonicalAuthorityUnmodified:true,
  overlayStatus:"resolved-research-evidence",
  appliesOnlyWhenCanonicalStatus:"source-covered-runtime-missing",
  productionAuthorityGranted:false
});
