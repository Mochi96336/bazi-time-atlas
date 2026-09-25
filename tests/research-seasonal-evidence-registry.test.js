import test from "node:test";
import assert from "node:assert/strict";
import {
  RESEARCH_SEASONAL_EVIDENCE_REGISTRY,
  clearResearchSeasonalEvidenceForTests,
  researchSeasonalEvidenceForLongitude
} from "../src/recurrence/research-seasonal-evidence-registry.js";
import {
  installResearchSeasonal10026Fixture
} from "./helpers/install-research-seasonal-10026.js";

test("research seasonal evidence registry is explicitly non-production and carries no static epoch payload", () => {
  assert.equal(RESEARCH_SEASONAL_EVIDENCE_REGISTRY.productionAuthorityGranted, false);
  assert.equal(
    RESEARCH_SEASONAL_EVIDENCE_REGISTRY.independentTargetYearTruthRequiredForProductionPromotion,
    true
  );
  assert.deepEqual(RESEARCH_SEASONAL_EVIDENCE_REGISTRY.evidenceIds, [
    "de441-10026-source-derived-seasonal-crossing-evidence-v1"
  ]);
  assert.equal(RESEARCH_SEASONAL_EVIDENCE_REGISTRY.staticEpochPayloadBundled, false);
  assert.equal(RESEARCH_SEASONAL_EVIDENCE_REGISTRY.runtimePayloadMode, "verified-lazy-binary-chunk");
});

test("year 10026 is unavailable until its verified binary chunk is installed", () => {
  clearResearchSeasonalEvidenceForTests();
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:315 }),
    null
  );
});

test("year 10026 Li Chun resolves from the installed source-derived DE441 chunk", async () => {
  const { manifest } = await installResearchSeasonal10026Fixture();
  const event = researchSeasonalEvidenceForLongitude({
    year:10026,
    longitudeDegrees:315
  });

  assert.equal(event.name, "立春");
  assert.equal(event.sourceEphemeris, "DE441");
  assert.equal(event.timeScale, "TT");
  assert.equal(event.ttJulianDay, 5383013.532143416);
  assert.equal(event.validationKind, "source-derived-reconstruction");
  assert.equal(event.independentTargetYearTruth, false);
  assert.equal(event.sourceDerivedTargetYear, true);
  assert.equal(event.productionIntegrated, false);
  assert.equal(event.productionAuthorityGranted, false);
  assert.equal(event.civilTimeResolved, false);
  assert.equal(event.runtimePayloadId, manifest.id);
  assert.equal(event.runtimePayloadSha256, manifest.payloadSha256);
});

test("research registry does not widen the installed evidence beyond its catalogue year", async () => {
  await installResearchSeasonal10026Fixture();
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10025, longitudeDegrees:315 }),
    null
  );
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10027, longitudeDegrees:315 }),
    null
  );
});

test("research registry only returns canonical seasonal longitudes", async () => {
  await installResearchSeasonal10026Fixture();
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:314.5 }),
    null
  );
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:360 }).name,
    "春分"
  );
});
