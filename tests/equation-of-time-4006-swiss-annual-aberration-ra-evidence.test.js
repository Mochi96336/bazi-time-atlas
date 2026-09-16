import test from "node:test";
import assert from "node:assert/strict";
import { EQUATION_OF_TIME_4006_SWISS_ANNUAL_ABERRATION_RA_EVIDENCE as evidence } from "../src/astronomy/equation-of-time-4006-swiss-annual-aberration-ra-evidence.js";

test("annual aberration evidence freezes canonical source-derived provenance", () => {
  assert.equal(evidence.id, "swiss-eot-4006-annual-aberration-precessed-ra-curvature-v1");
  assert.equal(evidence.targetYear, 4006);
  assert.equal(evidence.provenance.researchPullRequest, 274);
  assert.equal(evidence.provenance.researchHeadSha, "3944a5bbc4272819cfdf8881f04989368c3211e3");
  assert.equal(evidence.provenance.workflowRunId, 35134468788);
  assert.equal(evidence.provenance.artifactId, 10462557713);
  assert.equal(evidence.provenance.artifactDigest, "sha256:b2b99342ab7addf9561ba0db64ee69e7ce92e0cc9ac6f90dd50c0248cb9aad5f");
});

test("source-derived jerk and relativistic aberration denominator remain certified", () => {
  assert.equal(evidence.sourceJerkHardBounds.earthAuPerDayCubed, 0.000044615914125402854);
  assert.equal(evidence.aberrationDimensionlessHardBounds.betaNorm, 0.0005381075735865738);
  assert.equal(evidence.aberrationDimensionlessHardBounds.denominatorLower, 0.9983856772792403);
  assert.ok(evidence.aberrationDimensionlessHardBounds.denominatorLower > 0);
  assert.equal(evidence.interpretation.earthJerkFromChebyshevCoefficientsCertified, true);
  assert.equal(evidence.interpretation.annualAberrationFormulaSourceAudited, true);
  assert.equal(evidence.interpretation.annualAberrationIntervalJetCertified, true);
});

test("annual aberration plus precession RA curvature remains below planning threshold", () => {
  const hard = evidence.derivedHardBounds;
  assert.equal(evidence.sample.gridMinimumIsContinuousLowerBound, false);
  assert.equal(evidence.sample.minSampledAberrationPrecessedXyAu, 0.9090316208270677);
  assert.equal(hard.hardAberrationPrecessedXyLowerAu, 0.8848845176656278);
  assert.equal(hard.aberrationPrecessedRaSecondDerivativeBoundDegPerDaySquared, 6.1009961145499165);
  assert.equal(evidence.planning.priorLightTimePrecessedRaBoundDegPerDaySquared, 5.3521941602424254);
  assert.ok(hard.aberrationPrecessedRaSecondDerivativeBoundDegPerDaySquared < evidence.planning.fullSwissEotSecondDerivativeThresholdDegPerDaySquared);
  assert.equal(evidence.planning.thresholdRemainingAfterAberrationPrecessedBoundDegPerDaySquared, 98.83959544456913);
});

test("annual aberration certificate does not promote nutation, EoT or recurrence authority", () => {
  const i = evidence.interpretation;
  assert.equal(i.sourceDerivedContinuousBound, true);
  assert.equal(i.annualAberrationCertified, true);
  assert.equal(i.aberrationPrecessedRaSecondDerivativeCertified, true);
  assert.equal(i.nutationCertified, false);
  assert.equal(i.apparentPositionCorrectionChainCertified, false);
  assert.equal(i.longTermSiderealSecondDerivativeCertified, false);
  assert.equal(i.swissEotSecondDerivativeCertified, false);
  assert.equal(i.swissEotDerivativeCertified, false);
  assert.equal(i.continuousResidualUpperBound, false);
  assert.equal(i.deterministicMembership, false);
  assert.equal(i.recurrenceAuthorityGranted, false);
});
