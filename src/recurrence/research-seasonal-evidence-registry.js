import {
  de441SeasonalCanonicalLongitudeIndex
} from "../astronomy/de441-seasonal-event-chunk.js";

const CATALOGUED_EVIDENCE_IDS = Object.freeze([
  "de441-10026-source-derived-seasonal-crossing-evidence-v1"
]);

const REFERENCE_SEMANTICS = "geocentric-apparent-solar-longitude-mean-ecliptic-of-date";
const YEAR_BASIS = "atlas-solar-term-catalogue";
const VALIDATION_KIND = "source-derived-reconstruction";
const CLAIM_CLASS = "de441-derived-source-derived";

const loadedByYear = new Map();

function normalizedLongitude(value) {
  if (!Number.isFinite(value)) throw new RangeError("longitudeDegrees must be finite");
  return ((value % 360) + 360) % 360;
}

function freeze(value) {
  return Object.freeze(value);
}

function assertResearchOnlyManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new TypeError("manifest is required");
  if (manifest.sourceEphemeris !== "DE441") throw new RangeError("Research seasonal manifest must be DE441");
  if (manifest.timeScale !== "TT") throw new RangeError("Research seasonal manifest must use TT");
  if (manifest.referenceSemantics !== REFERENCE_SEMANTICS) {
    throw new RangeError("Research seasonal manifest reference semantics mismatch");
  }
  if (manifest.yearBasis !== YEAR_BASIS) {
    throw new RangeError("Research seasonal manifest year basis mismatch");
  }
  if (manifest.validationKind !== VALIDATION_KIND || manifest.claimClass !== CLAIM_CLASS) {
    throw new RangeError("Research seasonal manifest claim class mismatch");
  }
  if (
    manifest.chunkSchemaVersion !== 1
    || manifest.eventsPerYear !== 24
    || manifest.longitudeStepDegrees !== 15
  ) {
    throw new RangeError("Research seasonal manifest seasonal grid mismatch");
  }
  if (manifest.productionAuthorityGranted !== false) {
    throw new RangeError("Research seasonal manifest must not grant production authority");
  }
  if (manifest.productionIntegrated !== false) {
    throw new RangeError("Research seasonal manifest must not claim production integration");
  }
  if (manifest.independentTargetYearTruth !== false) {
    throw new RangeError("source-derived Research manifest must not claim independent target-year truth");
  }
  if (manifest.sourceDerivedTargetYear !== true) {
    throw new RangeError("Research seasonal manifest must declare source-derived target-year semantics");
  }
  if (
    manifest.frameIndependentlyValidatedAtTargetYear !== false
    || manifest.civilTimeResolved !== false
  ) {
    throw new RangeError("Research seasonal manifest overstates target-year validation or civil time");
  }
  if (!Array.isArray(manifest.evidenceIds) || manifest.evidenceIds.length < 1) {
    throw new RangeError("Research seasonal manifest must pin evidence ids");
  }
  if (!manifest.evidenceIds.every(id => CATALOGUED_EVIDENCE_IDS.includes(id))) {
    throw new RangeError("Research seasonal manifest references uncatalogued evidence");
  }
}

export function installResearchSeasonalEvidenceChunk({ manifest, chunk }) {
  assertResearchOnlyManifest(manifest);
  if (!chunk || typeof chunk.ttJulianDayFor !== "function") {
    throw new TypeError("decoded seasonal chunk is required");
  }
  if (
    chunk.minYear !== manifest.minYear
    || chunk.maxYear !== manifest.maxYear
    || chunk.yearCount !== manifest.yearCount
    || chunk.eventsPerYear !== manifest.eventsPerYear
    || chunk.encoding !== manifest.encoding
  ) {
    throw new RangeError("Research seasonal chunk does not match its manifest");
  }

  for (let year = manifest.minYear; year <= manifest.maxYear; year += 1) {
    loadedByYear.set(year, freeze({ manifest, chunk }));
  }

  return freeze({
    status:"installed",
    minYear:manifest.minYear,
    maxYear:manifest.maxYear,
    evidenceIds:freeze([...manifest.evidenceIds])
  });
}

export function researchSeasonalEvidenceLoadedForYear(year) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  return loadedByYear.has(year);
}

export function clearResearchSeasonalEvidenceForTests() {
  loadedByYear.clear();
}

/**
 * Research-only seasonal-event evidence.
 *
 * Browser runtime data is installed only after a compact binary chunk has
 * passed manifest, SHA-256 and chunk-format validation. Merely having a pinned
 * proof module in the repository does not make the epoch available at runtime.
 */
export function researchSeasonalEvidenceForLongitude({ year, longitudeDegrees }) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  const longitude = normalizedLongitude(longitudeDegrees);
  const loaded = loadedByYear.get(year);
  if (!loaded) return null;

  let longitudeIndex;
  try {
    longitudeIndex = de441SeasonalCanonicalLongitudeIndex(longitude);
  } catch {
    return null;
  }
  const canonicalLongitude = longitudeIndex * 15;

  const { manifest, chunk } = loaded;
  const ttJulianDay = chunk.ttJulianDayFor({
    year,
    longitudeDegrees:canonicalLongitude
  });
  const evidenceId = manifest.evidenceIds[0];

  return freeze({
    id:`${evidenceId}:${canonicalLongitude}`,
    evidenceId,
    validationKind:manifest.validationKind,
    authority:manifest.authority,
    sourceEphemeris:manifest.sourceEphemeris,
    year,
    name:manifest.termNamesByLongitude?.[String(canonicalLongitude)] ?? `${canonicalLongitude}°`,
    longitudeDegrees:canonicalLongitude,
    timeScale:manifest.timeScale,
    ttJulianDay,
    independentTargetYearTruth:manifest.independentTargetYearTruth,
    sourceDerivedTargetYear:manifest.sourceDerivedTargetYear,
    frameIndependentlyValidatedAtTargetYear:
      manifest.frameIndependentlyValidatedAtTargetYear,
    productionIntegrated:manifest.productionIntegrated,
    productionAuthorityGranted:manifest.productionAuthorityGranted,
    civilTimeResolved:manifest.civilTimeResolved,
    researchRun:manifest.researchRun,
    runtimePayloadId:manifest.id,
    runtimePayloadSha256:manifest.payloadSha256
  });
}

export const RESEARCH_SEASONAL_EVIDENCE_REGISTRY = freeze({
  id:"research-source-derived-seasonal-evidence-registry-v2",
  evidenceIds:CATALOGUED_EVIDENCE_IDS,
  runtimePayloadMode:"verified-lazy-binary-chunk",
  staticEpochPayloadBundled:false,
  productionAuthorityGranted:false,
  independentTargetYearTruthRequiredForProductionPromotion:true
});
