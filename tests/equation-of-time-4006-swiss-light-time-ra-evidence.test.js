import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_LIGHT_TIME_RA_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-light-time-ra-evidence.js";

test("Swiss light-time RA evidence freezes corrected canonical provenance", () => {
  assert.equal(evidence.id, "swiss-eot-4006-two-pass-light-time-precessed-ra-curvature-v1");
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 261);
  assert.equal(evidence.provenance.researchHeadSha, "55d062701b75ff8b0f4d1527db285f40f878d8fd");
  assert.equal(evidence.provenance.workflowRunId, 35130604582);
  assert.equal(evidence.provenance.artifactId, 10461401146);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:b5aa96c7ce3d695b4b34671a0308e7fbed604d0dbed013231ac03166e8131ef6"
  );
  assert.equal(
    evidence.provenance.correctedRaFrameEvidenceId,
    "swiss-eot-4006-equatorial-ra-frame-correction-v1"
  );
});

test("two-pass retarded-time and segment-domain bounds are frozen", () => {
  const rt = evidence.retardedTimeHardBounds;
  assert.equal(rt.tau0MaxDays, 0.030476349786717236);
  assert.equal(rt.tau1MaxDays, 0.030476349786717236);
  assert.equal(rt.tau0PrimeAbs, 0.001075927208606605);
  assert.equal(rt.tau1PrimeAbs, 0.0010765058633852458);
  assert.equal(rt.firstRetardedDistanceLowerAu, 0.958079870794773);
  assert.ok(rt.retardedSunDomainStartEtJd >= rt.inspectedSunSegmentStartEtJd);
  assert.ok(rt.retardedSunDomainStartEtJd < rt.inspectedSunSegmentEndEtJd);
  assert.equal(evidence.proof.retardedSunDomainCoveredByInspectedChebyshevSegments, true);
});

test("light-time plus precession continuous RA curvature uses corrected equatorial baseline", () => {
  const hard = evidence.derivedHardBounds;
  assert.equal(evidence.sample.gridMinimumIsContinuousLowerBound, false);
  assert.equal(evidence.sample.minSampledLightTimePrecessedXyAu, 0.9090325665612146);
  assert.equal(hard.hardLightTimePrecessedXyLowerAu, 0.8857482430483616);
  assert.equal(hard.lightTimePrecessedVelocityAuPerDay, 0.1864020964018084);
  assert.equal(hard.lightTimePrecessedAccelerationAuPerDaySquared, 0.004285645872490167);
  assert.equal(
    hard.lightTimePrecessedRaSecondDerivativeBoundDegPerDaySquared,
    5.3521941602424254
  );
  assert.equal(
    evidence.planning.priorCorrectedGeometricMeanOfDateRaBoundDegPerDaySquared,
    5.344883763257586
  );
  assert.ok(
    hard.lightTimePrecessedRaSecondDerivativeBoundDegPerDaySquared >
      evidence.planning.priorCorrectedGeometricMeanOfDateRaBoundDegPerDaySquared
  );
  assert.ok(evidence.planning.thresholdRemainingAfterLightTimePrecessedBoundDegPerDaySquared > 0);
});

test("light-time certificate remains strictly scoped below apparent-Sun and recurrence authority", () => {
  const i = evidence.interpretation;
  assert.equal(i.sourceDerivedContinuousBound, true);
  assert.equal(i.correctedRaFrameEvidenceRequired, true);
  assert.equal(i.swissTwoPassSunLightTimeCertified, true);
  assert.equal(i.retardedTimeDerivativeBoundsAnalytic, true);
  assert.equal(i.retardedSunSegmentDomainCertified, true);
  assert.equal(i.vondrakPrecessionMatrixCertified, true);
  assert.equal(i.lightTimePrecessedXySeparationContinuous, true);
  assert.equal(i.lightTimePrecessedRaSecondDerivativeCertified, true);

  assert.equal(i.annualAberrationCertified, false);
  assert.equal(i.gravitationalDeflectionCertified, false);
  assert.equal(i.nutationCertified, false);
  assert.equal(i.apparentPositionCorrectionChainCertified, false);
  assert.equal(i.longTermSiderealSecondDerivativeCertified, false);
  assert.equal(i.swissEotSecondDerivativeCertified, false);
  assert.equal(i.swissEotDerivativeCertified, false);
  assert.equal(i.continuousResidualUpperBound, false);
  assert.equal(i.deterministicMembership, false);
  assert.equal(i.recurrenceAuthorityGranted, false);
});
