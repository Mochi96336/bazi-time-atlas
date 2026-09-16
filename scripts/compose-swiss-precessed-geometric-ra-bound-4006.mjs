#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EQUATION_OF_TIME_4006_SWISS_SEGMENT_CURVATURE_EVIDENCE as segment } from "../src/astronomy/equation-of-time-4006-swiss-segment-curvature-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_VONDRAK_PRECESSION_EVIDENCE as precession } from "../src/astronomy/equation-of-time-4006-swiss-vondrak-precession-evidence.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = process.env.RAW_MANIFEST ?? path.join(here, "../tmp/swiss-precessed-geometric-ra-bound-4006/raw.json");
const outputPath = process.env.OUTPUT_MANIFEST ?? path.join(here, "../tmp/swiss-precessed-geometric-ra-bound-4006/manifest.json");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

function assertClose(actual, expected, label, tolerance = 5e-15) {
  const scale = Math.max(1, Math.abs(expected));
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance * scale) {
    throw new Error(`${label} mismatch: actual=${actual}, expected=${expected}`);
  }
}

if (raw.targetYear !== 4006 || segment.targetYear !== 4006 || precession.targetYear !== 4006) {
  throw new Error("year-4006 proof inputs are not aligned");
}
if (segment.provenance.swissUpstreamCommit !== precession.provenance.swissUpstreamCommit) {
  throw new Error("source certificates do not share the same pinned Swiss commit");
}
if (!segment.interpretation.sourceDerivedContinuousBound || !precession.interpretation.sourceDerivedContinuousBound) {
  throw new Error("composition requires both source-derived continuous certificates");
}
if (!segment.interpretation.chebyshevSegmentPositionVelocityAccelerationBoundsAnalytic) {
  throw new Error("SWIEPH position/velocity/acceleration envelope is not certified");
}
if (!precession.interpretation.precessionMatrixFirstDerivativeCertified ||
    !precession.interpretation.precessionMatrixSecondDerivativeCertified) {
  throw new Error("Vondrak matrix derivative certificate is incomplete");
}
if (raw.interpretation.gridMinimumIsContinuousLowerBound !== false) {
  throw new Error("raw grid evidence must not self-promote to a continuous bound");
}

for (const key of ["earthMoonBarycenter", "sunBarycenter", "moonGeocentric"]) {
  const r = raw.bodies[key];
  const e = segment.bodies[key];
  assertClose(r.maxPositionCoefficientEnvelopeAu, e.maxPositionCoefficientEnvelopeAu, `${key}.position`);
  assertClose(r.maxVelocityBoundAuPerDay, e.maxVelocityBoundAuPerDay, `${key}.velocity`);
  assertClose(r.maxAccelerationBoundAuPerDaySquared, e.maxAccelerationBoundAuPerDaySquared, `${key}.acceleration`);
}
assertClose(raw.earthMoonMassRatio, segment.derivedHardBounds.earthMoonMassRatio, "earthMoonMassRatio");

const positionJ2000 = segment.derivedHardBounds.sunRelativePositionCoefficientEnvelopeAu;
const velocityJ2000 = segment.derivedHardBounds.sunRelativeVelocityAuPerDay;
const accelerationJ2000 = segment.derivedHardBounds.sunRelativeAccelerationAuPerDaySquared;
const r1 = precession.precessionMatrixHardBounds.firstDerivativeOperatorNormPerDay;
const r2 = precession.precessionMatrixHardBounds.secondDerivativeOperatorNormPerDaySquared;

const velocityMeanOfDate = velocityJ2000 + r1 * positionJ2000;
const accelerationMeanOfDate = accelerationJ2000 + 2 * r1 * velocityJ2000 + r2 * positionJ2000;
const hardPrecessedXyLowerAu = raw.minSampledPrecessedXyAu
  - velocityMeanOfDate * raw.sampleCoverRadiusEtDays;
if (!(hardPrecessedXyLowerAu > 0)) {
  throw new Error(`precessed XY lower bound is not positive: ${hardPrecessedXyLowerAu}`);
}

const raSecondDerivativeBoundRadPerDaySquared = accelerationMeanOfDate / hardPrecessedXyLowerAu
  + 2 * velocityMeanOfDate * velocityMeanOfDate / (hardPrecessedXyLowerAu ** 2);
const raSecondDerivativeBoundDegPerDaySquared = raSecondDerivativeBoundRadPerDaySquared * 180 / Math.PI;
const fullThreshold = segment.planning.fullSwissEotSecondDerivativeThresholdDegPerDaySquared;

const manifest = {
  targetYear: 4006,
  method: "swieph-geometric-j2000-plus-vondrak-precession-ra-curvature-envelope-v1",
  provenance: {
    swissUpstreamCommit: segment.provenance.swissUpstreamCommit,
    sourceGeometryEvidenceId: segment.id,
    precessionMatrixEvidenceId: precession.id,
    rawSamplerMethod: raw.method,
  },
  domain: raw.domain,
  sample: {
    intervals: raw.sampleIntervals,
    stepEtDays: raw.sampleStepEtDays,
    coverRadiusEtDays: raw.sampleCoverRadiusEtDays,
    minSampledPrecessedXyAu: raw.minSampledPrecessedXyAu,
    minSampleIndex: raw.minSampleIndex,
    minSampleEtJd: raw.minSampleEtJd,
  },
  inputHardBounds: {
    geometricJ2000PositionAu: positionJ2000,
    geometricJ2000VelocityAuPerDay: velocityJ2000,
    geometricJ2000AccelerationAuPerDaySquared: accelerationJ2000,
    precessionMatrixFirstDerivativeOperatorNormPerDay: r1,
    precessionMatrixSecondDerivativeOperatorNormPerDaySquared: r2,
  },
  derivedHardBounds: {
    meanOfDateGeometricPositionAu: positionJ2000,
    meanOfDateGeometricVelocityAuPerDay: velocityMeanOfDate,
    meanOfDateGeometricAccelerationAuPerDaySquared: accelerationMeanOfDate,
    hardMeanOfDateGeometricXyLowerAu: hardPrecessedXyLowerAu,
    meanOfDateGeometricRaSecondDerivativeBoundRadPerDaySquared: raSecondDerivativeBoundRadPerDaySquared,
    meanOfDateGeometricRaSecondDerivativeBoundDegPerDaySquared: raSecondDerivativeBoundDegPerDaySquared,
  },
  planning: {
    fullSwissEotSecondDerivativeThresholdDegPerDaySquared: fullThreshold,
    geometricMeanOfDateFractionOfThreshold: raSecondDerivativeBoundDegPerDaySquared / fullThreshold,
    thresholdRemainingAfterGeometricMeanOfDateBoundDegPerDaySquared: fullThreshold - raSecondDerivativeBoundDegPerDaySquared,
  },
  proof: {
    transformedVelocityInequality: "|(R x)'| <= |x'| + ||R'|| |x|",
    transformedAccelerationInequality: "|(R x)''| <= |x''| + 2 ||R'|| |x'| + ||R''|| |x|",
    betweenSampleXyLowerBound: "rho(t) >= rho(sample) - V_mean_of_date * cover_radius",
    raCurvatureInequality: "|alpha''| <= A_xy/rho + 2 V_xy^2/rho^2",
    full3dVelocityAccelerationUsedForXy: true,
  },
  interpretation: {
    sourceDerivedContinuousBound: true,
    geometricJ2000InputCertified: true,
    vondrakPrecessionMatrixCertified: true,
    precessedGeometricXySeparationContinuous: true,
    meanOfDateGeometricRaSecondDerivativeCertified: true,
    actualSwissPrecessionCorrectionCertified: false,
    lightTimeCorrectionCertified: false,
    aberrationCorrectionCertified: false,
    deflectionCorrectionCertified: false,
    nutationCorrectionCertified: false,
    apparentPositionCorrectionChainCertified: false,
    longTermSiderealSecondDerivativeCertified: false,
    swissEotSecondDerivativeCertified: false,
    continuousResidualUpperBound: false,
    deterministicMembership: false,
    recurrenceAuthorityGranted: false,
    reason: "The merged SWIEPH geometric J2000 envelope and Vondrak matrix derivative certificate compose into a continuous RA-curvature bound for the geometric Sun vector after precession to mean-of-date. Swiss light-time, aberration, deflection and nutation remain outside this certificate, so this is not yet the actual apparent-Sun or EoT curvature bound."
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
