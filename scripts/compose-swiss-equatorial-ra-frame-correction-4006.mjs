#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EQUATION_OF_TIME_4006_SWISS_SEGMENT_CURVATURE_EVIDENCE as segment } from "../src/astronomy/equation-of-time-4006-swiss-segment-curvature-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_VONDRAK_PRECESSION_EVIDENCE as precession } from "../src/astronomy/equation-of-time-4006-swiss-vondrak-precession-evidence.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = process.env.RAW_MANIFEST ?? path.join(here, "../tmp/swiss-equatorial-ra-frame-correction-4006/raw.json");
const outputPath = process.env.OUTPUT_MANIFEST ?? path.join(here, "../tmp/swiss-equatorial-ra-frame-correction-4006/manifest.json");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

if (raw.targetYear !== 4006 || segment.targetYear !== 4006 || precession.targetYear !== 4006) {
  throw new Error("year-4006 correction inputs are not aligned");
}
if (!segment.interpretation.sourceDerivedContinuousBound ||
    !segment.interpretation.chebyshevSegmentPositionVelocityAccelerationBoundsAnalytic) {
  throw new Error("SWIEPH P/V/A source certificate is unavailable");
}
if (!precession.interpretation.precessionMatrixFirstDerivativeCertified ||
    !precession.interpretation.precessionMatrixSecondDerivativeCertified) {
  throw new Error("Vondrak matrix derivative certificate is unavailable");
}
if (!raw.interpretation.equatorialFlagExplicit ||
    !raw.interpretation.j2000SampleIsEquatorial ||
    !raw.interpretation.meanOfDateSampleIsEquatorial ||
    raw.interpretation.gridMinimumIsContinuousLowerBound !== false) {
  throw new Error("corrected raw sampler did not preserve the RA-frame contract");
}

const position = segment.derivedHardBounds.sunRelativePositionCoefficientEnvelopeAu;
const velocity = segment.derivedHardBounds.sunRelativeVelocityAuPerDay;
const acceleration = segment.derivedHardBounds.sunRelativeAccelerationAuPerDaySquared;
const cover = raw.sampleCoverRadiusEtDays;

const hardJ2000Xy = raw.j2000.minSampledEquatorialXyAu - velocity * cover;
if (!(hardJ2000Xy > 0)) throw new Error("corrected J2000 equatorial XY lower bound is not positive");
const j2000RaRad = acceleration / hardJ2000Xy + 2 * velocity * velocity / (hardJ2000Xy * hardJ2000Xy);
const j2000RaDeg = j2000RaRad * 180 / Math.PI;

const r1 = precession.precessionMatrixHardBounds.firstDerivativeOperatorNormPerDay;
const r2 = precession.precessionMatrixHardBounds.secondDerivativeOperatorNormPerDaySquared;
const modVelocity = velocity + r1 * position;
const modAcceleration = acceleration + 2 * r1 * velocity + r2 * position;
const hardModXy = raw.meanOfDate.minSampledEquatorialXyAu - modVelocity * cover;
if (!(hardModXy > 0)) throw new Error("corrected mean-of-date equatorial XY lower bound is not positive");
const modRaRad = modAcceleration / hardModXy + 2 * modVelocity * modVelocity / (hardModXy * hardModXy);
const modRaDeg = modRaRad * 180 / Math.PI;
const threshold = segment.planning.fullSwissEotSecondDerivativeThresholdDegPerDaySquared;

const manifest = {
  targetYear: 4006,
  method: "swiss-equatorial-ra-frame-correction-continuous-envelope-v1",
  provenance: {
    swissUpstreamCommit: segment.provenance.swissUpstreamCommit,
    sourcePvaEvidenceId: segment.id,
    precessionMatrixEvidenceId: precession.id,
    supersedesLegacyClaimsFromPullRequests: [236, 257],
  },
  defect: {
    id: "missing-seflg-equatorial-in-legacy-geometric-ra-samplers",
    legacy236CoordinateFrame: "ecliptic-cartesian-j2000",
    legacy257InputFrameToSwiPrecess: "ecliptic-cartesian-j2000",
    reason: "SEFLG_XYZ does not imply equatorial coordinates; SEFLG_EQUATORIAL must be explicit before interpreting XY as right ascension or feeding a vector to equatorial precession.",
  },
  domain: raw.domain,
  sample: {
    intervals: raw.sampleIntervals,
    stepEtDays: raw.sampleStepEtDays,
    coverRadiusEtDays: cover,
    j2000: raw.j2000,
    meanOfDate: raw.meanOfDate,
    gridMinimumIsContinuousLowerBound: false,
  },
  inputHardBounds: {
    geometricPositionAu: position,
    geometricVelocityAuPerDay: velocity,
    geometricAccelerationAuPerDaySquared: acceleration,
    precessionMatrixFirstDerivativeOperatorNormPerDay: r1,
    precessionMatrixSecondDerivativeOperatorNormPerDaySquared: r2,
  },
  correctedHardBounds: {
    hardJ2000EquatorialXyLowerAu: hardJ2000Xy,
    geometricJ2000RaSecondDerivativeBoundRadPerDaySquared: j2000RaRad,
    geometricJ2000RaSecondDerivativeBoundDegPerDaySquared: j2000RaDeg,
    meanOfDateGeometricVelocityAuPerDay: modVelocity,
    meanOfDateGeometricAccelerationAuPerDaySquared: modAcceleration,
    hardMeanOfDateEquatorialXyLowerAu: hardModXy,
    meanOfDateGeometricRaSecondDerivativeBoundRadPerDaySquared: modRaRad,
    meanOfDateGeometricRaSecondDerivativeBoundDegPerDaySquared: modRaDeg,
  },
  planning: {
    fullSwissEotSecondDerivativeThresholdDegPerDaySquared: threshold,
    j2000FractionOfThreshold: j2000RaDeg / threshold,
    meanOfDateFractionOfThreshold: modRaDeg / threshold,
    thresholdRemainingAfterMeanOfDateBoundDegPerDaySquared: threshold - modRaDeg,
  },
  proof: {
    betweenSampleXyLowerBound: "rho(t) >= rho(sample) - V * cover_radius",
    transformedVelocityInequality: "|(R x)'| <= |x'| + ||R'|| |x|",
    transformedAccelerationInequality: "|(R x)''| <= |x''| + 2 ||R'|| |x'| + ||R''|| |x|",
    raCurvatureInequality: "|alpha''| <= A_xy/rho + 2 V_xy^2/rho^2",
    full3dVelocityAccelerationUsedForXy: true,
  },
  interpretation: {
    coordinateFrameCorrectionCertified: true,
    legacy236RaClaimSuperseded: true,
    legacy257RaClaimSuperseded: true,
    sourceDerivedPvaCertificateStillValid: true,
    sourceDerivedDistanceCertificateStillValid: true,
    geometricJ2000RaSecondDerivativeCertified: true,
    meanOfDateGeometricRaSecondDerivativeCertified: true,
    lightTimeCorrectionCertified: false,
    annualAberrationCertified: false,
    nutationCertified: false,
    apparentPositionCorrectionChainCertified: false,
    longTermSiderealSecondDerivativeCertified: false,
    swissEotSecondDerivativeCertified: false,
    continuousResidualUpperBound: false,
    deterministicMembership: false,
    recurrenceAuthorityGranted: false,
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
