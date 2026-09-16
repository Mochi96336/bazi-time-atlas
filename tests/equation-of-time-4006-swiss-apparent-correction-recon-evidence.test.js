import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_APPARENT_CORRECTION_RECON_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-apparent-correction-recon-evidence.js";

test("apparent correction reconnaissance freezes corrected run provenance", () => {
  assert.equal(evidence.id, "swiss-eot-4006-apparent-correction-recon-v2");
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 241);
  assert.equal(evidence.provenance.researchHeadSha, "65295e37c12448ef072ff2cadf38ff22f182a3d4");
  assert.equal(evidence.provenance.workflowRunId, 35120843799);
  assert.equal(evidence.provenance.artifactId, 10457435297);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:ce220ab8b39896755258b503bcf3d4bae0e95604fad593cb89a7d3db74d7549b"
  );
});

test("engine-speed ranking selects precession as the first source-proof target", () => {
  const { corrections } = evidence;
  assert.equal(corrections.precession.priorityRank, 1);
  assert.equal(corrections.lightTime.priorityRank, 2);
  assert.equal(corrections.nutation.priorityRank, 3);
  assert.equal(corrections.aberration.priorityRank, 4);
  assert.equal(corrections.deflection.priorityRank, 5);
  assert.equal(
    corrections.precession.observedMaxAbsEngineSpeedCorrectionAccelerationDegPerDaySquared,
    0.003305809671253712
  );
  assert.equal(
    corrections.lightTime.observedMaxAbsEngineSpeedCorrectionAccelerationDegPerDaySquared,
    0.00017142847026718755
  );
});

test("RA double-difference cancellation is recorded and never used as certification", () => {
  assert.equal(evidence.numericalDiagnostics.raDoubleDifferenceCancellationSensitive, true);
  assert.equal(evidence.numericalDiagnostics.engineSpeedDifferencePreferredForReconnaissance, true);
  assert.ok(
    evidence.numericalDiagnostics.lightTimeRaDoubleDifferenceDegPerDaySquared >
      20 * evidence.numericalDiagnostics.lightTimeEngineSpeedDifferenceAccelerationDegPerDaySquared
  );
  assert.equal(evidence.interpretation.sampledCorrectionCurvatureIsContinuousBound, false);
});

test("correction reconnaissance remains fully non-authoritative", () => {
  const i = evidence.interpretation;
  assert.equal(i.empiricalOnly, true);
  assert.equal(i.flagDecompositionIsProofPrioritizationOnly, true);
  assert.equal(i.precessionIsFirstSourceProofTarget, true);
  assert.equal(i.lightTimeCorrectionCertified, false);
  assert.equal(i.aberrationCorrectionCertified, false);
  assert.equal(i.deflectionCorrectionCertified, false);
  assert.equal(i.precessionCorrectionCertified, false);
  assert.equal(i.nutationCorrectionCertified, false);
  assert.equal(i.apparentPositionCorrectionChainCertified, false);
  assert.equal(i.swissEotSecondDerivativeCertified, false);
  assert.equal(i.continuousResidualUpperBound, false);
  assert.equal(i.deterministicMembership, false);
  assert.equal(i.recurrenceAuthorityGranted, false);
});
