import test from "node:test";
import assert from "node:assert/strict";
import {
  NAIF_SPICE_TT_TDB_MODEL,
  tdbMinusTtSecondsAtTtJulianDay,
  ttJulianDayToTdbJulianDay,
  ttSecondsPastJ2000ToTdbSeconds
} from "../src/astronomy/naif-tt-tdb-time-bridge.js";
import { NAIF_TT_TDB_EVIDENCE } from "../src/astronomy/naif-tt-tdb-evidence.js";
import { createDe441StateSegmentProofAdapter } from "../src/astronomy/de441-state-segment-adapter.js";
import { DE441_SEGMENT_PROOF_CASES, DE441_SEGMENT_PROOF_PROVENANCE } from "./fixtures/de441-state-segment-proof.js";
import { SEASONAL_EPOCH_PIPELINE, seasonalEpochSourceAudit } from "../src/recurrence/seasonal-epoch-source-audit.js";

const SECONDS_PER_DAY = 86400;

test("NAIF time bridge declares the approximation boundary explicitly", () => {
  assert.equal(NAIF_SPICE_TT_TDB_MODEL.authority, "NASA/JPL NAIF SPICE Time Required Reading");
  assert.equal(NAIF_SPICE_TT_TDB_MODEL.inputScale, "TT");
  assert.equal(NAIF_SPICE_TT_TDB_MODEL.outputScale, "TDB");
  assert.equal(NAIF_SPICE_TT_TDB_MODEL.documentedApproximationAccuracySeconds, 0.00003);
  assert.equal(NAIF_SPICE_TT_TDB_MODEL.completeRelativisticCoordinateTimeDefinition, false);
  assert.equal(NAIF_SPICE_TT_TDB_MODEL.civilTimeIndependent, true);
  assert.match(NAIF_SPICE_TT_TDB_MODEL.sourceUrl, /^https:\/\/naif\.jpl\.nasa\.gov\//);
});

test("fixed-point converter reproduces independently captured CSPICE UNITIM truth", () => {
  const evidence = NAIF_TT_TDB_EVIDENCE;
  assert.equal(evidence.researchPullRequest, 90);
  assert.match(evidence.artifactDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(evidence.promotionBoundary.naifSpiceModelParityValidated, true);
  assert.equal(evidence.promotionBoundary.fullRelativisticTdbDefinitionValidated, false);

  for (const sample of evidence.samples) {
    const actual = ttSecondsPastJ2000ToTdbSeconds(sample.ttSecondsPastJ2000);
    assert.ok(Math.abs(actual - sample.spiceTdbSecondsPastJ2000) <= 0.00001,
      `${sample.label}: ${actual} vs ${sample.spiceTdbSecondsPastJ2000}`);
  }
});

test("deep-time Julian-day bridge preserves CSPICE TT to TDB correction within floating-point budget", () => {
  for (const sample of NAIF_TT_TDB_EVIDENCE.samples) {
    const expectedSeconds = sample.spiceTdbSecondsPastJ2000 - sample.ttSecondsPastJ2000;
    const directSeconds = tdbMinusTtSecondsAtTtJulianDay(sample.jdTt);
    assert.ok(Math.abs(directSeconds - expectedSeconds) <= 0.00001,
      `${sample.label}: direct correction drift ${directSeconds - expectedSeconds} s`);

    const tdbJulianDay = ttJulianDayToTdbJulianDay(sample.jdTt);
    const julianDayCorrectionSeconds = (tdbJulianDay - sample.jdTt) * SECONDS_PER_DAY;
    assert.ok(Math.abs(julianDayCorrectionSeconds - expectedSeconds) <= 0.00002,
      `${sample.label}: JD correction drift ${julianDayCorrectionSeconds - expectedSeconds} s`);
  }
});

test("sampled TT to TDB correction remains millisecond-scale in 2026 and 4006", () => {
  for (const sample of NAIF_TT_TDB_EVIDENCE.samples) {
    const correction = tdbMinusTtSecondsAtTtJulianDay(sample.jdTt);
    assert.ok(Math.abs(correction) < 0.002,
      `${sample.label}: unexpected TT→TDB correction ${correction} s`);
  }
  assert.ok(NAIF_TT_TDB_EVIDENCE.maxObservedAbsTdbMinusTtSeconds < 0.002);
});

test("DE441 proof adapter can consume the real TT to TDB bridge without becoming production-integrated", () => {
  const proofCase = DE441_SEGMENT_PROOF_CASES[0];
  const adapter = createDe441StateSegmentProofAdapter({
    id:"de441-proof-with-naif-time-bridge",
    windows:[proofCase.window],
    provenance:DE441_SEGMENT_PROOF_PROVENANCE,
    ttToTdbJulianDay:ttJulianDayToTdbJulianDay
  });

  const sample = NAIF_TT_TDB_EVIDENCE.samples.find(item => item.label === "2026-march");
  assert.ok(sample);
  assert.equal(adapter.proofOnly, true);
  assert.equal(adapter.productionIntegrated, false);
  assert.equal(adapter.ttToEphemerisJulianDay(sample.jdTt), ttJulianDayToTdbJulianDay(sample.jdTt));
});

test("time bridge proof alone does not promote year 4006 seasonal epochs", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);

  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(result.absoluteSeasonalEpochAvailable, false);
  assert.deepEqual(result.usableSourceIds, []);
});
