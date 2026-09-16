import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_DERIVATIVE_RECON_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-derivative-recon-evidence.js";

test("year-4006 derivative reconnaissance provenance is immutable and reproducible", () => {
  assert.equal(evidence.id, "swiss-ephemeris-eot-4006-derivative-recon-v1");
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.productionModelId, "atlas-tyme-nrel-spa-v1");
  assert.equal(evidence.sourceEvidenceId, "swiss-ephemeris-eot-4006-dense-v2");
  assert.equal(evidence.provenance.researchPullRequest, 209);
  assert.equal(evidence.provenance.researchHeadSha, "509e1c7f79c793aa550a9c063f60258232c83c8c");
  assert.equal(evidence.provenance.workflowRunId, 35095077616);
  assert.equal(evidence.provenance.artifactId, 10444839838);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:edb2676fe1101313518d371771ff9589355f33f59a7bba68f8498e09089c4861"
  );
  assert.equal(evidence.reference.upstreamCommit, "9083a12d59e98034fb2337061481ac8800c16e64");
  assert.equal(evidence.reference.ephemerisFiles.length, 2);
});

test("recon exactly reproduces the corrected dense production residual maximum", () => {
  assert.equal(evidence.sampling.cadenceMinutes, 5);
  assert.equal(evidence.sampling.interiorSamples, 105120);
  assert.equal(evidence.sampling.terminalEndpointSampled, true);
  assert.equal(evidence.sampling.totalSamples, 105121);
  assert.equal(evidence.sampling.intervals, 105120);
  assert.equal(evidence.sampling.endpointAugmentedGridCoverRadiusSeconds, 150);
  assert.equal(evidence.reproduction.correctedDenseObservedProductionMaxAbsSeconds, 1.4929317113205443);
  assert.equal(evidence.reproduction.reproducedInteriorObservedProductionMaxAbsSeconds, 1.4929317113205443);
  assert.equal(evidence.reproduction.allGridIncludingEndpointObservedProductionMaxAbsSeconds, 1.4929317113205443);
  assert.equal(evidence.reproduction.exactWithinTolerance, true);
});

test("observed residual slopes and two-second planning threshold are registered without promotion", () => {
  assert.equal(evidence.empiricalSlopes.productionResidualForward.maxAbsSecondsPerSecond, 1.9835599204104905e-7);
  assert.equal(evidence.empiricalSlopes.productionResidualForward.maxAbsSecondsPerDay, 0.01713795771234664);
  assert.equal(evidence.empiricalSlopes.productionResidualForward.worstWindow.start, "4006-11-16T07:10:00");
  assert.equal(evidence.empiricalSlopes.productionResidualForward.worstWindow.end, "4006-11-16T07:15:00");
  assert.equal(evidence.empiricalSlopes.alignedResidualForward.maxAbsSecondsPerSecond, 1.1652745739440497e-7);
  assert.equal(evidence.planning.maximumCertifiedLipschitzSecondsPerSecondForCap, 0.0016902276289315192);
  assert.equal(evidence.planning.maximumCertifiedLipschitzSecondsPerDayForCap, 146.03566713968326);
  assert.equal(evidence.planning.observedForwardSlopeToThresholdRatio, 0.00011735460280367101);
  assert.equal(evidence.planning.thresholdComparisonIsCertification, false);
});

test("empirical derivative reconnaissance cannot supply continuity or recurrence authority", () => {
  const interpretation = evidence.interpretation;
  assert.equal(interpretation.empiricalOnly, true);
  assert.equal(interpretation.certifiedDerivativeBound, false);
  assert.equal(interpretation.certifiedLipschitzBound, false);
  assert.equal(interpretation.continuousUpperBound, false);
  assert.equal(interpretation.deterministicMembership, false);
  assert.equal(interpretation.recurrenceAuthorityGranted, false);
  assert.equal(interpretation.observedFiniteDifferenceIsNotCertification, true);
  assert.match(interpretation.reason, /do not prove the residual derivative between samples/);
});
