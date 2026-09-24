import test from "node:test";
import assert from "node:assert/strict";
import {
  RESEARCH_SEASONAL_EVIDENCE_REGISTRY,
  researchSeasonalEvidenceForLongitude
} from "../src/recurrence/research-seasonal-evidence-registry.js";

test("research seasonal evidence registry is explicitly non-production", () => {
  assert.equal(RESEARCH_SEASONAL_EVIDENCE_REGISTRY.productionAuthorityGranted, false);
  assert.equal(
    RESEARCH_SEASONAL_EVIDENCE_REGISTRY.independentTargetYearTruthRequiredForProductionPromotion,
    true
  );
  assert.deepEqual(RESEARCH_SEASONAL_EVIDENCE_REGISTRY.evidenceIds, [
    "de441-10026-source-derived-seasonal-crossing-evidence-v1"
  ]);
});

test("year 10026 Li Chun resolves from the pinned source-derived DE441 evidence", () => {
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
});

test("research registry does not widen the pinned evidence beyond its catalogue year", () => {
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10025, longitudeDegrees:315 }),
    null
  );
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10027, longitudeDegrees:315 }),
    null
  );
});

test("research registry only returns pinned canonical seasonal longitudes", () => {
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:314.5 }),
    null
  );
  assert.equal(
    researchSeasonalEvidenceForLongitude({ year:10026, longitudeDegrees:360 }).name,
    "春分"
  );
});
