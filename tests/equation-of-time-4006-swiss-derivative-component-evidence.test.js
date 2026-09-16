import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_DERIVATIVE_COMPONENT_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-derivative-component-evidence.js";

test("Swiss derivative component evidence freezes immutable provenance", () => {
  assert.equal(evidence.id, "swiss-eot-4006-derivative-components-v1");
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 221);
  assert.equal(evidence.provenance.researchHeadSha, "92c55146a18b863a93071f14007c83cfeda646e2");
  assert.equal(evidence.provenance.workflowRunId, 35116177447);
  assert.equal(evidence.provenance.artifactId, 10455117614);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:f9e143e9f8af5184e0395fa26facd86bfe26515448a63b5966e2181e3c4e920c"
  );
  assert.equal(evidence.sampling.intervals, 105120);
  assert.equal(evidence.sampling.samplesIncludingTerminalEndpoint, 105121);
});

test("component identity reproduces direct Swiss EoT derivative to numerical noise", () => {
  assert.equal(evidence.formula.solarSecondsPerDegree, 240);
  assert.equal(evidence.observed.maxAbsSwissEotForwardSlopeSolarSecondsPerDay, 26.555449898870393);
  assert.equal(evidence.observed.maxAbsComponentDifferenceForwardSolarSecondsPerDay, 26.555449892985052);
  assert.ok(evidence.observed.maxAbsComponentVsDirectEotMismatchSolarSecondsPerDay < 2e-8);
  assert.ok(evidence.observed.maxSunRaEngineSpeedVsFiveMinuteForwardDifferenceDegPerDay < 4e-5);
});

test("planning threshold is explicitly not a second-derivative certificate", () => {
  assert.equal(evidence.planning.remainingSwissDerivativeBudgetSolarSecondsPerDay, 114.00594286480292);
  assert.equal(evidence.planning.remainingForwardSlopeMarginSolarSecondsPerDay, 87.45049296593253);
  assert.equal(evidence.planning.requiredCertifiedSecondDerivativeBoundDegPerDaySquared, 104.94059155911904);
  assert.equal(evidence.planning.bridgeMethod, "mean-value-theorem-forward-slope-plus-certified-second-derivative");
  assert.equal(evidence.planning.secondDerivativeCertificateAvailable, false);

  const interpretation = evidence.interpretation;
  assert.equal(interpretation.empiricalOnly, true);
  assert.equal(interpretation.forwardSlopeGridIsContinuousDerivativeBound, false);
  assert.equal(interpretation.certifiedSwissEotSecondDerivativeBound, false);
  assert.equal(interpretation.certifiedSwissEotDerivativeBound, false);
  assert.equal(interpretation.continuousResidualUpperBound, false);
  assert.equal(interpretation.recurrenceAuthorityGranted, false);
});
