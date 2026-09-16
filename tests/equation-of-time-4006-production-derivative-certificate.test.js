import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_PRODUCTION_DERIVATIVE_CERTIFICATE as certificate } from "../src/astronomy/equation-of-time-4006-production-derivative-certificate.js";

test("year-4006 production derivative certificate freezes provenance and source audit", () => {
  assert.equal(certificate.id, "atlas-tyme-nrel-spa-eot-4006-production-derivative-v1");
  assert.equal(certificate.targetYear, 4006);
  assert.equal(certificate.productionModelId, "atlas-tyme-nrel-spa-v1");
  assert.equal(certificate.provenance.researchPullRequest, 213);
  assert.equal(certificate.provenance.researchHeadSha, "5b7c3418e6810fc249e4f43e91aa88e11490e749");
  assert.equal(certificate.provenance.workflowRunId, 35097330762);
  assert.equal(certificate.provenance.artifactId, 10446960838);
  assert.equal(
    certificate.provenance.artifactDigest,
    "sha256:c13768592ebd3faf57f5a45bde23a7b51bdcb6490645dc6091ca41234f8ce3e8"
  );
  assert.equal(certificate.sourceAudit.xl0Length, 2666);
  assert.equal(certificate.sourceAudit.nutBLength, 50);
  assert.equal(certificate.sourceAudit.reconstructionProbeMaxMismatchRad, 0);
});

test("analytic production derivative bound leaves a large independent-reference budget", () => {
  assert.equal(certificate.proof.method, "finite-series-absolute-derivative-bound-with-secular-cancellation-v1");
  assert.equal(certificate.proof.deltaTBranch, "dtExt-jsd-31");
  assert.equal(certificate.proof.analyticExpressionDerivativeBoundSolarSecondsPerUtDay, 32.02972427488034);
  assert.equal(certificate.proof.planningResidualLipschitzBudgetSecondsPerDay, 146.03566713968326);
  assert.equal(certificate.proof.remainingPlanningBudgetForIndependentSwissDerivativeSecondsPerDay, 114.00594286480292);
  assert.ok(
    certificate.proof.analyticExpressionDerivativeBoundSolarSecondsPerUtDay
      < certificate.proof.planningResidualLipschitzBudgetSecondsPerDay
  );
});

test("certificate distinguishes analytic expression from floating-point and Swiss authority", () => {
  const interpretation = certificate.interpretation;
  assert.equal(interpretation.analyticExpressionDerivativeCertified, true);
  assert.equal(interpretation.coefficientAndFormulaAuditBounded, true);
  assert.equal(interpretation.floatingPointEvaluationRoundoffCertified, false);
  assert.equal(interpretation.productionRuntimeFloatingPointContinuityCertified, false);
  assert.equal(interpretation.independentSwissDerivativeCertified, false);
  assert.equal(interpretation.residualDerivativeCertified, false);
  assert.equal(interpretation.continuousResidualUpperBound, false);
  assert.equal(interpretation.deterministicMembership, false);
  assert.equal(interpretation.recurrenceAuthorityGranted, false);
  assert.match(interpretation.reason, /cannot yet supply a continuous residual bound/);
});
