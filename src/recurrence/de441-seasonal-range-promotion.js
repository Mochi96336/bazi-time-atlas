import {
  DE441_SEASONAL_CHUNK_FORMAT,
  de441SeasonalChunkByteLength
} from "../astronomy/de441-seasonal-event-chunk.js";

const REQUIRED_REFERENCE_SEMANTICS =
  "geocentric-apparent-solar-longitude-mean-ecliptic-of-date";

export const DE441_SEASONAL_RANGE_PROMOTION_POLICY = Object.freeze({
  sourceEphemeris:"DE441",
  timeScale:"TT",
  referenceSemantics:REQUIRED_REFERENCE_SEMANTICS,
  chunkEncoding:DE441_SEASONAL_CHUNK_FORMAT.id,
  chunkSchemaVersion:DE441_SEASONAL_CHUNK_FORMAT.schemaVersion,
  eventsPerYear:DE441_SEASONAL_CHUNK_FORMAT.eventsPerYear,
  maximumChunkYears:1000,
  interiorSelectionMethod:"seeded-random-interior",
  minimumInteriorSamples:3,
  maximumInteriorSamples:16,
  requiredValidationFlags:Object.freeze([
    "sourceAuthenticityVerified",
    "frameAndTimeScaleValidated",
    "solverParityValidated",
    "crossingResidualsValidated",
    "independentImplementationValidated",
    "independentTargetYearTruth"
  ])
});

function assertInteger(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function validSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function coverageContains(coverage, minYear, maxYear) {
  return coverage
    && Number.isInteger(coverage.minYear)
    && Number.isInteger(coverage.maxYear)
    && minYear >= coverage.minYear
    && maxYear <= coverage.maxYear;
}

export function requiredDe441InteriorValidationCount(minYear, maxYear, policy = DE441_SEASONAL_RANGE_PROMOTION_POLICY) {
  assertInteger(minYear, "minYear");
  assertInteger(maxYear, "maxYear");
  if (maxYear < minYear) throw new RangeError("maxYear must be >= minYear");
  const yearCount = maxYear - minYear + 1;
  if (yearCount <= 2) return 0;
  const availableInteriorYears = yearCount - 2;
  return Math.min(
    availableInteriorYears,
    policy.maximumInteriorSamples,
    Math.max(policy.minimumInteriorSamples, Math.ceil(Math.log2(yearCount)))
  );
}

function seedState(seedSha256) {
  if (!validSha256(seedSha256)) {
    throw new RangeError("seedSha256 must be a 64-character hexadecimal SHA-256 value");
  }
  let state = Number.parseInt(seedSha256.slice(0,8), 16) >>> 0;
  state ^= Number.parseInt(seedSha256.slice(8,16), 16) >>> 0;
  state ^= Number.parseInt(seedSha256.slice(16,24), 16) >>> 0;
  state ^= Number.parseInt(seedSha256.slice(24,32), 16) >>> 0;
  return state === 0 ? 0x9e3779b9 : state;
}

function nextXorshift32(state) {
  let value = state >>> 0;
  value ^= (value << 13) >>> 0;
  value ^= value >>> 17;
  value ^= (value << 5) >>> 0;
  return value >>> 0;
}

export function deriveDe441InteriorValidationYears({
  minYear,
  maxYear,
  seedSha256,
  policy = DE441_SEASONAL_RANGE_PROMOTION_POLICY
}) {
  const count = requiredDe441InteriorValidationCount(minYear, maxYear, policy);
  if (count === 0) return Object.freeze([]);
  const interiorSpan = maxYear - minYear - 1;
  let state = seedState(seedSha256);
  const selected = new Set();

  while (selected.size < count) {
    state = nextXorshift32(state);
    selected.add(minYear + 1 + (state % interiorSpan));
  }
  return Object.freeze([...selected].sort((a,b) => a-b));
}

function validateChunks({ chunks, minYear, maxYear, policy }) {
  const failures = [];
  if (!Array.isArray(chunks) || chunks.length < 1) return ["chunks-missing"];

  const sorted = [...chunks].sort((left, right) => left.minYear - right.minYear);
  let expectedYear = minYear;
  for (const chunk of sorted) {
    if (!chunk || typeof chunk !== "object") {
      failures.push("chunk-shape");
      continue;
    }
    const span = chunk.maxYear - chunk.minYear + 1;
    if (!Number.isInteger(chunk.minYear) || !Number.isInteger(chunk.maxYear) || span < 1) {
      failures.push(`chunk-range:${chunk?.id ?? "unknown"}`);
      continue;
    }
    if (chunk.minYear !== expectedYear) failures.push(`chunk-continuity:${chunk.id ?? chunk.minYear}`);
    if (span > policy.maximumChunkYears) failures.push(`chunk-span:${chunk.id ?? chunk.minYear}`);
    if (chunk.encoding !== policy.chunkEncoding) failures.push(`chunk-encoding:${chunk.id ?? chunk.minYear}`);
    if (chunk.schemaVersion !== policy.chunkSchemaVersion) failures.push(`chunk-schema:${chunk.id ?? chunk.minYear}`);
    if (chunk.sourceEphemeris !== policy.sourceEphemeris) failures.push(`chunk-source:${chunk.id ?? chunk.minYear}`);
    if (chunk.timeScale !== policy.timeScale) failures.push(`chunk-time-scale:${chunk.id ?? chunk.minYear}`);
    if (chunk.referenceSemantics !== policy.referenceSemantics) {
      failures.push(`chunk-reference-semantics:${chunk.id ?? chunk.minYear}`);
    }
    if (!validSha256(chunk.payloadSha256)) failures.push(`chunk-sha256:${chunk.id ?? chunk.minYear}`);
    if (chunk.byteLength !== de441SeasonalChunkByteLength(span)) {
      failures.push(`chunk-byte-length:${chunk.id ?? chunk.minYear}`);
    }
    if (!Array.isArray(chunk.evidenceIds) || chunk.evidenceIds.length < 1) {
      failures.push(`chunk-evidence:${chunk.id ?? chunk.minYear}`);
    }
    expectedYear = chunk.maxYear + 1;
  }
  if (sorted[0]?.minYear !== minYear) failures.push("range-start-not-covered");
  if (sorted.at(-1)?.maxYear !== maxYear) failures.push("range-end-not-covered");
  if (expectedYear !== maxYear + 1) failures.push("range-not-contiguous");
  return failures;
}

function requiredValidationYears({ minYear, maxYear, validationPlan, policy }) {
  const required = new Set([minYear, maxYear]);
  const interiorCount = requiredDe441InteriorValidationCount(minYear, maxYear, policy);
  if (interiorCount === 0) {
    return { required, failures:[] };
  }

  const failures = [];
  if (!validationPlan || validationPlan.selectionMethod !== policy.interiorSelectionMethod) {
    failures.push("interior-selection-method");
    return { required, failures };
  }
  if (!validSha256(validationPlan.seedSha256)) {
    failures.push("interior-selection-seed");
    return { required, failures };
  }
  if (!Array.isArray(validationPlan.interiorYears)) {
    failures.push("interior-years-missing");
    return { required, failures };
  }

  const unique = [...new Set(validationPlan.interiorYears)].sort((a,b) => a-b);
  if (unique.length !== interiorCount) failures.push("interior-sample-count");
  for (const year of unique) {
    if (!Number.isInteger(year) || year <= minYear || year >= maxYear) {
      failures.push(`interior-year-outside-range:${year}`);
    }
  }

  const derived = deriveDe441InteriorValidationYears({
    minYear,
    maxYear,
    seedSha256:validationPlan.seedSha256,
    policy
  });
  if (
    unique.length !== derived.length
    || unique.some((year,index) => year !== derived[index])
  ) {
    failures.push("interior-years-seed-mismatch");
  }
  derived.forEach(year => required.add(year));
  return { required, failures };
}

function validationSampleFailures(sample, policy) {
  const failures = [];
  if (!sample || typeof sample !== "object") return ["sample-shape"];
  if (sample.sourceEphemeris !== policy.sourceEphemeris) failures.push("source-ephemeris");
  if (sample.timeScale !== policy.timeScale) failures.push("time-scale");
  if (sample.referenceSemantics !== policy.referenceSemantics) failures.push("reference-semantics");
  if (sample.canonicalCrossings !== policy.eventsPerYear) failures.push("canonical-crossings");
  for (const flag of policy.requiredValidationFlags) {
    if (sample[flag] !== true) failures.push(flag);
  }
  return failures;
}

/**
 * Assess whether a compact DE441-derived seasonal-event range may advance from
 * Research loading to a separate production publication review.
 *
 * Structural chunk validity is intentionally weaker than production promotion:
 * source-derived chunks may be loaded by Research while independent target-era
 * validation is still incomplete. Passing this function never mutates the
 * production provider registry.
 */
export function assessDe441SeasonalRangePromotion({
  minYear,
  maxYear,
  sourceCoverage,
  chunks,
  validationPlan = null,
  validationSamples = [],
  policy = DE441_SEASONAL_RANGE_PROMOTION_POLICY
}) {
  assertInteger(minYear, "minYear");
  assertInteger(maxYear, "maxYear");
  if (maxYear < minYear) throw new RangeError("maxYear must be >= minYear");
  if (!Array.isArray(validationSamples)) throw new TypeError("validationSamples must be an array");

  const sourceCoversRange = coverageContains(sourceCoverage, minYear, maxYear);
  const chunkFailures = validateChunks({ chunks, minYear, maxYear, policy });
  const researchLoadEligible = sourceCoversRange && chunkFailures.length === 0;

  const { required, failures:planFailures } = requiredValidationYears({
    minYear,
    maxYear,
    validationPlan,
    policy
  });
  const samplesByYear = new Map(
    validationSamples
      .filter(sample => Number.isInteger(sample?.year))
      .map(sample => [sample.year, sample])
  );
  const validationFailures = [...planFailures];
  const sampleAssessments = [];

  for (const year of required) {
    const sample = samplesByYear.get(year);
    if (!sample) {
      validationFailures.push(`validation-year-missing:${year}`);
      continue;
    }
    const failures = validationSampleFailures(sample, policy);
    sampleAssessments.push(Object.freeze({
      year,
      failures:Object.freeze(failures)
    }));
    failures.forEach(failure => validationFailures.push(`${year}:${failure}`));
  }

  let status;
  let blocker;
  if (!sourceCoversRange) {
    status = "outside-source-coverage";
    blocker = "source-ephemeris-coverage";
  } else if (chunkFailures.length) {
    status = "chunk-contract-failed";
    blocker = "compact-data-integrity";
  } else if (planFailures.length) {
    status = "validation-plan-incomplete";
    blocker = "range-validation-plan";
  } else if (validationFailures.length) {
    status = "independent-validation-incomplete";
    blocker = "independent-target-era-validation";
  } else {
    status = "range-promotion-pass";
    blocker = null;
  }

  const productionPromotionEligible =
    researchLoadEligible
    && planFailures.length === 0
    && validationFailures.length === 0;

  return Object.freeze({
    minYear,
    maxYear,
    yearCount:maxYear - minYear + 1,
    sourceCoverage:Object.freeze({ ...sourceCoverage }),
    sourceCoversRange,
    policy,
    status,
    blocker,
    researchLoadEligible,
    productionPromotionEligible,
    requiresSeparateProductionRegistryMutation:productionPromotionEligible,
    requiredValidationYears:Object.freeze([...required].sort((a,b) => a-b)),
    chunkFailures:Object.freeze(chunkFailures),
    validationPlanFailures:Object.freeze(planFailures),
    validationFailures:Object.freeze(validationFailures),
    validationSampleAssessments:Object.freeze(sampleAssessments),
    note:"Research-load eligibility proves only compact DE441-derived data integrity inside source coverage. Production promotion additionally requires independent target-era validation at both edges and the seeded interior sample plan, and still needs a separate runtime-registry review."
  });
}
