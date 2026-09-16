import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_NUTATION_RA_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-nutation-ra-evidence.js";

test("Swiss nutation RA evidence freezes canonical source provenance", () => {
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 285);
  assert.equal(evidence.provenance.researchHeadSha, "c39b72c37d1e865ee4c4affedb800f70e097c3db");
  assert.equal(evidence.provenance.workflowRunId, 35141124781);
  assert.equal(evidence.provenance.artifactId, 10464878879);
  assert.equal(evidence.provenance.artifactDigest, "sha256:85488af5a82c72559f1ad6994f366ee6484d709f269e4fbd523be5e76380f1a7");
  assert.equal(evidence.provenance.nutationModel, "SEMOD_NUT_IAU_2000B");
  assert.equal(evidence.provenance.luniSolarTermCount, 77);
});

test("IAU 2000B nutation matrix derivative bounds are frozen", () => {
  const n = evidence.nutationMatrixHardBounds;
  assert.equal(n.firstDerivativeOperatorNormPerDay, 0.000012858689235624982);
  assert.equal(n.secondDerivativeOperatorNormPerDaySquared, 0.000008739026281272349);
  assert.equal(n.meanObliquitySinLower, 0.393663121835452);
});

test("nutated apparent-Sun RA curvature remains below the planning threshold", () => {
  const hard = evidence.derivedHardBounds;
  assert.equal(evidence.sample.gridMinimumIsContinuousLowerBound, false);
  assert.equal(evidence.sample.minSampledNutatedEquatorialXyAu, 0.9090499808569127);
  assert.equal(hard.hardNutatedEquatorialXyLowerAu, 0.8848943702168446);
  assert.equal(hard.nutatedRaSecondDerivativeBoundDegPerDaySquared, 6.108040222865645);
  assert.ok(hard.nutatedRaSecondDerivativeBoundDegPerDaySquared < evidence.planning.fullSwissEotSecondDerivativeThresholdDegPerDaySquared);
  assert.ok(evidence.planning.thresholdRemainingAfterNutatedBoundDegPerDaySquared > 98);
});

test("apparent-Sun chain is certified while sidereal and recurrence authority remain closed", () => {
  const i = evidence.interpretation;
  assert.equal(i.sourceDerivedContinuousBound, true);
  assert.equal(i.iau2000bTermDerivativeBoundsAnalytic, true);
  assert.equal(i.nutationMatrixSecondDerivativeCertified, true);
  assert.equal(i.nutationCertified, true);
  assert.equal(i.sunGravitationalDeflectionAbsentByPinnedSourceAudit, true);
  assert.equal(i.apparentPositionCorrectionChainCertified, true);
  assert.equal(i.nutatedRaSecondDerivativeCertified, true);
  assert.equal(i.longTermSiderealSecondDerivativeCertified, false);
  assert.equal(i.swissEotSecondDerivativeCertified, false);
  assert.equal(i.swissEotDerivativeCertified, false);
  assert.equal(i.continuousResidualUpperBound, false);
  assert.equal(i.deterministicMembership, false);
  assert.equal(i.recurrenceAuthorityGranted, false);
});
