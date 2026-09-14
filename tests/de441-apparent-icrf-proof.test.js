import test from "node:test";
import assert from "node:assert/strict";
import { createDe441StateSegmentProofAdapter } from "../src/astronomy/de441-state-segment-adapter.js";
import { ttJulianDayToTdbJulianDay } from "../src/astronomy/naif-tt-tdb-time-bridge.js";
import {
  createDe441ApparentIcrfProofAdapter,
  DE441_APPARENT_ICRF_MODEL
} from "../src/astronomy/de441-apparent-icrf-proof.js";
import { DE441_APPARENT_ICRF_EVIDENCE } from "../src/astronomy/de441-apparent-icrf-evidence.js";
import {
  DE441_APPARENT_ICRF_PROOF_CASES,
  DE441_APPARENT_ICRF_PROOF_PROVENANCE
} from "./fixtures/de441-apparent-icrf-proof.js";
import { SEASONAL_EPOCH_PIPELINE, seasonalEpochSourceAudit } from "../src/recurrence/seasonal-epoch-source-audit.js";

const AU_METERS = 149_597_870_700;
const ARCSEC_PER_RADIAN = 206264.80624709636;

function norm(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function angularDistanceArcsec(a, b) {
  const aNorm = norm(a);
  const bNorm = norm(b);
  const cross = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const crossMagnitude = norm(cross) / (aNorm * bNorm);
  const cosine = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (aNorm * bNorm);
  return Math.atan2(crossMagnitude, cosine) * ARCSEC_PER_RADIAN;
}

function sphericalDegreesToVector([rightAscensionDegrees, declinationDegrees]) {
  const ra = rightAscensionDegrees * Math.PI / 180;
  const dec = declinationDegrees * Math.PI / 180;
  const cosDec = Math.cos(dec);
  return [cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec)];
}

function proofAdapterFor(proofCase) {
  const stateAdapter = createDe441StateSegmentProofAdapter({
    id:`de441-apparent-${proofCase.id}`,
    windows:[proofCase.window],
    provenance:DE441_APPARENT_ICRF_PROOF_PROVENANCE,
    ttToTdbJulianDay:ttJulianDayToTdbJulianDay
  });
  return createDe441ApparentIcrfProofAdapter({ stateAdapter });
}

test("apparent ICRF proof declares the Sun-specific correction boundary", () => {
  assert.equal(DE441_APPARENT_ICRF_MODEL.inputStateFrame, "ICRF barycentric");
  assert.equal(DE441_APPARENT_ICRF_MODEL.inputStateTimeScale, "TDB");
  assert.equal(DE441_APPARENT_ICRF_MODEL.outputFrame, "ICRF apparent direction");
  assert.equal(DE441_APPARENT_ICRF_MODEL.gravitationalDeflectionForSunCenter, false);
  assert.equal(DE441_APPARENT_ICRF_MODEL.proofOnly, true);
  assert.equal(DE441_APPARENT_ICRF_MODEL.productionIntegrated, false);

  const evidence = DE441_APPARENT_ICRF_EVIDENCE;
  assert.match(evidence.artifactDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(evidence.sampledEpochs.count, 8);
  assert.ok(evidence.horizonsLayerIsolation.maxAstrometricObserverVsVectorLtArcsec < 0.000003);
  assert.ok(evidence.horizonsLayerIsolation.maxApparentObserverVsVectorLtPlusSArcsec < 0.000003);
  assert.equal(evidence.de441Reconstruction.apparentDirectionValidated, true);
  assert.equal(evidence.promotionBoundary.crossingRootSolveValidated, false);
});

test("DE441 windows reconstruct Horizons one-iteration light-time direction", () => {
  let maxPositionErrorMeters = 0;
  let maxAngularErrorArcsec = 0;
  let maxLightTimeErrorSeconds = 0;

  for (const proofCase of DE441_APPARENT_ICRF_PROOF_CASES) {
    const adapter = proofAdapterFor(proofCase);
    const actual = adapter.apparentSunFromEarthAtTtJulianDay(proofCase.jdTt);
    const positionErrorMeters = norm(subtract(
      actual.lightTimeCorrectedPositionAu,
      proofCase.horizons.ltPositionAu
    )) * AU_METERS;
    const angularErrorArcsec = angularDistanceArcsec(
      actual.lightTimeCorrectedPositionAu,
      proofCase.horizons.ltPositionAu
    );
    const lightTimeErrorSeconds = Math.abs(
      actual.oneIterationLightTimeDays * 86400 - proofCase.horizons.observerLightTimeSeconds
    );

    maxPositionErrorMeters = Math.max(maxPositionErrorMeters, positionErrorMeters);
    maxAngularErrorArcsec = Math.max(maxAngularErrorArcsec, angularErrorArcsec);
    maxLightTimeErrorSeconds = Math.max(maxLightTimeErrorSeconds, lightTimeErrorSeconds);

    assert.ok(positionErrorMeters < 1, `${proofCase.id}: LT position ${positionErrorMeters} m`);
    assert.ok(angularErrorArcsec < 0.000002, `${proofCase.id}: LT angle ${angularErrorArcsec} arcsec`);
    assert.ok(lightTimeErrorSeconds < 0.000001, `${proofCase.id}: LT ${lightTimeErrorSeconds} s`);
  }

  assert.ok(maxPositionErrorMeters < 1);
  assert.ok(maxAngularErrorArcsec < 0.000002);
  assert.ok(maxLightTimeErrorSeconds < 0.000001);
});

test("NAIF stellar aberration reconstructs Horizons LT+S and observer quantity #45", () => {
  let maxVectorErrorArcsec = 0;
  let maxObserverErrorArcsec = 0;

  for (const proofCase of DE441_APPARENT_ICRF_PROOF_CASES) {
    const actual = proofAdapterFor(proofCase).apparentSunFromEarthAtTtJulianDay(proofCase.jdTt);
    const vectorErrorArcsec = angularDistanceArcsec(
      actual.apparentPositionAu,
      proofCase.horizons.ltPlusSPositionAu
    );
    const observerErrorArcsec = angularDistanceArcsec(
      actual.apparentPositionAu,
      sphericalDegreesToVector(proofCase.horizons.apparentIcrfDegrees)
    );
    maxVectorErrorArcsec = Math.max(maxVectorErrorArcsec, vectorErrorArcsec);
    maxObserverErrorArcsec = Math.max(maxObserverErrorArcsec, observerErrorArcsec);

    assert.ok(vectorErrorArcsec < 0.00002,
      `${proofCase.id}: LT+S direction ${vectorErrorArcsec} arcsec`);
    assert.ok(observerErrorArcsec < 0.00002,
      `${proofCase.id}: observer #45 ${observerErrorArcsec} arcsec`);
  }

  assert.ok(maxVectorErrorArcsec < 0.00002);
  assert.ok(maxObserverErrorArcsec < 0.00002);
});

test("apparent-direction proof remains fail-closed before end-to-end crossing composition", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);

  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(result.absoluteSeasonalEpochAvailable, false);
  assert.deepEqual(result.usableSourceIds, []);
});
