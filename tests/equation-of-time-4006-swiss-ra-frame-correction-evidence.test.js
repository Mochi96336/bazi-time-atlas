import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_RA_FRAME_CORRECTION_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-ra-frame-correction-evidence.js";

test("corrected year-4006 Swiss RA frames freeze canonical provenance and hard bounds", () => {
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 262);
  assert.equal(evidence.provenance.workflowRunId, 35128527014);
  assert.equal(evidence.provenance.artifactId, 10460487188);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:52c27e999be25313fbe54431e839b36e7d709090dc7508bbc853fd6a1286a108"
  );
  assert.equal(evidence.method.equatorialFlagExplicit, true);
  assert.equal(evidence.sample.gridMinimumIsContinuousLowerBound, false);
  assert.equal(evidence.sample.j2000.minSampledEquatorialXyAu, 0.9054418534088987);
  assert.equal(evidence.sample.meanOfDate.minSampledEquatorialXyAu, 0.9090325383913674);
  assert.equal(evidence.correctedHardBounds.hardJ2000EquatorialXyLowerAu, 0.8821714047838607);
  assert.equal(
    evidence.correctedHardBounds.geometricJ2000RaSecondDerivativeBoundDegPerDaySquared,
    5.38669680126494
  );
  assert.equal(evidence.correctedHardBounds.hardMeanOfDateEquatorialXyLowerAu, 0.8857607369136771);
  assert.equal(
    evidence.correctedHardBounds.meanOfDateGeometricRaSecondDerivativeBoundDegPerDaySquared,
    5.344883763257586
  );
});

test("RA frame correction supersedes only the bad XY/RA claims and does not grant EoT authority", () => {
  assert.equal(evidence.defect.id, "missing-seflg-equatorial-in-legacy-geometric-ra-samplers");
  assert.deepEqual(evidence.defect.supersedesPullRequests, [236, 257]);
  const i = evidence.interpretation;
  assert.equal(i.coordinateFrameCorrectionCertified, true);
  assert.equal(i.legacy236RaClaimSuperseded, true);
  assert.equal(i.legacy257RaClaimSuperseded, true);
  assert.equal(i.sourceDerivedPvaCertificateStillValid, true);
  assert.equal(i.sourceDerivedDistanceCertificateStillValid, true);
  assert.equal(i.geometricJ2000RaSecondDerivativeCertified, true);
  assert.equal(i.meanOfDateGeometricRaSecondDerivativeCertified, true);
  assert.equal(i.lightTimeCorrectionCertified, false);
  assert.equal(i.apparentPositionCorrectionChainCertified, false);
  assert.equal(i.longTermSiderealSecondDerivativeCertified, false);
  assert.equal(i.swissEotSecondDerivativeCertified, false);
  assert.equal(i.continuousResidualUpperBound, false);
  assert.equal(i.deterministicMembership, false);
  assert.equal(i.recurrenceAuthorityGranted, false);
});
