import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_PRECESSED_GEOMETRIC_RA_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-precessed-geometric-ra-evidence.js";

test("year-4006 precessed geometric RA certificate freezes canonical source-derived bounds", () => {
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 257);
  assert.equal(evidence.provenance.workflowRunId, 35126429925);
  assert.equal(evidence.provenance.artifactId, 10459522062);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:675566391a634e9e248b886a14f99ef4614b64ca45cd63b737ee5e1cfd306b75"
  );
  assert.equal(
    evidence.provenance.swissUpstreamCommit,
    "9083a12d59e98034fb2337061481ac8800c16e64"
  );

  assert.equal(evidence.method.uniformEtGrid, true);
  assert.equal(evidence.method.sampleIntervals, 1461);
  assert.equal(evidence.method.sampleStepEtDays, 0.249828987573844);
  assert.equal(evidence.method.sampleCoverRadiusEtDays, 0.124914493786922);
  assert.equal(evidence.sample.minSampledPrecessedXyAu, 0.9709572061243548);
  assert.equal(evidence.sample.gridMinimumIsContinuousLowerBound, false);

  assert.equal(evidence.derivedHardBounds.meanOfDateGeometricVelocityAuPerDay, 0.18630185154804502);
  assert.equal(
    evidence.derivedHardBounds.meanOfDateGeometricAccelerationAuPerDaySquared,
    0.004259265540528864
  );
  assert.equal(evidence.derivedHardBounds.hardMeanOfDateGeometricXyLowerAu, 0.9476854046466644);
  assert.equal(
    evidence.derivedHardBounds.meanOfDateGeometricRaSecondDerivativeBoundDegPerDaySquared,
    4.686029194569439
  );
  assert.equal(
    evidence.planning.thresholdRemainingAfterGeometricMeanOfDateBoundDegPerDaySquared,
    100.2545623645496
  );
});

test("precessed geometric RA certificate cannot self-promote to apparent-Sun or recurrence authority", () => {
  const i = evidence.interpretation;
  assert.equal(i.sourceDerivedContinuousBound, true);
  assert.equal(i.geometricJ2000InputCertified, true);
  assert.equal(i.vondrakPrecessionMatrixCertified, true);
  assert.equal(i.precessedGeometricXySeparationContinuous, true);
  assert.equal(i.meanOfDateGeometricRaSecondDerivativeCertified, true);

  assert.equal(i.actualSwissPrecessionCorrectionCertified, false);
  assert.equal(i.lightTimeCorrectionCertified, false);
  assert.equal(i.aberrationCorrectionCertified, false);
  assert.equal(i.deflectionCorrectionCertified, false);
  assert.equal(i.nutationCorrectionCertified, false);
  assert.equal(i.apparentPositionCorrectionChainCertified, false);
  assert.equal(i.longTermSiderealSecondDerivativeCertified, false);
  assert.equal(i.swissEotSecondDerivativeCertified, false);
  assert.equal(i.swissEotDerivativeCertified, false);
  assert.equal(i.continuousResidualUpperBound, false);
  assert.equal(i.deterministicMembership, false);
  assert.equal(i.recurrenceAuthorityGranted, false);
});
