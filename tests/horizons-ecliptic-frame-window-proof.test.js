import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRotationMatrix,
  createHorizonsEclipticFrameWindowProofAdapter,
  interpolateRotationMatrices,
  rotationDistanceArcsec,
  rotationFromDirectionPairs,
  sphericalDegreesToUnitVector
} from "../src/astronomy/horizons-ecliptic-frame-window-proof.js";
import { HORIZONS_ECLIPTIC_FRAME_EVIDENCE } from "../src/astronomy/horizons-ecliptic-frame-evidence.js";
import {
  HORIZONS_2026_CROSS_TARGET_CASES,
  HORIZONS_4006_FRAME_INTERPOLATION_CASES
} from "./fixtures/horizons-ecliptic-frame-proof.js";
import { SEASONAL_EPOCH_PIPELINE, seasonalEpochSourceAudit } from "../src/recurrence/seasonal-epoch-source-audit.js";

function directionPairMatrix(sample) {
  return rotationFromDirectionPairs({
    sourceA:sphericalDegreesToUnitVector(sample.sun.icrf),
    targetA:sphericalDegreesToUnitVector(sample.sun.ecliptic),
    sourceB:sphericalDegreesToUnitVector(sample.moon.icrf),
    targetB:sphericalDegreesToUnitVector(sample.moon.ecliptic)
  });
}

function angularDistanceArcsec(a, b) {
  const cross = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const crossMagnitude = Math.hypot(...cross);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.atan2(crossMagnitude, dot) * 206264.80624709636;
}

function determinant(matrix) {
  return matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1])
    - matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0])
    + matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]);
}

test("Horizons frame evidence records a clean proof boundary", () => {
  const evidence = HORIZONS_ECLIPTIC_FRAME_EVIDENCE;
  assert.equal(evidence.authority, "NASA/JPL Horizons API");
  assert.equal(evidence.researchPullRequest, 94);
  assert.match(evidence.denseWindowArtifactDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(evidence.crossTargetValidation.targetIndependentRotationValidated, true);
  assert.ok(evidence.crossTargetValidation.maxAngularResidualArcsec < 0.001);
  assert.equal(evidence.year4006DenseWindow.exhaustiveHalfDaySweepValidated, true);
  assert.ok(evidence.year4006DenseWindow.maxAngularResidualArcsec < 0.01);
  assert.ok(evidence.year4006DenseWindow.maxEquivalentMeanAnnualSolarCrossingSeconds < 0.25);
  assert.equal(evidence.promotionBoundary.apparentDirectionCorrectionFromGeometricDe441StateValidated, false);
  assert.equal(evidence.promotionBoundary.productionSeasonalPipelineIntegrated, false);
});

test("Sun + Moon recover a target-independent 2026 ICRF to ecliptic-of-date rotation", () => {
  let maxResidualArcsec = 0;
  for (const proofCase of HORIZONS_2026_CROSS_TARGET_CASES) {
    const matrix = directionPairMatrix(proofCase);
    assert.ok(Math.abs(determinant(matrix) - 1) < 1e-12, `${proofCase.jdTt}: improper rotation`);
    for (const withheld of proofCase.withheld) {
      const predicted = applyRotationMatrix(matrix, sphericalDegreesToUnitVector(withheld.icrf));
      const expected = sphericalDegreesToUnitVector(withheld.ecliptic);
      const residual = angularDistanceArcsec(predicted, expected);
      maxResidualArcsec = Math.max(maxResidualArcsec, residual);
      assert.ok(residual < 0.001, `${proofCase.jdTt} ${withheld.target}: ${residual} arcsec`);
    }
  }
  assert.ok(maxResidualArcsec <= HORIZONS_ECLIPTIC_FRAME_EVIDENCE.crossTargetValidation.maxAngularResidualArcsec + 1e-9);
});

test("daily quaternion SLERP reproduces selected worst-region year-4006 half-day frame truth", () => {
  let maxSelectedResidualArcsec = 0;
  for (const proofCase of HORIZONS_4006_FRAME_INTERPOLATION_CASES) {
    const startMatrix = directionPairMatrix(proofCase.start);
    const endMatrix = directionPairMatrix(proofCase.end);
    const truthMatrix = directionPairMatrix(proofCase.truth);
    const interpolated = interpolateRotationMatrices(startMatrix, endMatrix, 0.5);
    const residualArcsec = rotationDistanceArcsec(interpolated, truthMatrix);
    maxSelectedResidualArcsec = Math.max(maxSelectedResidualArcsec, residualArcsec);
    assert.ok(residualArcsec < 0.011, `${proofCase.jdTt}: ${residualArcsec} arcsec`);
  }
  assert.ok(maxSelectedResidualArcsec < 0.011);
  assert.ok(HORIZONS_ECLIPTIC_FRAME_EVIDENCE.year4006DenseWindow.maxAngularResidualArcsec < 0.01);
});

test("proof adapter interpolates frame windows without claiming production integration", () => {
  const windows = HORIZONS_4006_FRAME_INTERPOLATION_CASES.map(proofCase => ({
    startJdTt:proofCase.startJdTt,
    endJdTt:proofCase.endJdTt,
    startMatrix:directionPairMatrix(proofCase.start),
    endMatrix:directionPairMatrix(proofCase.end)
  }));
  const adapter = createHorizonsEclipticFrameWindowProofAdapter({
    id:"horizons-ecliptic-frame-selected-window-proof",
    windows,
    provenance:HORIZONS_ECLIPTIC_FRAME_EVIDENCE
  });
  assert.equal(adapter.proofOnly, true);
  assert.equal(adapter.productionIntegrated, false);
  assert.equal(adapter.inputFrame, "ICRF apparent direction");
  assert.equal(adapter.outputFrame, "Earth ecliptic-of-date apparent direction");

  for (const proofCase of HORIZONS_4006_FRAME_INTERPOLATION_CASES) {
    const actual = adapter.matrixAtTtJulianDay(proofCase.jdTt);
    const truth = directionPairMatrix(proofCase.truth);
    assert.ok(rotationDistanceArcsec(actual, truth) < 0.011);
  }
  assert.throws(() => adapter.matrixAtTtJulianDay(3184300.0), /no proof frame window covers/);
});

test("frame proof alone keeps the year-4006 seasonal epoch fail-closed", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(result.absoluteSeasonalEpochAvailable, false);
  assert.deepEqual(result.usableSourceIds, []);
});
