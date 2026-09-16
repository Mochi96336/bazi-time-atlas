import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_SECOND_DERIVATIVE_RECON_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-second-derivative-recon-evidence.js";

test("Swiss second-derivative recon freezes immutable provenance", () => {
  assert.equal(evidence.id, "swiss-eot-4006-second-derivative-recon-v1");
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 226);
  assert.equal(evidence.provenance.researchHeadSha, "1a52aa728e457858b2695a53aee476107025a5bd");
  assert.equal(evidence.provenance.workflowRunId, 35117230212);
  assert.equal(evidence.provenance.artifactId, 10455429126);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:f2006a48106e96ee22a9c55da9f8c4559a55881f3ef8d61b83b23d2e644bc892"
  );
  assert.equal(evidence.sampling.intervals, 105120);
  assert.equal(evidence.sampling.samplesIncludingTerminalEndpoint, 105121);
});

test("observed curvature scale is orders below the future hard-bound threshold", () => {
  assert.equal(evidence.observed.maxAbsEotSecondDifferenceDegPerDaySquared, 0.011037621181458235);
  assert.equal(evidence.planning.requiredCertifiedSecondDerivativeBoundDegPerDaySquared, 104.94059155911904);
  assert.equal(evidence.planning.observedSecondDifferenceToRequiredBoundRatio, 0.00010517971184906186);
  assert.equal(evidence.planning.requiredBoundToObservedSecondDifferenceRatio, 9507.536980468723);
  assert.ok(evidence.planning.requiredBoundToObservedSecondDifferenceRatio > 9000);
});

test("reconnaissance never promotes sampled curvature into certification", () => {
  const interpretation = evidence.interpretation;
  assert.equal(interpretation.empiricalOnly, true);
  assert.equal(interpretation.observedSecondDifferencesAreCertification, false);
  assert.equal(interpretation.swissPublicSpeedChangesAreCertification, false);
  assert.equal(interpretation.certifiedSwissEotSecondDerivativeBound, false);
  assert.equal(interpretation.certifiedSwissEotDerivativeBound, false);
  assert.equal(interpretation.residualDerivativeCertified, false);
  assert.equal(interpretation.continuousResidualUpperBound, false);
  assert.equal(interpretation.deterministicMembership, false);
  assert.equal(interpretation.recurrenceAuthorityGranted, false);
});
