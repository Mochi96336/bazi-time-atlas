import test from "node:test";
import assert from "node:assert/strict";
import {
  DE441_SEASONAL_CHUNK_FORMAT,
  de441SeasonalChunkByteLength
} from "../src/astronomy/de441-seasonal-event-chunk.js";
import {
  DE441_SEASONAL_RANGE_PROMOTION_POLICY,
  assessDe441SeasonalRangePromotion,
  deriveDe441InteriorValidationYears,
  requiredDe441InteriorValidationCount
} from "../src/recurrence/de441-seasonal-range-promotion.js";

const SOURCE_COVERAGE = Object.freeze({ minYear:-13_200, maxYear:17_191 });
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function chunk(minYear, maxYear, overrides = {}) {
  return Object.freeze({
    id:`de441-seasonal-${minYear}-${maxYear}`,
    minYear,
    maxYear,
    encoding:DE441_SEASONAL_CHUNK_FORMAT.id,
    schemaVersion:DE441_SEASONAL_CHUNK_FORMAT.schemaVersion,
    sourceEphemeris:"DE441",
    timeScale:"TT",
    referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
    payloadSha256:overrides.payloadSha256 ?? SHA_A,
    payloadIntegrityVerified:overrides.payloadIntegrityVerified ?? true,
    byteLength:de441SeasonalChunkByteLength(maxYear - minYear + 1),
    evidenceIds:Object.freeze(overrides.evidenceIds ?? ["de441-derived-proof"]),
    ...overrides
  });
}

function validatedSample(year, overrides = {}) {
  return Object.freeze({
    year,
    sourceEphemeris:"DE441",
    timeScale:"TT",
    referenceSemantics:"geocentric-apparent-solar-longitude-mean-ecliptic-of-date",
    canonicalCrossings:24,
    sourceAuthenticityVerified:true,
    frameAndTimeScaleValidated:true,
    solverParityValidated:true,
    crossingResidualsValidated:true,
    independentImplementationValidated:true,
    independentTargetYearTruth:true,
    ...overrides
  });
}

test("single-year authoritative 4006 chunk can pass the range contract without implying registry mutation", () => {
  const result = assessDe441SeasonalRangePromotion({
    minYear:4006,
    maxYear:4006,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:[chunk(4006,4006)],
    validationSamples:[validatedSample(4006)]
  });

  assert.equal(result.status, "range-promotion-pass");
  assert.equal(result.researchLoadEligible, true);
  assert.equal(result.productionPromotionEligible, true);
  assert.equal(result.requiresSeparateProductionRegistryMutation, true);
  assert.deepEqual(result.requiredValidationYears, [4006]);
});

test("10026 source-derived data may be Research-load eligible while production promotion fails closed", () => {
  const result = assessDe441SeasonalRangePromotion({
    minYear:10026,
    maxYear:10026,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:[chunk(10026,10026,{
      payloadSha256:SHA_B,
      evidenceIds:["de441-10026-source-derived-seasonal-crossing-evidence-v1"]
    })],
    validationSamples:[validatedSample(10026,{
      independentTargetYearTruth:false,
      independentImplementationValidated:false
    })]
  });

  assert.equal(result.researchLoadEligible, true);
  assert.equal(result.productionPromotionEligible, false);
  assert.equal(result.status, "independent-validation-incomplete");
  assert.equal(result.blocker, "independent-target-era-validation");
  assert.ok(result.validationFailures.includes("10026:independentTargetYearTruth"));
  assert.ok(result.validationFailures.includes("10026:independentImplementationValidated"));
});

test("interior validation sampling consumes the full SHA-256 seed", () => {
  const prefix = "1".repeat(32);
  const first = deriveDe441InteriorValidationYears({
    minYear:4000,
    maxYear:4999,
    seedSha256:prefix + "2".repeat(32)
  });
  const second = deriveDe441InteriorValidationYears({
    minYear:4000,
    maxYear:4999,
    seedSha256:prefix + "3".repeat(32)
  });

  assert.notDeepEqual(first, second);
});

test("multi-year promotion requires both coverage edges plus a seeded interior validation plan", () => {
  const minYear = 4000;
  const maxYear = 4999;
  const requiredInterior = requiredDe441InteriorValidationCount(minYear, maxYear);
  assert.equal(requiredInterior, 10);

  const noPlan = assessDe441SeasonalRangePromotion({
    minYear,
    maxYear,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:[chunk(minYear,maxYear)],
    validationSamples:[validatedSample(minYear), validatedSample(maxYear)]
  });
  assert.equal(noPlan.status, "validation-plan-incomplete");
  assert.equal(noPlan.productionPromotionEligible, false);

  const seedSha256 = "c".repeat(64);
  const interiorYears = deriveDe441InteriorValidationYears({
    minYear,
    maxYear,
    seedSha256
  });
  assert.equal(interiorYears.length, requiredInterior);
  const withPlan = assessDe441SeasonalRangePromotion({
    minYear,
    maxYear,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:[chunk(minYear,maxYear)],
    validationPlan:{
      selectionMethod:DE441_SEASONAL_RANGE_PROMOTION_POLICY.interiorSelectionMethod,
      seedSha256,
      interiorYears
    },
    validationSamples:[
      validatedSample(minYear),
      ...interiorYears.map(validatedSample),
      validatedSample(maxYear)
    ]
  });
  assert.equal(withPlan.status, "range-promotion-pass");
  assert.equal(withPlan.productionPromotionEligible, true);
  assert.deepEqual(withPlan.requiredValidationYears, [minYear,...interiorYears,maxYear].sort((a,b)=>a-b));

  const tampered = assessDe441SeasonalRangePromotion({
    minYear,
    maxYear,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:[chunk(minYear,maxYear)],
    validationPlan:{
      selectionMethod:DE441_SEASONAL_RANGE_PROMOTION_POLICY.interiorSelectionMethod,
      seedSha256,
      interiorYears:[...interiorYears.slice(0,-1), interiorYears.at(-1) - 1]
    },
    validationSamples:[
      validatedSample(minYear),
      ...interiorYears.map(validatedSample),
      validatedSample(maxYear)
    ]
  });
  assert.equal(tampered.status, "validation-plan-incomplete");
  assert.ok(tampered.validationPlanFailures.includes("interior-years-seed-mismatch"));
});

test("full DE441-range promotion scales interior evidence instead of inheriting source coverage", () => {
  const required = requiredDe441InteriorValidationCount(-13_200,17_191);
  assert.equal(required, 15);
  const result = assessDe441SeasonalRangePromotion({
    minYear:-13_200,
    maxYear:17_191,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:Array.from({ length:31 }, (_, index) => {
      const min = -13_200 + index * 1000;
      const max = Math.min(17_191, min + 999);
      return chunk(min,max,{ payloadSha256:(index % 2 ? "d" : "e").repeat(64) });
    }),
    validationSamples:[validatedSample(-13_200), validatedSample(17_191)]
  });

  assert.equal(result.researchLoadEligible, true);
  assert.equal(result.productionPromotionEligible, false);
  assert.equal(result.status, "validation-plan-incomplete");
  assert.equal(result.blocker, "range-validation-plan");
});

test("Research-load eligibility requires the binary payload digest to have been verified", () => {
  const result = assessDe441SeasonalRangePromotion({
    minYear:10026,
    maxYear:10026,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:[chunk(10026,10026,{ payloadIntegrityVerified:false })],
    validationSamples:[]
  });

  assert.equal(result.researchLoadEligible, false);
  assert.equal(result.status, "chunk-contract-failed");
  assert.ok(result.chunkFailures.includes("chunk-payload-integrity:de441-seasonal-10026-10026"));
});

test("chunk gaps, oversized chunks and source-range overflow fail before promotion evidence is considered", () => {
  const gap = assessDe441SeasonalRangePromotion({
    minYear:4000,
    maxYear:6000,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:[chunk(4000,4999), chunk(5001,6000)],
    validationSamples:[]
  });
  assert.equal(gap.status, "chunk-contract-failed");
  assert.equal(gap.researchLoadEligible, false);

  const overflow = assessDe441SeasonalRangePromotion({
    minYear:17_190,
    maxYear:17_192,
    sourceCoverage:SOURCE_COVERAGE,
    chunks:[chunk(17_190,17_192)],
    validationSamples:[]
  });
  assert.equal(overflow.status, "outside-source-coverage");
  assert.equal(overflow.researchLoadEligible, false);
});
