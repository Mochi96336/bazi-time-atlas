import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_VONDRAK_PRECESSION_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-vondrak-precession-evidence.js";

test("year-4006 Vondrak evidence freezes the canonical source-derived matrix bounds", () => {
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 249);
  assert.equal(evidence.provenance.researchHeadSha, "b347bef60adb04a0f2c534fd050f2a0a68cf5c6e");
  assert.equal(evidence.provenance.workflowRunId, 35123371284);
  assert.equal(evidence.provenance.artifactId, 10457719095);
  assert.equal(evidence.provenance.artifactDigest, "sha256:03affa44f10f415aaa1024823a39de662ea6c8a60cdb930007331304b6f37780");
  assert.equal(evidence.provenance.swissUpstreamCommit, "9083a12d59e98034fb2337061481ac8800c16e64");
  assert.equal(evidence.method.defaultModel, "SEMOD_PREC_VONDRAK_2011");
  assert.deepEqual(evidence.method.coefficientTables, ["xypol", "xyper", "pqpol", "pqper"]);
  assert.equal(evidence.method.coefficientTablesParsedFromPinnedSource, true);
  assert.equal(evidence.method.coefficientDerivativeBoundsAnalytic, true);
});

test("equator/ecliptic pole cross product is continuously separated from the normalization singularity", () => {
  assert.ok(evidence.crossProductHardBounds.hardNormLower > 0.39);
  assert.equal(evidence.crossProductHardBounds.hardNormLower, 0.393663121835452);
  assert.equal(evidence.crossProductHardBounds.continuousNonSingularityCertified, true);
  assert.ok(evidence.method.crossProductSampleStepDays <= 1);
  assert.equal(evidence.method.crossProductBetweenSamplesUsesCertifiedVelocityEnvelope, true);
});

test("Vondrak precession matrix first and second derivative operator bounds are frozen", () => {
  assert.equal(evidence.precessionMatrixHardBounds.firstDerivativeOperatorNormPerDay, 2.052417373487835e-6);
  assert.equal(evidence.precessionMatrixHardBounds.secondDerivativeOperatorNormPerDaySquared, 1.564723396506781e-11);
  assert.equal(evidence.interpretation.sourceDerivedContinuousBound, true);
  assert.equal(evidence.interpretation.precessionMatrixFirstDerivativeCertified, true);
  assert.equal(evidence.interpretation.precessionMatrixSecondDerivativeCertified, true);
});

test("matrix certificate cannot be promoted to RA, EoT, membership or recurrence authority", () => {
  assert.equal(evidence.interpretation.precessionRaCorrectionCertified, false);
  assert.equal(evidence.interpretation.apparentPositionCorrectionChainCertified, false);
  assert.equal(evidence.interpretation.longTermSiderealSecondDerivativeCertified, false);
  assert.equal(evidence.interpretation.swissEotSecondDerivativeCertified, false);
  assert.equal(evidence.interpretation.continuousResidualUpperBound, false);
  assert.equal(evidence.interpretation.deterministicMembership, false);
  assert.equal(evidence.interpretation.recurrenceAuthorityGranted, false);
});
