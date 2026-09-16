import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_SEGMENT_CURVATURE_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-segment-curvature-evidence.js";

test("SWIEPH segment evidence preserves pinned historical provenance", () => {
  assert.equal(evidence.id, "swiss-eot-4006-swieph-segment-curvature-v1");
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 236);
  assert.equal(evidence.provenance.researchHeadSha, "216b6f3d8b9e5c6f8e05f112fdcd748dac9cb51f");
  assert.equal(evidence.provenance.workflowRunId, 35119332830);
  assert.equal(evidence.provenance.artifactId, 10457205225);
  assert.equal(
    evidence.provenance.artifactDigest,
    "sha256:28a6b53ebad8e759eecd2d59d8494b59cf8a83a1b99afe75343f649285b7ffbb"
  );
});

test("source-derived 3D PVA and distance envelopes remain valid after the RA-frame correction", () => {
  const hard = evidence.derivedHardBounds;
  assert.equal(evidence.interpretation.sourceDerivedPvaCertificateStillValid, true);
  assert.equal(evidence.interpretation.sourceDerivedDistanceCertificateStillValid, true);
  assert.equal(hard.sunRelativeVelocityAuPerDay, 0.18629102131841138);
  assert.equal(hard.sunRelativeAccelerationAuPerDaySquared, 0.004258500764103926);
  assert.equal(hard.hardSunRelativeDistanceLowerAu, 0.9609178462592118);

  for (const body of Object.values(evidence.bodies)) {
    assert.ok(body.segmentCount > 0);
    assert.ok(evidence.method.sampleStepDays <= body.minSegmentDays);
    assert.equal(body.rotatedSegments, body.segmentCount);
    assert.equal(body.referenceEllipseSegments, body.segmentCount);
  }
});

test("legacy #236 XY and RA result is retained only as superseded historical evidence", () => {
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
  assert.equal(evidence.supersession.sampledXyFrame, "ecliptic-cartesian-j2000");

  assert.equal(evidence.derivedHardBounds.minSampledSunRelativeXyAu, 0.9841964643063003);
  assert.equal(
    evidence.derivedHardBounds.geometricJ2000RaSecondDerivativeBoundDegPerDaySquared,
    4.560881140839361
  );
  assert.equal(evidence.interpretation.legacyRaClaimSuperseded, true);
  assert.equal(evidence.interpretation.validForRightAscension, false);
  assert.equal(evidence.interpretation.geometricJ2000RaSecondDerivativeBoundAnalytic, false);
});

test("legacy segment evidence never promotes itself into Swiss EoT authority", () => {
  const i = evidence.interpretation;
  assert.equal(i.apparentPositionCorrectionChainCertified, false);
  assert.equal(i.longTermSiderealSecondDerivativeCertified, false);
  assert.equal(i.swissEotSecondDerivativeCertified, false);
  assert.equal(i.swissEotDerivativeCertified, false);
  assert.equal(i.continuousResidualUpperBound, false);
  assert.equal(i.deterministicMembership, false);
  assert.equal(i.recurrenceAuthorityGranted, false);
});
