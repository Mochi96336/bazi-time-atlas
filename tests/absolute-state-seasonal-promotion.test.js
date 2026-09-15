import test from "node:test";
import assert from "node:assert/strict";
import { TYME_SHOUXING_DIRECT_PROVIDER } from "../src/astronomy/direct-seasonal-event-provider.js";
import { DE441_SEASONAL_EVENT_DATA_PROVIDER } from "../src/astronomy/de441-seasonal-event-data-product.js";
import { DE441_SEASONAL_CROSSING_4006_EVIDENCE } from "../src/astronomy/de441-seasonal-crossing-evidence.js";
import {
  ABSOLUTE_STATE_SEASONAL_PROMOTION_POLICY,
  assessAbsoluteStateSeasonalPromotion
} from "../src/recurrence/absolute-state-seasonal-promotion.js";
import {
  SEASONAL_EPOCH_PIPELINE,
  SEASONAL_EPOCH_SOURCES,
  seasonalEpochSourceAudit
} from "../src/recurrence/seasonal-epoch-source-audit.js";

const DE441_PROVIDER = SEASONAL_EPOCH_SOURCES.find(item => item.id === "jpl-de441");
const DE441_EVENT_PROVIDER_ID = DE441_SEASONAL_EVENT_DATA_PROVIDER.id;

function assess(evidence = [DE441_SEASONAL_CROSSING_4006_EVIDENCE], targetYear = 4006) {
  return assessAbsoluteStateSeasonalPromotion({
    provider:DE441_PROVIDER,
    targetYear,
    evidence
  });
}

function evidenceVariant(overrides = {}) {
  return Object.freeze({
    ...DE441_SEASONAL_CROSSING_4006_EVIDENCE,
    id:overrides.id ?? "de441-4006-test-variant",
    ...overrides
  });
}

test("year-4006 DE441 reconstruction passes the science gate but not absolute-state production integration", () => {
  const result = assess();
  assert.equal(result.status, "authoritative-reconstruction-pass");
  assert.equal(result.blocker, null);
  assert.equal(result.sourceCoversTarget, true);
  assert.deepEqual(result.passingEvidenceIds, [DE441_SEASONAL_CROSSING_4006_EVIDENCE.id]);
  assert.equal(result.integrationEligible, true);
  assert.equal(result.requiresProductionIntegration, true);
  assert.equal(result.productionPromotionEligible, false);
  assert.equal(result.policy.maxEpochErrorSeconds, 2);
  assert.equal(result.policy.minimumSamplesAtTargetYear, 24);
});

test("promotion gate rejects target-year evidence over the epoch budget", () => {
  const overBudget = evidenceVariant({
    id:"de441-4006-over-budget",
    proofResult:Object.freeze({
      ...DE441_SEASONAL_CROSSING_4006_EVIDENCE.proofResult,
      maxEpochErrorSeconds:2.000001
    })
  });
  const result = assess([overBudget]);
  assert.equal(result.status, "authoritative-reconstruction-failed");
  assert.equal(result.blocker, "epoch-error-budget");
  assert.equal(result.integrationEligible, false);
});

test("promotion gate requires the Sun correction model and production-shaped solver parity", () => {
  const incomplete = evidenceVariant({
    id:"de441-4006-chain-incomplete",
    promotionBoundary:Object.freeze({
      ...DE441_SEASONAL_CROSSING_4006_EVIDENCE.promotionBoundary,
      sunCenterApparentCorrectionModelValidated:false,
      productionShapedSolverParityValidated:false
    })
  });
  const result = assess([incomplete]);
  assert.equal(result.status, "authoritative-reconstruction-incomplete");
  assert.equal(result.blocker, "scientific-chain-validation");
  assert.equal(result.integrationEligible, false);
  assert.deepEqual(
    result.candidateAssessments[0].missingPromotionBoundaryFlags,
    ["sunCenterApparentCorrectionModelValidated", "productionShapedSolverParityValidated"]
  );
});

test("promotion gate requires exact semantics and a full 24-crossing target sample", () => {
  const wrongSemantics = evidenceVariant({
    id:"de441-4006-wrong-semantics",
    referenceSemantics:"geometric-ecliptic-longitude"
  });
  assert.equal(assess([wrongSemantics]).status, "authoritative-reconstruction-missing");

  const undersampled = evidenceVariant({
    id:"de441-4006-undersampled",
    samplesByYear:Object.freeze({ 4006:23 })
  });
  assert.equal(assess([undersampled]).status, "authoritative-reconstruction-missing");
});

test("promotion gate cannot extend beyond the underlying DE441 source coverage", () => {
  const result = assess([], 26026);
  assert.equal(result.status, "outside-source-coverage");
  assert.equal(result.blocker, "source-ephemeris-coverage");
  assert.equal(result.integrationEligible, false);
});

test("absolute-state promotion assessment refuses a direct-event provider role", () => {
  assert.throws(
    () => assessAbsoluteStateSeasonalPromotion({
      provider:TYME_SHOUXING_DIRECT_PROVIDER,
      targetYear:4006,
      evidence:[DE441_SEASONAL_CROSSING_4006_EVIDENCE]
    }),
    /absolute-state-basis/
  );
});

test("passing state-basis science evidence remains separate from the bounded production direct-event runtime", () => {
  const promotion = assess();
  assert.equal(promotion.integrationEligible, true);

  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterRuntimeCoverageById, {});
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.directEventProviderIds, [DE441_EVENT_PROVIDER_ID]);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);

  const audit = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(audit.status, "resolved");
  assert.equal(audit.absoluteSeasonalEpochAvailable, true);
  assert.deepEqual(audit.usableSourceIds, [DE441_EVENT_PROVIDER_ID]);
});

test("promotion policy explicitly names all proof layers required before integration review", () => {
  assert.deepEqual(
    ABSOLUTE_STATE_SEASONAL_PROMOTION_POLICY.requiredPromotionBoundaryFlags,
    [
      "ttToTdbValidated",
      "de441StateInterpolationValidated",
      "lightTimeValidated",
      "stellarAberrationValidated",
      "sunCenterApparentIcrfValidated",
      "sunCenterApparentCorrectionModelValidated",
      "eclipticOfDateFrameValidated",
      "crossingRootSolveValidated",
      "productionShapedSolverParityValidated"
    ]
  );
});
