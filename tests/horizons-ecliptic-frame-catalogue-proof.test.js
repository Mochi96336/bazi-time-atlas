import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRotationMatrix,
  interpolateRotationMatrices,
  rotationDistanceArcsec,
  rotationFromDirectionPairs,
  sphericalDegreesToUnitVector
} from "../src/astronomy/horizons-ecliptic-frame-window-proof.js";
import { createHorizonsEclipticFrameWindowProofTransform } from "../src/astronomy/horizons-ecliptic-frame-transform-proof.js";
import {
  HORIZONS_ECLIPTIC_FRAME_EVIDENCE
} from "../src/astronomy/horizons-ecliptic-frame-evidence.js";
import {
  validateMeanEclipticOfDateTransform
} from "../src/astronomy/absolute-state-seasonal-solver.js";
import {
  HORIZONS_4006_PREVIOUS_WINTER_SOLSTICE_FRAME_CASE
} from "./fixtures/horizons-ecliptic-frame-catalogue-proof.js";
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

test("extended frame evidence covers the complete Tyme-style year-4006 catalogue window", () => {
  const evidence = HORIZONS_ECLIPTIC_FRAME_EVIDENCE;
  assert.equal(evidence.denseWindowResearchRunId, 34881697237);
  assert.equal(evidence.denseWindowArtifactId, 10363212590);
  assert.equal(
    evidence.denseWindowArtifactDigest,
    "sha256:7445693e518a54c261eb1cd499f78522558eee2cb57a250c51a82e40b5b44549"
  );
  assert.equal(evidence.year4006DenseWindow.catalogueYear, 4006);
  assert.equal(evidence.year4006DenseWindow.knotRows, 397);
  assert.equal(evidence.year4006DenseWindow.withheldRows, 396);
  assert.equal(evidence.year4006DenseWindow.completeCatalogueYearWindowValidated, true);
  assert.ok(evidence.year4006DenseWindow.maxAngularResidualArcsec < 0.01);
  assert.ok(evidence.year4006DenseWindow.maxEquivalentMeanAnnualSolarCrossingSeconds < 0.25);
  assert.equal(evidence.promotionBoundary.completeCatalogueYear4006WindowValidated, true);
});

test("previous-December winter-solstice frame bracket is pinned and remains below the interpolation gate", () => {
  const proofCase = HORIZONS_4006_PREVIOUS_WINTER_SOLSTICE_FRAME_CASE;
  assert.ok(proofCase.start.sun.ecliptic[0] < 270);
  assert.ok(proofCase.end.sun.ecliptic[0] > 270);

  const startMatrix = directionPairMatrix(proofCase.start);
  const endMatrix = directionPairMatrix(proofCase.end);
  const truthMatrix = directionPairMatrix(proofCase.truth);
  const interpolated = interpolateRotationMatrices(startMatrix, endMatrix, 0.5);
  assert.ok(rotationDistanceArcsec(interpolated, truthMatrix) < 0.01);
});

test("proof transform now satisfies the absolute-state solver frame contract without widening coverage", () => {
  const proofCase = HORIZONS_4006_PREVIOUS_WINTER_SOLSTICE_FRAME_CASE;
  const transform = createHorizonsEclipticFrameWindowProofTransform({
    id:"horizons-year-4006-previous-winter-frame-proof",
    windows:[{
      startJdTt:proofCase.startJdTt,
      endJdTt:proofCase.endJdTt,
      startMatrix:directionPairMatrix(proofCase.start),
      endMatrix:directionPairMatrix(proofCase.end)
    }],
    provenance:HORIZONS_ECLIPTIC_FRAME_EVIDENCE
  });

  assert.equal(validateMeanEclipticOfDateTransform(transform), transform);
  assert.equal(transform.proofOnly, true);
  assert.equal(transform.productionIntegrated, false);

  const source = sphericalDegreesToUnitVector(proofCase.truth.sun.icrf);
  const expected = sphericalDegreesToUnitVector(proofCase.truth.sun.ecliptic);
  const actual = transform.icrfDirectionToMeanEclipticOfDate({
    ttJulianDay:proofCase.jdTt,
    directionIcrf:source
  });
  assert.ok(angularDistanceArcsec(actual, expected) < 0.01);
  assert.throws(() => transform.icrfDirectionToMeanEclipticOfDate({
    ttJulianDay:proofCase.startJdTt - 1,
    directionIcrf:source
  }), /no proof frame window covers/);
});

test("complete frame catalogue proof still leaves year 4006 fail-closed", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(result.absoluteSeasonalEpochAvailable, false);
});
