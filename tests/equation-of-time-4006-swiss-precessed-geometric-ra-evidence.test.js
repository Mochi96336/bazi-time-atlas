import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_PRECESSED_GEOMETRIC_RA_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-precessed-geometric-ra-evidence.js";

test("historical #257 evidence preserves canonical provenance", () => {
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
});

test("legacy #257 composed XY and RA result is explicitly superseded", () => {
  assert.equal(evidence.supersession.supersededForRightAscension, true);
  assert.equal(evidence.supersession.invalidForRightAscension, true);
  assert.equal(
    evidence.supersession.defectId,
    "missing-seflg-equatorial-in-legacy-geometric-ra-samplers"
  );
  assert.equal(
    evidence.supersession.correctedEvidenceId,
    "swiss-eot-4006-equatorial-ra-frame-correction-v1"
  );
  assert.equal(evidence.supersession.correctedByPullRequest, 262);
  assert.equal(evidence.supersession.inputFrameToPrecession, "ecliptic-cartesian-j2000");

  assert.equal(evidence.sample.minSampledPrecessedXyAu, 0.9709572061243548);
  assert.equal(evidence.derivedHardBounds.hardMeanOfDateGeometricXyLowerAu, 0.9476854046466644);
  assert.equal(
    evidence.derivedHardBounds.meanOfDateGeometricRaSecondDerivativeBoundDegPerDaySquared,
    4.686029194569439
  );

  const i = evidence.interpretation;
  assert.equal(i.geometricJ2000PvaEnvelopeCertified, true);
  assert.equal(i.vondrakPrecessionMatrixCertified, true);
  assert.equal(i.legacyRaClaimSuperseded, true);
  assert.equal(i.validForRightAscension, false);
  assert.equal(i.geometricJ2000InputCertified, false);
  assert.equal(i.precessedGeometricXySeparationContinuous, false);
  assert.equal(i.meanOfDateGeometricRaSecondDerivativeCertified, false);
  assert.equal(i.sourceDerivedContinuousBound, false);
});

test("superseded #257 evidence cannot promote to apparent-Sun or recurrence authority", () => {
  const i = evidence.interpretation;
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
