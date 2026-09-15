import test from "node:test";
import assert from "node:assert/strict";
import {
  DE441_SEASONAL_EVENT_DATA_PRODUCT_MANIFEST,
  DE441_SEASONAL_EVENT_DATA_PROVIDER,
  DE441_SEASONAL_EVENT_SOURCE_EVIDENCE,
  seasonalEventsForCatalogueYear
} from "../src/astronomy/de441-seasonal-event-data-product.js";
import { DE441_SEASONAL_CROSSING_4006_EVIDENCE } from "../src/astronomy/de441-seasonal-crossing-evidence.js";
import {
  AUTHORITATIVE_SEASONAL_DATA_PRODUCT_REGISTRATION_POLICY,
  assessAuthoritativeSeasonalDataProductRegistration
} from "../src/recurrence/authoritative-seasonal-data-product-registration.js";
import {
  SEASONAL_EPOCH_PIPELINE,
  SEASONAL_EPOCH_SOURCES,
  seasonalEpochSourceAudit
} from "../src/recurrence/seasonal-epoch-source-audit.js";

function assess({
  provider = DE441_SEASONAL_EVENT_DATA_PROVIDER,
  manifest = DE441_SEASONAL_EVENT_DATA_PRODUCT_MANIFEST,
  sourceEvidence = DE441_SEASONAL_EVENT_SOURCE_EVIDENCE,
  reconstructionEvidence = DE441_SEASONAL_CROSSING_4006_EVIDENCE,
  events = seasonalEventsForCatalogueYear(4006),
  targetYear = 4006
} = {}) {
  return assessAuthoritativeSeasonalDataProductRegistration({
    provider,
    manifest,
    sourceEvidence,
    reconstructionEvidence,
    events,
    targetYear
  });
}

test("authoritative year-4006 DE441 seasonal-event product passes the registration gate", () => {
  const result = assess();
  assert.equal(result.status, "authoritative-data-product-pass");
  assert.equal(result.blocker, null);
  assert.equal(result.targetPublished, true);
  assert.deepEqual(result.sourceIntegrityFailures, []);
  assert.deepEqual(result.manifestIntegrityFailures, []);
  assert.deepEqual(result.eventIntegrityFailures, []);
  assert.deepEqual(result.reconstructionIntegrityFailures, []);
  assert.equal(result.registrationEligible, true);
  assert.equal(result.productionRegistrationEligible, true);
  assert.equal(result.requiresProductionRegistryMutation, true);
});

test("registration policy pins the quantity-31 semantics, TT, 24 crossings and two-second reconstruction budget", () => {
  const policy = AUTHORITATIVE_SEASONAL_DATA_PRODUCT_REGISTRATION_POLICY;
  assert.equal(policy.requiredValidationKind, "authoritative-source-pinning");
  assert.equal(policy.requiredReferenceSemantics, "geocentric-apparent-solar-longitude-mean-ecliptic-of-date");
  assert.equal(policy.requiredTimeScale, "TT");
  assert.equal(policy.requiredSourceEphemeris, "DE441");
  assert.equal(policy.requiredCrossings, 24);
  assert.equal(policy.longitudeStepDegrees, 15);
  assert.equal(policy.maxReconstructionEpochErrorSeconds, 2);
  assert.deepEqual(policy.requiredReconstructionBoundaryFlags, [
    "sunCenterApparentCorrectionModelValidated",
    "catalogueYear4006EndToEndValidated",
    "productionShapedSolverParityValidated"
  ]);
});

test("registration gate rejects damaged authoritative-source provenance", () => {
  const sourceEvidence = Object.freeze({
    ...DE441_SEASONAL_EVENT_SOURCE_EVIDENCE,
    sourceCaptureSha256:"not-a-sha256"
  });
  const result = assess({ sourceEvidence });
  assert.equal(result.status, "authoritative-source-integrity-failed");
  assert.equal(result.blocker, "authoritative-source-integrity");
  assert.deepEqual(result.sourceIntegrityFailures, ["source-capture-sha256"]);
  assert.equal(result.registrationEligible, false);
});

test("registration gate rejects manifest/provider provenance mismatches", () => {
  const manifest = Object.freeze({
    ...DE441_SEASONAL_EVENT_DATA_PRODUCT_MANIFEST,
    providerId:"other-provider",
    sourceEvidenceId:"other-evidence"
  });
  const result = assess({ manifest });
  assert.equal(result.status, "runtime-data-product-integrity-failed");
  assert.equal(result.blocker, "runtime-data-product-integrity");
  assert.deepEqual(result.manifestIntegrityFailures, ["provider-id", "source-evidence-id"]);
  assert.equal(result.registrationEligible, false);
});

test("registration gate rejects a runtime event payload that diverges from the pinned source", () => {
  const events = seasonalEventsForCatalogueYear(4006).map((event, index) =>
    index === 0
      ? Object.freeze({ ...event, ttJulianDay:event.ttJulianDay + 1 / 86400 })
      : event
  );
  const result = assess({ events });
  assert.equal(result.status, "runtime-data-product-integrity-failed");
  assert.equal(result.blocker, "runtime-data-product-integrity");
  assert.ok(result.eventIntegrityFailures.some(item => item.startsWith("source-payload:")));
  assert.equal(result.registrationEligible, false);
});

test("registration gate rejects incomplete or over-budget production-shaped reconstruction evidence", () => {
  const reconstructionEvidence = Object.freeze({
    ...DE441_SEASONAL_CROSSING_4006_EVIDENCE,
    proofResult:Object.freeze({
      ...DE441_SEASONAL_CROSSING_4006_EVIDENCE.proofResult,
      maxEpochErrorSeconds:2.000001
    }),
    promotionBoundary:Object.freeze({
      ...DE441_SEASONAL_CROSSING_4006_EVIDENCE.promotionBoundary,
      productionShapedSolverParityValidated:false
    })
  });
  const result = assess({ reconstructionEvidence });
  assert.equal(result.status, "reconstruction-parity-incomplete");
  assert.equal(result.blocker, "production-shaped-reconstruction-parity");
  assert.ok(result.reconstructionIntegrityFailures.includes("epoch-error-budget"));
  assert.ok(result.reconstructionIntegrityFailures.includes("boundary:productionShapedSolverParityValidated"));
  assert.equal(result.registrationEligible, false);
});

test("registration gate cannot widen the published data-product coverage", () => {
  const result = assess({ targetYear:4005, events:[] });
  assert.equal(result.status, "outside-published-coverage");
  assert.equal(result.blocker, "published-data-product-coverage");
  assert.equal(result.targetPublished, false);
  assert.equal(result.registrationEligible, false);
});

test("passing registration evidence still leaves the production seasonal registry fail-closed", () => {
  const result = assess();
  assert.equal(result.registrationEligible, true);

  const providerId = DE441_SEASONAL_EVENT_DATA_PROVIDER.id;
  assert.equal(SEASONAL_EPOCH_SOURCES.some(source => source.id === providerId), false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.directEventProviderIds.includes(providerId), false);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterRuntimeCoverageById, {});

  const audit = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(audit.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(audit.absoluteSeasonalEpochAvailable, false);
  assert.deepEqual(audit.usableSourceIds, []);
});
