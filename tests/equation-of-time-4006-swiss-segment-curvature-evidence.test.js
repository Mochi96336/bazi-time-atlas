import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_SEGMENT_CURVATURE_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-segment-curvature-evidence.js";

test("SWIEPH segment curvature evidence freezes pinned source provenance", () => {
  assert.equal(evidence.id, "swiss-eot-4006-swieph-segment-curvature-v1");
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 236);
  assert.equal(evidence.provenance.researchHeadSha, "216b6f3d8b9e5c6f8e05f112fdcd748dac9cb51f");
  assert.equal(evidence.provenance.workflowRunId, 35119332830);
  assert.equal(evidence.provenance.artifactId, 10457205225);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:28a6b53ebad8e759eecd2d59d8494b59cf8a83a1b99afe75343f649285b7ffbb"
  );
});

test("every inspected SWIEPH body has segment cadence safely wider than the inspection grid", () => {
  assert.equal(evidence.method.sampleStepDays, 0.25);
  for (const body of Object.values(evidence.bodies)) {
    assert.ok(body.segmentCount > 0);
    assert.ok(evidence.method.sampleStepDays <= body.minSegmentDays);
    assert.equal(body.rotatedSegments, body.segmentCount);
    assert.equal(body.referenceEllipseSegments, body.segmentCount);
  }
});

test("source-derived geometry yields a positive continuous separation and RA curvature bound", () => {
  const hard = evidence.derivedHardBounds;
  assert.ok(hard.hardSunRelativeXyLowerAu > 0.96);
  assert.ok(hard.hardSunRelativeDistanceLowerAu > 0.96);
  assert.equal(
    hard.geometricJ2000RaSecondDerivativeBoundDegPerDaySquared,
    4.560881140839361
  );
  assert.ok(
    hard.geometricJ2000RaSecondDerivativeBoundDegPerDaySquared <
      evidence.planning.fullSwissEotSecondDerivativeThresholdDegPerDaySquared
  );
});

test("geometric certificate leaves most of the Swiss EoT curvature budget for missing layers", () => {
  assert.equal(evidence.planning.geometricFractionOfThreshold, 0.043461553561664035);
  assert.equal(
    evidence.planning.thresholdRemainingAfterGeometricBoundDegPerDaySquared,
    100.37971041827969
  );
  assert.ok(evidence.planning.requiredThresholdToGeometricBoundRatio > 23);
  assert.deepEqual(evidence.planning.remainingProofLayers, [
    "apparent-position-correction-chain",
    "long-term-sidereal-second-derivative"
  ]);
});

test("geometric hard bound never promotes itself into full Swiss EoT authority", () => {
  const interpretation = evidence.interpretation;
  assert.equal(interpretation.sourceDerivedContinuousBound, true);
  assert.equal(interpretation.chebyshevSegmentVelocityAccelerationBoundsAnalytic, true);
  assert.equal(interpretation.sampleBetweenDistanceLowerBoundUsesCertifiedVelocityEnvelope, true);
  assert.equal(interpretation.geometricJ2000RaSecondDerivativeBoundAnalytic, true);
  assert.equal(interpretation.apparentPositionCorrectionChainCertified, false);
  assert.equal(interpretation.longTermSiderealSecondDerivativeCertified, false);
  assert.equal(interpretation.swissEotSecondDerivativeCertified, false);
  assert.equal(interpretation.swissEotDerivativeCertified, false);
  assert.equal(interpretation.continuousResidualUpperBound, false);
  assert.equal(interpretation.deterministicMembership, false);
  assert.equal(interpretation.recurrenceAuthorityGranted, false);
});
