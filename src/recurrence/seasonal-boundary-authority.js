import {
  TYME_SHOUXING_DIRECT_PROVIDER,
  solveSolarLongitude
} from "../astronomy/direct-seasonal-event-provider.js";
import {
  DIRECT_SEASONAL_INDEPENDENT_EVIDENCE
} from "./direct-seasonal-provider-validation-evidence.js";
import {
  PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDERS,
  productionDirectSeasonalEventRuntime,
  productionSeasonalEventForLongitude
} from "./seasonal-epoch-runtime-registry.js";
import { seasonalEpochCoverageBounds } from "./seasonal-epoch-provider.js";
import {
  SEASONAL_EPOCH_SOURCES,
  seasonalEpochSourceAudit
} from "./seasonal-epoch-source-audit.js";

function assertRequest(year, longitudeDegrees) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  if (!Number.isFinite(longitudeDegrees)) {
    throw new RangeError("longitudeDegrees must be finite");
  }
}

function coversYear(provider, year) {
  const bounds = seasonalEpochCoverageBounds(provider);
  return year >= bounds.minYear && year <= bounds.maxYear;
}

function independentEvidenceFor(providerId, year) {
  return DIRECT_SEASONAL_INDEPENDENT_EVIDENCE.filter(item =>
    item.providerId === providerId
    && Array.isArray(item.sampledYears)
    && item.sampledYears.includes(year)
  );
}

function sourceAuditFor(year) {
  return seasonalEpochSourceAudit({
    baseYear:year === 2000 ? 1999 : 2000,
    targetYear:year
  });
}

function productionDirectProviderForYear(year) {
  return PRODUCTION_DIRECT_SEASONAL_EVENT_PROVIDERS.find(provider =>
    coversYear(provider, year)
  ) ?? null;
}

function freezeResult(fields) {
  return Object.freeze(fields);
}

/**
 * Resolve one seasonal longitude crossing without collapsing source coverage,
 * runtime integration and evidence quality into a single "available" flag.
 *
 * Priority is intentional:
 *   1. reviewed production direct-event runtime;
 *   2. the explicitly bounded ShouXing research model;
 *   3. qualified absolute-state source coverage with no runtime;
 *   4. no qualified absolute seasonal-epoch source.
 *
 * The result is an astronomical epoch authority on its declared time scale.
 * It makes no UTC, UT1, timezone or civil-position claim.
 */
export function resolveSeasonalBoundary({ year, longitudeDegrees }) {
  assertRequest(year, longitudeDegrees);

  const productionProvider = productionDirectProviderForYear(year);
  if (productionProvider) {
    const runtime = productionDirectSeasonalEventRuntime(productionProvider.id);
    const event = productionSeasonalEventForLongitude({
      providerId:productionProvider.id,
      year,
      longitudeDegrees
    });
    return freezeResult({
      year,
      longitudeDegrees,
      status:"resolved",
      epochStatus:"resolved",
      authorityClass:"reviewed-production-direct-event",
      providerId:productionProvider.id,
      providerRole:productionProvider.role,
      timeScale:event.timeScale,
      ttJulianDay:event.timeScale === "TT" ? event.ttJulianDay : null,
      event,
      sourceCoverage:seasonalEpochCoverageBounds(productionProvider),
      runtimeCoverage:seasonalEpochCoverageBounds(productionProvider),
      evidenceIds:Object.freeze([
        event.sourceEvidenceId,
        runtime.registration.reconstructionEvidenceId
      ].filter(Boolean)),
      blocker:null
    });
  }

  if (coversYear(TYME_SHOUXING_DIRECT_PROVIDER, year)) {
    const event = solveSolarLongitude({ year, longitudeDegrees });
    const evidence = independentEvidenceFor(TYME_SHOUXING_DIRECT_PROVIDER.id, year);
    return freezeResult({
      year,
      longitudeDegrees,
      status:"resolved",
      epochStatus:"resolved",
      authorityClass:"declared-model-direct-event",
      providerId:TYME_SHOUXING_DIRECT_PROVIDER.id,
      providerRole:TYME_SHOUXING_DIRECT_PROVIDER.role,
      timeScale:event.timeScale,
      ttJulianDay:event.ttJulianDay,
      event,
      sourceCoverage:seasonalEpochCoverageBounds(TYME_SHOUXING_DIRECT_PROVIDER),
      runtimeCoverage:seasonalEpochCoverageBounds(TYME_SHOUXING_DIRECT_PROVIDER),
      evidenceIds:Object.freeze(evidence.map(item => item.id)),
      evidenceClass:evidence.length
        ? "independent-crosscheck-present"
        : "declared-model-window-only",
      blocker:null
    });
  }

  const audit = sourceAuditFor(year);
  if (audit.qualifiedStateBasisSourceIds.length || audit.qualifiedDirectEventSourceIds.length) {
    const sourceIds = Object.freeze([
      ...audit.qualifiedDirectEventSourceIds,
      ...audit.qualifiedStateBasisSourceIds
    ]);
    const sourceCoverage = Object.freeze(sourceIds.map(id => {
      const source = SEASONAL_EPOCH_SOURCES.find(item => item.id === id);
      return Object.freeze({
        providerId:id,
        role:source?.role ?? null,
        coverage:source ? seasonalEpochCoverageBounds(source) : null
      });
    }));
    return freezeResult({
      year,
      longitudeDegrees,
      status:"source-covered-runtime-missing",
      epochStatus:"unresolved",
      authorityClass:"qualified-source-without-runtime",
      providerId:null,
      providerRole:null,
      timeScale:null,
      ttJulianDay:null,
      event:null,
      sourceIds,
      sourceCoverage,
      runtimeCoverage:null,
      evidenceIds:Object.freeze([]),
      blocker:audit.blocker
    });
  }

  return freezeResult({
    year,
    longitudeDegrees,
    status:"absolute-source-unavailable",
    epochStatus:"unresolved",
    authorityClass:"no-qualified-absolute-source",
    providerId:null,
    providerRole:null,
    timeScale:null,
    ttJulianDay:null,
    event:null,
    sourceIds:Object.freeze([]),
    sourceCoverage:null,
    runtimeCoverage:null,
    evidenceIds:Object.freeze([]),
    blocker:audit.blocker,
    nearestEphemerisBoundary:audit.nearestEphemerisBoundary
  });
}

export const SEASONAL_BOUNDARY_AUTHORITY_CONTRACT = Object.freeze({
  id:"research-seasonal-boundary-authority-v1",
  outputClaim:"astronomical-seasonal-epoch-only",
  civilTimeResolved:false,
  providerPriority:Object.freeze([
    "reviewed-production-direct-event",
    "declared-model-direct-event",
    "qualified-source-without-runtime",
    "no-qualified-absolute-source"
  ])
});
