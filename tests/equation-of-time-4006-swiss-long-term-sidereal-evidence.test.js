import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_LONG_TERM_SIDEREAL_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-long-term-sidereal-evidence.js";

test("Swiss long-term sidereal evidence freezes canonical research provenance", () => {
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 296);
  assert.equal(evidence.provenance.researchHeadSha, "c8f7c7b3a9e8515b511c8715dd8f4eb5ee8f512b");
  assert.equal(evidence.provenance.workflowRunId, 35196329793);
  assert.equal(evidence.provenance.artifactId, 10485728968);
  assert.equal(evidence.provenance.artifactDigest, "sha256:a2d23d1f5929c15b8fee43ff0c8015dd14275f8c248b10384e2cdf511892318e");
  assert.equal(evidence.provenance.swissUpstreamCommit, "9083a12d59e98034fb2337061481ac8800c16e64");
  assert.equal(evidence.provenance.siderealModel, "SEMOD_SIDT_LONGTERM");
});

test("public swe_time_equ principal branch is continuously bounded away from wrap", () => {
  const wrap = evidence.publicTimeEquWrapHardBounds;
  assert.equal(evidence.sample.maxAbsReconstructedVsPublicSidtimeHours, 0);
  assert.equal(evidence.sample.gridMinimumIsContinuousLowerBound, false);
  assert.equal(wrap.sampledAbsEotAngleDeg, 4.222678784093318);
  assert.equal(wrap.continuousAbsEotAngleUpperDeg, 5.911338768921992);
  assert.ok(wrap.continuousAbsEotAngleUpperDeg < wrap.principalWrapBoundaryDeg);
  assert.ok(evidence.sample.hardPreEqeqEclipticXyLower > 0.99);
});

test("full Swiss EoT curvature and derivative close their planning budgets", () => {
  const hard = evidence.derivedHardBounds;
  assert.equal(hard.longTermSiderealSecondDerivativeBoundDegPerUtDaySquared, 0.05141596029455719);
  assert.equal(hard.swissEotSecondDerivativeBoundDegPerUtDaySquared, 6.159456183160202);
  assert.equal(hard.swissEotDerivativeBoundSolarSecondsPerUtDay, 31.688330051503893);
  assert.ok(hard.swissEotDerivativeBoundSolarSecondsPerUtDay < hard.independentSwissDerivativeBudgetSolarSecondsPerUtDay);
  assert.ok(hard.analyticResidualDerivativeBoundSolarSecondsPerUtDay < hard.analyticResidualPlanningBudgetSolarSecondsPerUtDay);
});

test("independent Swiss derivative is certified without granting residual or recurrence authority", () => {
  const i = evidence.interpretation;
  assert.equal(i.sourceDerivedContinuousBound, true);
  assert.equal(i.longTermSiderealSecondDerivativeCertified, true);
  assert.equal(i.swissEotSecondDerivativeCertified, true);
  assert.equal(i.swissEotDerivativeCertified, true);
  assert.equal(i.independentSwissDerivativeCertified, true);
  assert.equal(i.analyticResidualDerivativeEnvelopeWithinBudget, true);
  assert.equal(i.productionRuntimeFloatingPointContinuityCertified, false);
  assert.equal(i.continuousResidualUpperBound, false);
  assert.equal(i.deterministicMembership, false);
  assert.equal(i.recurrenceAuthorityGranted, false);
});
