import test from "node:test";
import assert from "node:assert/strict";
import { TYME_SHOUXING_DIRECT_PROVIDER } from "../src/astronomy/direct-seasonal-event-provider.js";
import {
  DIRECT_SEASONAL_PROMOTION_POLICY,
  DIRECT_SEASONAL_VALIDATION_KINDS,
  JPL_HORIZONS_SEASONAL_REFERENCE,
  SHOUXING_PIPELINE_PROOF_EVIDENCE,
  assessDirectSeasonalProviderPromotion
} from "../src/recurrence/direct-seasonal-provider-promotion.js";
import {
  JPL_DE441_SHOUXING_2026_CROSSCHECK,
  JPL_DE441_SHOUXING_4006_CROSSCHECK
} from "../src/recurrence/direct-seasonal-provider-validation-evidence.js";
import {
  SEASONAL_EPOCH_PIPELINE,
  SEASONAL_EPOCH_SOURCES,
  seasonalEpochSourceAudit
} from "../src/recurrence/seasonal-epoch-source-audit.js";

function jplEvidence(overrides = {}) {
  return {
    id:"jpl-horizons-4006-24-term",
    providerId:TYME_SHOUXING_DIRECT_PROVIDER.id,
    kind:DIRECT_SEASONAL_VALIDATION_KINDS.INDEPENDENT_EPHEMERIS,
    referenceFamily:JPL_HORIZONS_SEASONAL_REFERENCE.family,
    referenceSemantics:JPL_HORIZONS_SEASONAL_REFERENCE.referenceSemantics,
    timeScale:"TT",
    sampledYears:[4006],
    samplesByYear:{ 4006:24 },
    maxEpochErrorSeconds:1.5,
    authority:"pinned NASA/JPL Horizons output",
    ...overrides
  };
}

test("direct provider declares its model family without widening validated coverage", () => {
  assert.equal(TYME_SHOUXING_DIRECT_PROVIDER.modelFamily, "shouxing");
  assert.deepEqual(TYME_SHOUXING_DIRECT_PROVIDER.coverage, {
    mode:"absolute-year",
    minYear:1900,
    maxYear:2100
  });
});

test("JPL reference contract pins the exact Earth-season observable", () => {
  assert.equal(JPL_HORIZONS_SEASONAL_REFERENCE.authority, "NASA/JPL Horizons");
  assert.equal(JPL_HORIZONS_SEASONAL_REFERENCE.target, "Sun");
  assert.equal(JPL_HORIZONS_SEASONAL_REFERENCE.observerCenter, "Earth geocenter");
  assert.equal(JPL_HORIZONS_SEASONAL_REFERENCE.referenceSemantics,
    "geocentric-apparent-solar-longitude-mean-ecliptic-of-date");
  assert.equal(JPL_HORIZONS_SEASONAL_REFERENCE.timeScale, "TT");
  assert.equal(JPL_HORIZONS_SEASONAL_REFERENCE.status, "reference-contract-only");
});

test("the 2026 same-model proof cannot justify a 4006 coverage extension", () => {
  const result = assessDirectSeasonalProviderPromotion({
    provider:TYME_SHOUXING_DIRECT_PROVIDER,
    targetYear:4006,
    evidence:SHOUXING_PIPELINE_PROOF_EVIDENCE
  });

  assert.equal(result.targetAlreadyDeclared, false);
  assert.equal(result.status, "independent-validation-missing");
  assert.equal(result.blocker, "independent-target-year-validation");
  assert.deepEqual(result.sameModelEvidenceYears, [2026]);
  assert.deepEqual(result.targetEvidenceIds, []);
  assert.deepEqual(result.independentTargetEvidenceCandidateIds, []);
  assert.deepEqual(result.independentTargetEvidenceIds, []);
  assert.deepEqual(result.rejectedIndependentTargetEvidenceIds, []);
  assert.equal(result.coverageExtensionEligible, false);
  assert.equal(result.productionPromotionEligible, false);
});

test("even 24 same-model 4006 crossings remain insufficient for promotion", () => {
  const sameModel4006 = {
    ...SHOUXING_PIPELINE_PROOF_EVIDENCE[0],
    id:"shouxing-4006-self-check",
    sampledYears:[4006],
    samplesByYear:{ 4006:24 },
    maxEpochErrorSeconds:0.001
  };
  const result = assessDirectSeasonalProviderPromotion({
    provider:TYME_SHOUXING_DIRECT_PROVIDER,
    targetYear:4006,
    evidence:[sameModel4006]
  });

  assert.equal(result.status, "same-model-evidence-only");
  assert.deepEqual(result.targetEvidenceIds, ["shouxing-4006-self-check"]);
  assert.deepEqual(result.independentTargetEvidenceCandidateIds, []);
  assert.deepEqual(result.independentTargetEvidenceIds, []);
  assert.equal(result.coverageExtensionEligible, false);
});

test("24 independent target-year crossings within the error budget make coverage extension eligible", () => {
  const result = assessDirectSeasonalProviderPromotion({
    provider:TYME_SHOUXING_DIRECT_PROVIDER,
    targetYear:4006,
    evidence:[jplEvidence()]
  });

  assert.equal(result.status, "independent-validation-pass");
  assert.equal(result.blocker, null);
  assert.deepEqual(result.independentTargetEvidenceCandidateIds, ["jpl-horizons-4006-24-term"]);
  assert.deepEqual(result.independentTargetEvidenceIds, ["jpl-horizons-4006-24-term"]);
  assert.deepEqual(result.rejectedIndependentTargetEvidenceIds, []);
  assert.equal(result.coverageExtensionEligible, true);
  assert.equal(result.productionPromotionEligible, false);
  assert.equal(result.requiresCoverageMetadataUpdate, true);
});

test("pinned 2026 DE441 control stays near the modern ShouXing solution", () => {
  const evidence = JPL_DE441_SHOUXING_2026_CROSSCHECK;
  assert.equal(evidence.sourceEphemeris, "DE441");
  assert.equal(evidence.terms.length, 24);
  assert.equal(evidence.samplesByYear[2026], 24);
  assert.ok(evidence.meanAbsEpochErrorSeconds < 1.1);
  assert.ok(evidence.maxEpochErrorSeconds < 2.5);
  assert.equal(Math.max(...evidence.terms.map(term => Math.abs(term.epochErrorSeconds))),
    evidence.maxEpochErrorSeconds);
});

test("pinned 4006 DE441 evidence explicitly rejects a ShouXing coverage extension", () => {
  const evidence = JPL_DE441_SHOUXING_4006_CROSSCHECK;
  assert.equal(evidence.sourceEphemeris, "DE441");
  assert.equal(evidence.terms.length, 24);
  assert.equal(evidence.samplesByYear[4006], 24);
  assert.ok(evidence.meanAbsEpochErrorSeconds > 250);
  assert.equal(evidence.maxEpochErrorSeconds, 270.174636);
  assert.ok(evidence.meanAbsEpochErrorSeconds
    > JPL_DE441_SHOUXING_2026_CROSSCHECK.meanAbsEpochErrorSeconds * 250);

  const result = assessDirectSeasonalProviderPromotion({
    provider:TYME_SHOUXING_DIRECT_PROVIDER,
    targetYear:4006,
    evidence:[evidence]
  });

  assert.equal(result.status, "independent-validation-failed");
  assert.equal(result.blocker, "epoch-error-budget");
  assert.deepEqual(result.independentTargetEvidenceCandidateIds, [evidence.id]);
  assert.deepEqual(result.independentTargetEvidenceIds, []);
  assert.deepEqual(result.rejectedIndependentTargetEvidenceIds, [evidence.id]);
  assert.equal(result.coverageExtensionEligible, false);
  assert.equal(result.productionPromotionEligible, false);
  assert.equal(result.requiresCoverageMetadataUpdate, false);
});

test("wrong observable and too few crossings are not independent target-year candidates", () => {
  const cases = [
    jplEvidence({
      id:"wrong-semantics",
      referenceSemantics:"geometric-heliocentric-longitude"
    }),
    jplEvidence({
      id:"too-few-samples",
      samplesByYear:{ 4006:DIRECT_SEASONAL_PROMOTION_POLICY.minimumSamplesAtTargetYear - 1 }
    })
  ];

  for (const evidence of cases) {
    const result = assessDirectSeasonalProviderPromotion({
      provider:TYME_SHOUXING_DIRECT_PROVIDER,
      targetYear:4006,
      evidence:[evidence]
    });
    assert.equal(result.status, "independent-validation-missing", evidence.id);
    assert.equal(result.coverageExtensionEligible, false, evidence.id);
    assert.equal(result.blocker, "independent-target-year-validation", evidence.id);
  }
});

test("independent evidence over the epoch budget is present but fails promotion", () => {
  const evidence = jplEvidence({
    id:"too-large-error",
    maxEpochErrorSeconds:DIRECT_SEASONAL_PROMOTION_POLICY.maxEpochErrorSeconds + 0.001
  });
  const result = assessDirectSeasonalProviderPromotion({
    provider:TYME_SHOUXING_DIRECT_PROVIDER,
    targetYear:4006,
    evidence:[evidence]
  });

  assert.equal(result.status, "independent-validation-failed");
  assert.equal(result.blocker, "epoch-error-budget");
  assert.deepEqual(result.independentTargetEvidenceCandidateIds, [evidence.id]);
  assert.deepEqual(result.rejectedIndependentTargetEvidenceIds, [evidence.id]);
  assert.equal(result.coverageExtensionEligible, false);
});

test("failed independent validation does not silently mutate production source or pipeline registries", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(SEASONAL_EPOCH_SOURCES.some(item => item.id === TYME_SHOUXING_DIRECT_PROVIDER.id), false);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.directEventProviderIds, []);
  assert.equal(result.status, "qualified-ephemeris-basis-not-integrated");
  assert.deepEqual(result.qualifiedStateBasisSourceIds, ["jpl-de441"]);
  assert.deepEqual(result.qualifiedDirectEventSourceIds, []);
  assert.equal(result.absoluteSeasonalEpochAvailable, false);
});
