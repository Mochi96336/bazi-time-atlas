#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EQUATION_OF_TIME_4006_SWISS_SEGMENT_CURVATURE_EVIDENCE as segment } from "../src/astronomy/equation-of-time-4006-swiss-segment-curvature-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_VONDRAK_PRECESSION_EVIDENCE as precession } from "../src/astronomy/equation-of-time-4006-swiss-vondrak-precession-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_RA_FRAME_CORRECTION_EVIDENCE as geometricMeanOfDate } from "../src/astronomy/equation-of-time-4006-swiss-ra-frame-correction-evidence.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = process.env.RAW_MANIFEST ?? path.join(here, "../tmp/swiss-light-time-ra-bound-4006/raw.json");
const outputPath = process.env.OUTPUT_MANIFEST ?? path.join(here, "../tmp/swiss-light-time-ra-bound-4006/manifest.json");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

function assertClose(actual, expected, label, tolerance = 5e-15) {
  const scale = Math.max(1, Math.abs(expected));
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance * scale) {
    throw new Error(`${label} mismatch: actual=${actual}, expected=${expected}`);
  }
}

if (raw.targetYear !== 4006 || segment.targetYear !== 4006 || precession.targetYear !== 4006 || geometricMeanOfDate.targetYear !== 4006) {
  throw new Error("year-4006 proof inputs are not aligned");
}
if (segment.provenance.swissUpstreamCommit !== precession.provenance.swissUpstreamCommit ||
    segment.provenance.swissUpstreamCommit !== geometricMeanOfDate.provenance.swissUpstreamCommit) {
  throw new Error("source certificates do not share the same pinned Swiss commit");
}
if (!segment.interpretation.chebyshevSegmentPositionVelocityAccelerationBoundsAnalytic ||
    !precession.interpretation.precessionMatrixFirstDerivativeCertified ||
    !precession.interpretation.precessionMatrixSecondDerivativeCertified ||
    !geometricMeanOfDate.interpretation.coordinateFrameCorrectionCertified ||
    !geometricMeanOfDate.interpretation.meanOfDateGeometricRaSecondDerivativeCertified) {
  throw new Error("required source-derived certificates are incomplete");
}
if (geometricMeanOfDate.defect.supersedesPullRequests?.includes(257) !== true) {
  throw new Error("corrected RA-frame evidence does not supersede the historical #257 claim");
}
if (raw.interpretation.gridMinimumIsContinuousLowerBound !== false ||
    raw.interpretation.continuousRaCurvatureCertified !== false) {
  throw new Error("raw light-time grid must remain non-authoritative");
}
if (!raw.interpretation.swissTwoPassSunLightTimeEnabled ||
    !raw.interpretation.annualAberrationDisabled ||
    !raw.interpretation.nutationDisabled ||
    !raw.interpretation.vondrakPrecessionEnabled) {
  throw new Error("raw sampler scope does not isolate light-time plus precession");
}

for (const key of ["earthMoonBarycenter", "sunBarycenter", "moonGeocentric"]) {
  const r = raw.bodies[key];
  const e = segment.bodies[key];
  assertClose(r.maxPositionCoefficientEnvelopeAu, e.maxPositionCoefficientEnvelopeAu, `${key}.position`);
  assertClose(r.maxVelocityBoundAuPerDay, e.maxVelocityBoundAuPerDay, `${key}.velocity`);
  assertClose(r.maxAccelerationBoundAuPerDaySquared, e.maxAccelerationBoundAuPerDaySquared, `${key}.acceleration`);
}
assertClose(raw.earthMoonMassRatio, segment.derivedHardBounds.earthMoonMassRatio, "earthMoonMassRatio");

const k = raw.lightTimeDaysPerAu;
if (!(Number.isFinite(k) && k > 0 && k < 0.01)) {
  throw new Error(`unexpected Swiss light-time scale ${k}`);
}

const sun = segment.bodies.sunBarycenter;
const pSun = sun.maxPositionCoefficientEnvelopeAu;
const vSun = sun.maxVelocityBoundAuPerDay;
const aSun = sun.maxAccelerationBoundAuPerDaySquared;
const pEarth = segment.derivedHardBounds.earthPositionCoefficientEnvelopeAu;
const vEarth = segment.derivedHardBounds.earthVelocityAuPerDay;
const aEarth = segment.derivedHardBounds.earthAccelerationAuPerDaySquared;
const pRelative = segment.derivedHardBounds.sunRelativePositionCoefficientEnvelopeAu;
const vRelative0 = segment.derivedHardBounds.sunRelativeVelocityAuPerDay;
const aRelative0 = segment.derivedHardBounds.sunRelativeAccelerationAuPerDaySquared;
const r0Lower = segment.derivedHardBounds.hardSunRelativeDistanceLowerAu;

assertClose(pEarth + pSun, pRelative, "relative position envelope", 2e-14);
assertClose(vEarth + vSun, vRelative0, "relative velocity envelope", 2e-14);
assertClose(aEarth + aSun, aRelative0, "relative acceleration envelope", 2e-14);

/* Swiss geocentric Sun SWIEPH path:
 *   tau0 = |E(t)-S(t)|/c
 *   S1   = S(t-tau0)
 *   tau1 = |E(t)-S1|/c
 *   S2   = S(t-tau1)
 *   Y    = S2-E(t)
 * before aberration/precession.  For r=|R|,
 * |r'| <= V and |r''| <= A + V^2/r_min.
 */
const tau0MaxDays = k * pRelative;
const tau0PrimeAbs = k * vRelative0;
const tau0SecondAbsPerDay = k * (aRelative0 + vRelative0 * vRelative0 / r0Lower);
const u0PrimeAbs = 1 + tau0PrimeAbs;
const sun1Velocity = vSun * u0PrimeAbs;
const sun1Acceleration = aSun * u0PrimeAbs * u0PrimeAbs + vSun * tau0SecondAbsPerDay;

const r1Lower = r0Lower - vSun * tau0MaxDays;
if (!(r1Lower > 0)) {
  throw new Error(`first retarded distance lower bound is not positive: ${r1Lower}`);
}
const vRelative1 = vEarth + sun1Velocity;
const aRelative1 = aEarth + sun1Acceleration;
const tau1MaxDays = k * pRelative;
const tau1PrimeAbs = k * vRelative1;
const tau1SecondAbsPerDay = k * (aRelative1 + vRelative1 * vRelative1 / r1Lower);
const u1PrimeAbs = 1 + tau1PrimeAbs;

const lightTimePosition = pRelative;
const lightTimeVelocity = vEarth + vSun * u1PrimeAbs;
const lightTimeAcceleration = aEarth
  + aSun * u1PrimeAbs * u1PrimeAbs
  + vSun * tau1SecondAbsPerDay;

/* The constant ICRS->J2000 bias is a norm-preserving rotation. Then Swiss
 * applies the certified time-dependent Vondrak matrix. */
const matrixFirst = precession.precessionMatrixHardBounds.firstDerivativeOperatorNormPerDay;
const matrixSecond = precession.precessionMatrixHardBounds.secondDerivativeOperatorNormPerDaySquared;
const precessedVelocity = lightTimeVelocity + matrixFirst * lightTimePosition;
const precessedAcceleration = lightTimeAcceleration
  + 2 * matrixFirst * lightTimeVelocity
  + matrixSecond * lightTimePosition;

const tauDomainStart = raw.domain.startEtJd - Math.max(tau0MaxDays, tau1MaxDays);
const sunCoverage = raw.bodies.sunBarycenter;
if (!(sunCoverage.firstTseg0 <= tauDomainStart && sunCoverage.lastTseg1 >= raw.domain.endEtJd)) {
  throw new Error(`retarded Sun domain is outside inspected SWIEPH segments: ${tauDomainStart}`);
}
const earthCoverage = raw.bodies.earthMoonBarycenter;
const moonCoverage = raw.bodies.moonGeocentric;
for (const [name, coverage] of [["earth", earthCoverage], ["moon", moonCoverage]]) {
  if (!(coverage.firstTseg0 <= raw.domain.startEtJd && coverage.lastTseg1 >= raw.domain.endEtJd)) {
    throw new Error(`${name} SWIEPH coverage does not span the observation-time domain`);
  }
}

const hardXyLowerAu = raw.minSampledLightTimePrecessedXyAu
  - precessedVelocity * raw.sampleCoverRadiusEtDays;
if (!(hardXyLowerAu > 0)) {
  throw new Error(`light-time precessed XY lower bound is not positive: ${hardXyLowerAu}`);
}
const raSecondRad = precessedAcceleration / hardXyLowerAu
  + 2 * precessedVelocity * precessedVelocity / (hardXyLowerAu * hardXyLowerAu);
const raSecondDeg = raSecondRad * 180 / Math.PI;
const fullThreshold = geometricMeanOfDate.planning.fullSwissEotSecondDerivativeThresholdDegPerDaySquared;

const manifest = {
  targetYear: 4006,
  method: "swieph-two-pass-sun-light-time-plus-vondrak-ra-curvature-envelope-v1",
  provenance: {
    swissUpstreamCommit: segment.provenance.swissUpstreamCommit,
    sourceGeometryEvidenceId: segment.id,
    precessionMatrixEvidenceId: precession.id,
    geometricMeanOfDateEvidenceId: geometricMeanOfDate.id,
    rawSamplerMethod: raw.method,
  },
  domain: raw.domain,
  sample: {
    intervals: raw.sampleIntervals,
    stepEtDays: raw.sampleStepEtDays,
    coverRadiusEtDays: raw.sampleCoverRadiusEtDays,
    minSampledLightTimePrecessedXyAu: raw.minSampledLightTimePrecessedXyAu,
    minSampleIndex: raw.minSampleIndex,
    minSampleEtJd: raw.minSampleEtJd,
    gridMinimumIsContinuousLowerBound: false,
  },
  lightTimeSourceConstant: {
    daysPerAu: k,
  },
  retardedTimeHardBounds: {
    tau0MaxDays,
    tau0PrimeAbs,
    tau0SecondAbsPerDay,
    firstRetardedDistanceLowerAu: r1Lower,
    firstRetardedSunVelocityAuPerDay: sun1Velocity,
    firstRetardedSunAccelerationAuPerDaySquared: sun1Acceleration,
    tau1MaxDays,
    tau1PrimeAbs,
    tau1SecondAbsPerDay,
    retardedSunDomainStartEtJd: tauDomainStart,
    inspectedSunSegmentStartEtJd: sunCoverage.firstTseg0,
    inspectedSunSegmentEndEtJd: sunCoverage.lastTseg1,
  },
  derivedHardBounds: {
    lightTimeGeometricPositionAu: lightTimePosition,
    lightTimeGeometricVelocityAuPerDay: lightTimeVelocity,
    lightTimeGeometricAccelerationAuPerDaySquared: lightTimeAcceleration,
    lightTimePrecessedVelocityAuPerDay: precessedVelocity,
    lightTimePrecessedAccelerationAuPerDaySquared: precessedAcceleration,
    hardLightTimePrecessedXyLowerAu: hardXyLowerAu,
    lightTimePrecessedRaSecondDerivativeBoundRadPerDaySquared: raSecondRad,
    lightTimePrecessedRaSecondDerivativeBoundDegPerDaySquared: raSecondDeg,
  },
  planning: {
    fullSwissEotSecondDerivativeThresholdDegPerDaySquared: fullThreshold,
    lightTimePrecessedFractionOfThreshold: raSecondDeg / fullThreshold,
    thresholdRemainingAfterLightTimePrecessedBoundDegPerDaySquared: fullThreshold - raSecondDeg,
    priorGeometricMeanOfDateRaBoundDegPerDaySquared:
      geometricMeanOfDate.correctedHardBounds.meanOfDateGeometricRaSecondDerivativeBoundDegPerDaySquared,
  },
  proof: {
    distanceDerivativeBound: "|r'| <= V",
    distanceSecondDerivativeBound: "|r''| <= A + V^2/r_min",
    retardedVelocityBound: "|S(t-tau)'| <= V_s(1+|tau'|)",
    retardedAccelerationBound: "|S(t-tau)''| <= A_s(1+|tau'|)^2 + V_s|tau''|",
    transformedVelocityInequality: "|(R x)'| <= |x'| + ||R'|| |x|",
    transformedAccelerationInequality: "|(R x)''| <= |x''| + 2 ||R'|| |x'| + ||R''|| |x|",
    betweenSampleXyLowerBound: "rho(t) >= rho(sample) - V_light_time_precessed * cover_radius",
    raCurvatureInequality: "|alpha''| <= A_xy/rho + 2 V_xy^2/rho^2",
    full3dVelocityAccelerationUsedForXy: true,
    retardedSunDomainCoveredByInspectedChebyshevSegments: true,
  },
  interpretation: {
    sourceDerivedContinuousBound: true,
    correctedRaFrameEvidenceRequired: true,
    swissTwoPassSunLightTimeCertified: true,
    retardedTimeDerivativeBoundsAnalytic: true,
    retardedSunSegmentDomainCertified: true,
    vondrakPrecessionMatrixCertified: true,
    lightTimePrecessedXySeparationContinuous: true,
    lightTimePrecessedRaSecondDerivativeCertified: true,
    annualAberrationCertified: false,
    gravitationalDeflectionCertified: false,
    nutationCertified: false,
    apparentPositionCorrectionChainCertified: false,
    longTermSiderealSecondDerivativeCertified: false,
    swissEotSecondDerivativeCertified: false,
    swissEotDerivativeCertified: false,
    continuousResidualUpperBound: false,
    deterministicMembership: false,
    recurrenceAuthorityGranted: false,
    reason: "Pinned SWIEPH segment kinematics, the exact two-pass geocentric Sun light-time structure, the corrected equatorial RA-frame evidence, and the Vondrak matrix certificate compose into a continuous RA-curvature bound after light-time and precession. Annual aberration, nutation and long-term sidereal curvature remain outside this certificate."
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
