import test from "node:test";
import assert from "node:assert/strict";
import { seasonalEventsForCatalogueYear } from "../src/astronomy/de441-seasonal-event-data-product.js";
import { DEEP_TIME_EARTH_ROTATION_EVIDENCE } from "../src/astronomy/deep-time-earth-rotation-evidence.js";
import {
  DEEP_TIME_EARTH_ROTATION_MODEL,
  deepTimeEarthRotationEstimateSupportsYear,
  estimateDeepTimeUt1FromTtJulianDay,
  futureDeltaTOneSigmaSeconds,
  longTermDeltaTPointEstimateSeconds,
  prolepticGregorianDecimalYearAtJulianDay
} from "../src/astronomy/deep-time-earth-rotation.js";

const SECONDS_PER_DAY = 86_400;

test("evidence separates a long-term Delta T estimate from deterministic Earth rotation", () => {
  const evidence = DEEP_TIME_EARTH_ROTATION_EVIDENCE;
  assert.equal(evidence.observable, "delta-t-tt-minus-ut1");
  assert.equal(evidence.inputTimeScale, "TT");
  assert.equal(evidence.outputTimeScale, "UT1");
  assert.equal(evidence.futureUncertainty.nasaTable4000SigmaSeconds, 6068);
  assert.equal(evidence.futureUncertainty.semantics, "one-standard-error-not-hard-bound");
  assert.equal(evidence.operationalPrediction.maximumPredictionHorizonDays, 365);
  assert.equal(evidence.operationalPrediction.deepTimeCoverage, false);
  assert.equal(evidence.promotionBoundary.ttToUt1PointEstimateAvailable, true);
  assert.equal(evidence.promotionBoundary.deepTimeUncertaintyQuantified, true);
  assert.equal(evidence.promotionBoundary.deterministicUt1Validated, false);
  assert.equal(evidence.promotionBoundary.utcFuturePolicyKnown, false);
  assert.equal(evidence.promotionBoundary.deterministicCivilTimeValidated, false);
  assert.equal(evidence.promotionBoundary.dayPillarUniquenessValidated, false);
  assert.equal(evidence.promotionBoundary.hourPillarUniquenessValidated, false);
});

test("coverage helper exposes only the long-term extrapolation domain", () => {
  assert.equal(deepTimeEarthRotationEstimateSupportsYear(2150), false);
  assert.equal(deepTimeEarthRotationEstimateSupportsYear(2151), true);
  assert.equal(deepTimeEarthRotationEstimateSupportsYear(4006), true);
  assert.equal(deepTimeEarthRotationEstimateSupportsYear(26026), true);
  assert.equal(deepTimeEarthRotationEstimateSupportsYear(4006.5), false);
  assert.equal(deepTimeEarthRotationEstimateSupportsYear(Number.NaN), false);
});

test("NASA long-term parabola reproduces the published year-4000 point estimate", () => {
  assert.ok(Math.abs(longTermDeltaTPointEstimateSeconds(4000) - 15187.68) < 1e-9);
});

test("Huber future uncertainty expression reproduces NASA's rounded year-4000 table", () => {
  const sigma = futureDeltaTOneSigmaSeconds(4000);
  assert.ok(Math.abs(sigma - 6068.100818466952) < 1e-9);
  assert.equal(Math.round(sigma), DEEP_TIME_EARTH_ROTATION_EVIDENCE.futureUncertainty.nasaTable4000SigmaSeconds);
});

test("Julian-day calendar coordinate is explicit and independent from future UTC policy", () => {
  const j2000DecimalYear = prolepticGregorianDecimalYearAtJulianDay(2451545.0);
  assert.ok(Math.abs(j2000DecimalYear - (2000 + 0.5 / 366)) < 1e-12);
});

test("all 24 production year-4006 seasonal TT epochs get an uncertain UT1 estimate, not an exact civil timestamp", () => {
  const estimates = seasonalEventsForCatalogueYear(4006).map(event =>
    estimateDeepTimeUt1FromTtJulianDay(event.ttJulianDay)
  );

  assert.equal(estimates.length, 24);
  assert.ok(estimates.some(result => Math.floor(result.decimalYear) === 4005),
    "catalogue 4006 must preserve the previous-December winter-solstice event");
  assert.ok(estimates.some(result => Math.floor(result.decimalYear) === 4006));

  for (const result of estimates) {
    assert.equal(result.evidenceId, DEEP_TIME_EARTH_ROTATION_EVIDENCE.id);
    assert.equal(result.inputTimeScale, "TT");
    assert.equal(result.outputTimeScale, "UT1");
    assert.ok(result.deltaTSecondsEstimate > 15_000);
    assert.ok(result.deltaTSecondsEstimate < 15_300);
    assert.ok(result.oneSigmaUncertaintySeconds > 6_000);
    assert.equal(result.extrapolated, true);
    assert.equal(result.pointEstimateAvailable, true);
    assert.equal(result.uncertaintyQuantified, true);
    assert.equal(result.deterministicUt1, false);
    assert.equal(result.utcResolved, false);
    assert.equal(result.civilTimeResolved, false);
    assert.equal(result.deterministicDayHourBridge, false);
    assert.ok(result.oneSigmaUt1JulianDayMin < result.ut1JulianDayEstimate);
    assert.ok(result.ut1JulianDayEstimate < result.oneSigmaUt1JulianDayMax);
    const intervalSpanSeconds = (result.oneSigmaUt1JulianDayMax - result.oneSigmaUt1JulianDayMin) * SECONDS_PER_DAY;
    assert.ok(Math.abs(intervalSpanSeconds - 2 * result.oneSigmaUncertaintySeconds) < 0.0001);
  }
});

test("the Earth-rotation model refuses to masquerade as modern or exact timekeeping", () => {
  assert.equal(DEEP_TIME_EARTH_ROTATION_MODEL.deterministic, false);
  assert.equal(DEEP_TIME_EARTH_ROTATION_MODEL.resolvesUtc, false);
  assert.equal(DEEP_TIME_EARTH_ROTATION_MODEL.resolvesCivilTime, false);
  assert.throws(() => longTermDeltaTPointEstimateSeconds(2100), /decimalYear > 2150/);
  assert.throws(() => futureDeltaTOneSigmaSeconds(1900), /decimalYear >= 2005/);
  assert.throws(() => estimateDeepTimeUt1FromTtJulianDay(Number.NaN), /ttJulianDay must be finite/);
});
