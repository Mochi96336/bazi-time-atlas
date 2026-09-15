import {
  SEASONAL_EPOCH_PROVIDER_ROLES,
  seasonalEpochCoverageBounds
} from "./seasonal-epoch-provider.js";

export const AUTHORITATIVE_SEASONAL_DATA_PRODUCT_REGISTRATION_POLICY = Object.freeze({
  requiredValidationKind:"authoritative-source-pinning",
  requiredReferenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
  requiredTimeScale:"TT",
  requiredSourceEphemeris:"DE441",
  requiredCrossings:24,
  longitudeStepDegrees:15,
  maxReconstructionEpochErrorSeconds:2,
  requiredReconstructionBoundaryFlags:Object.freeze([
    "sunCenterApparentCorrectionModelValidated",
    "catalogueYear4006EndToEndValidated",
    "productionShapedSolverParityValidated"
  ])
});

function assertInteger(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function canonicalLongitudeSet(policy) {
  return Object.freeze(Array.from(
    { length:policy.requiredCrossings },
    (_, index) => index * policy.longitudeStepDegrees
  ));
}

function validSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function canonicalTerms(terms, policy, epochField) {
  if (!Array.isArray(terms) || terms.length !== policy.requiredCrossings) return false;
  const expected = canonicalLongitudeSet(policy);
  const seen = new Set();
  for (const term of terms) {
    if (!term || typeof term !== "object") return false;
    if (typeof term.name !== "string" || !term.name) return false;
    if (!Number.isFinite(term.longitudeDegrees) || !Number.isFinite(term[epochField])) return false;
    const longitude = normalizeDegrees(term.longitudeDegrees);
    if (!expected.includes(longitude) || seen.has(longitude)) return false;
    seen.add(longitude);
  }
  return seen.size === expected.length;
}

function sourceIntegrityFailures({ sourceEvidence, targetYear, policy }) {
  const failures = [];
  if (sourceEvidence?.validationKind !== policy.requiredValidationKind) failures.push("validation-kind");
  if (sourceEvidence?.sourceEphemeris !== policy.requiredSourceEphemeris) failures.push("source-ephemeris");
  if (sourceEvidence?.referenceSemantics !== policy.requiredReferenceSemantics) failures.push("reference-semantics");
  if (sourceEvidence?.timeScale !== policy.requiredTimeScale) failures.push("time-scale");
  if (sourceEvidence?.catalogueYear !== targetYear) failures.push("catalogue-year");
  if (!Array.isArray(sourceEvidence?.sampledYears) || !sourceEvidence.sampledYears.includes(targetYear)) {
    failures.push("sampled-year");
  }
  if (sourceEvidence?.samplesByYear?.[targetYear] !== policy.requiredCrossings) failures.push("sample-count");
  if (sourceEvidence?.crossings !== policy.requiredCrossings) failures.push("crossing-count");
  if (!validSha256(sourceEvidence?.sourceCaptureSha256)) failures.push("source-capture-sha256");
  if (!canonicalTerms(sourceEvidence?.terms, policy, "ttJulianDay")) failures.push("canonical-source-terms");
  return failures;
}

function manifestIntegrityFailures({ provider, manifest, sourceEvidence, targetYear, policy }) {
  const failures = [];
  const coverage = seasonalEpochCoverageBounds(provider);
  if (manifest?.schemaVersion !== 1) failures.push("schema-version");
  if (manifest?.providerId !== provider.id) failures.push("provider-id");
  if (manifest?.providerRole !== provider.role) failures.push("provider-role");
  if (manifest?.validationKind !== policy.requiredValidationKind) failures.push("validation-kind");
  if (manifest?.sourceEvidenceId !== sourceEvidence?.id) failures.push("source-evidence-id");
  if (manifest?.referenceSemantics !== policy.requiredReferenceSemantics) failures.push("reference-semantics");
  if (manifest?.timeScale !== policy.requiredTimeScale) failures.push("time-scale");
  if (manifest?.eventsPerYear !== policy.requiredCrossings) failures.push("events-per-year");
  if (manifest?.longitudeStepDegrees !== policy.longitudeStepDegrees) failures.push("longitude-step");
  if (!Array.isArray(manifest?.publishedYears) || !manifest.publishedYears.includes(targetYear)) {
    failures.push("published-year");
  }
  if (manifest?.currentSlice?.minYear !== coverage.minYear
    || manifest?.currentSlice?.maxYear !== coverage.maxYear) {
    failures.push("provider-coverage-mismatch");
  }
  if (manifest?.currentSlice?.events !== policy.requiredCrossings) failures.push("slice-event-count");
  if (manifest?.currentSlice?.sourceEvidenceId !== sourceEvidence?.id) failures.push("slice-source-evidence-id");
  if (manifest?.currentSlice?.sourceCaptureSha256 !== sourceEvidence?.sourceCaptureSha256) {
    failures.push("slice-source-capture-sha256");
  }
  return failures;
}

function eventIntegrityFailures({ provider, events, sourceEvidence, targetYear, policy }) {
  const failures = [];
  if (!canonicalTerms(events, policy, "ttJulianDay")) return ["canonical-runtime-events"];
  const sourceByLongitude = new Map(
    sourceEvidence.terms.map(term => [normalizeDegrees(term.longitudeDegrees), term])
  );
  for (const event of events) {
    const longitude = normalizeDegrees(event.longitudeDegrees);
    const source = sourceByLongitude.get(longitude);
    if (event.providerId !== provider.id) failures.push(`provider-id:${longitude}`);
    if (event.providerRole !== provider.role) failures.push(`provider-role:${longitude}`);
    if (event.sourceEvidenceId !== sourceEvidence.id) failures.push(`source-evidence-id:${longitude}`);
    if (event.catalogueYear !== targetYear) failures.push(`catalogue-year:${longitude}`);
    if (event.referenceSemantics !== policy.requiredReferenceSemantics) failures.push(`reference-semantics:${longitude}`);
    if (event.timeScale !== policy.requiredTimeScale) failures.push(`time-scale:${longitude}`);
    if (!source || event.name !== source.name || event.ttJulianDay !== source.ttJulianDay) {
      failures.push(`source-payload:${longitude}`);
    }
  }
  return failures;
}

function reconstructionIntegrityFailures({ reconstructionEvidence, targetYear, policy }) {
  const failures = [];
  if (reconstructionEvidence?.providerId !== "jpl-de441") failures.push("provider-id");
  if (reconstructionEvidence?.sourceEphemeris !== policy.requiredSourceEphemeris) failures.push("source-ephemeris");
  if (reconstructionEvidence?.catalogueYear !== targetYear) failures.push("catalogue-year");
  if (reconstructionEvidence?.referenceSemantics !== policy.requiredReferenceSemantics) failures.push("reference-semantics");
  if (reconstructionEvidence?.timeScale !== policy.requiredTimeScale) failures.push("time-scale");
  if (reconstructionEvidence?.samplesByYear?.[targetYear] !== policy.requiredCrossings) failures.push("sample-count");
  if (reconstructionEvidence?.proofResult?.solvedCrossings !== policy.requiredCrossings
    || reconstructionEvidence?.proofResult?.totalCrossings !== policy.requiredCrossings) {
    failures.push("crossing-count");
  }
  if (!Number.isFinite(reconstructionEvidence?.proofResult?.maxEpochErrorSeconds)
    || reconstructionEvidence.proofResult.maxEpochErrorSeconds > policy.maxReconstructionEpochErrorSeconds) {
    failures.push("epoch-error-budget");
  }
  for (const flag of policy.requiredReconstructionBoundaryFlags) {
    if (reconstructionEvidence?.promotionBoundary?.[flag] !== true) failures.push(`boundary:${flag}`);
  }
  return failures;
}

/**
 * Gate one bundled authoritative seasonal-event slice for an explicit later
 * production registry mutation.
 *
 * This assessor does not register the provider. It proves that the bundled
 * runtime payload is exactly the pinned authoritative source slice and that a
 * separately reconstructed DE441/Horizons path reproduces the same observable
 * inside the repository's two-second promotion budget.
 */
export function assessAuthoritativeSeasonalDataProductRegistration({
  provider,
  manifest,
  sourceEvidence,
  reconstructionEvidence,
  events,
  targetYear,
  policy = AUTHORITATIVE_SEASONAL_DATA_PRODUCT_REGISTRATION_POLICY
}) {
  if (!provider || provider.role !== SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT) {
    throw new TypeError("registration assessment requires a direct-seasonal-event provider");
  }
  assertInteger(targetYear, "targetYear");
  const coverage = seasonalEpochCoverageBounds(provider);
  const targetPublished = targetYear >= coverage.minYear && targetYear <= coverage.maxYear;

  const sourceFailures = sourceIntegrityFailures({ sourceEvidence, targetYear, policy });
  const manifestFailures = manifestIntegrityFailures({ provider, manifest, sourceEvidence, targetYear, policy });
  const eventFailures = targetPublished
    ? eventIntegrityFailures({ provider, events, sourceEvidence, targetYear, policy })
    : [];
  const reconstructionFailures = reconstructionIntegrityFailures({
    reconstructionEvidence,
    targetYear,
    policy
  });

  let status;
  let blocker;
  if (!targetPublished) {
    status = "outside-published-coverage";
    blocker = "published-data-product-coverage";
  } else if (sourceFailures.length) {
    status = "authoritative-source-integrity-failed";
    blocker = "authoritative-source-integrity";
  } else if (manifestFailures.length || eventFailures.length) {
    status = "runtime-data-product-integrity-failed";
    blocker = "runtime-data-product-integrity";
  } else if (reconstructionFailures.length) {
    status = "reconstruction-parity-incomplete";
    blocker = "production-shaped-reconstruction-parity";
  } else {
    status = "authoritative-data-product-pass";
    blocker = null;
  }

  const registrationEligible = targetPublished
    && sourceFailures.length === 0
    && manifestFailures.length === 0
    && eventFailures.length === 0
    && reconstructionFailures.length === 0;

  return Object.freeze({
    providerId:provider.id,
    targetYear,
    coverage,
    targetPublished,
    policy,
    status,
    blocker,
    sourceIntegrityFailures:Object.freeze(sourceFailures),
    manifestIntegrityFailures:Object.freeze(manifestFailures),
    eventIntegrityFailures:Object.freeze(eventFailures),
    reconstructionIntegrityFailures:Object.freeze(reconstructionFailures),
    registrationEligible,
    productionRegistrationEligible:registrationEligible,
    requiresProductionRegistryMutation:registrationEligible,
    note:"Passing this gate authorizes a separate bounded registry integration review only. It does not mutate the production seasonal-epoch registry or widen the data-product coverage."
  });
}
