#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EQUATION_OF_TIME_4006_SWISS_SEGMENT_CURVATURE_EVIDENCE as segment } from "../src/astronomy/equation-of-time-4006-swiss-segment-curvature-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_VONDRAK_PRECESSION_EVIDENCE as precession } from "../src/astronomy/equation-of-time-4006-swiss-vondrak-precession-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_LIGHT_TIME_RA_EVIDENCE as lightTime } from "../src/astronomy/equation-of-time-4006-swiss-light-time-ra-evidence.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = process.env.RAW_MANIFEST ?? path.join(here, "../tmp/swiss-annual-aberration-ra-bound-4006/raw.json");
const outputPath = process.env.OUTPUT_MANIFEST ?? path.join(here, "../tmp/swiss-annual-aberration-ra-bound-4006/manifest.json");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

function assertClose(actual, expected, label, tolerance = 5e-15) {
  const scale = Math.max(1, Math.abs(expected));
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance * scale) {
    throw new Error(`${label} mismatch: actual=${actual}, expected=${expected}`);
  }
}

function interval(lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) throw new Error(`invalid interval [${lo}, ${hi}]`);
  return { lo, hi };
}
function point(x) { return interval(x, x); }
function sym(r) {
  if (!(Number.isFinite(r) && r >= 0)) throw new Error(`invalid symmetric radius ${r}`);
  return interval(-r, r);
}
function addI(a, b) { return interval(a.lo + b.lo, a.hi + b.hi); }
function negI(a) { return interval(-a.hi, -a.lo); }
function subI(a, b) { return addI(a, negI(b)); }
function mulI(a, b) {
  const p = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
  return interval(Math.min(...p), Math.max(...p));
}
function squareI(a) {
  if (a.lo <= 0 && a.hi >= 0) return interval(0, Math.max(a.lo * a.lo, a.hi * a.hi));
  const x = a.lo * a.lo;
  const y = a.hi * a.hi;
  return interval(Math.min(x, y), Math.max(x, y));
}
function invI(a) {
  if (a.lo <= 0 && a.hi >= 0) throw new Error(`interval crosses zero [${a.lo}, ${a.hi}]`);
  return interval(1 / a.hi, 1 / a.lo);
}
function divI(a, b) { return mulI(a, invI(b)); }
function sqrtI(a) {
  if (!(a.lo > 0)) throw new Error(`sqrt interval is not strictly positive [${a.lo}, ${a.hi}]`);
  return interval(Math.sqrt(a.lo), Math.sqrt(a.hi));
}
function maxAbsI(a) { return Math.max(Math.abs(a.lo), Math.abs(a.hi)); }
function scaleI(a, c) { return c >= 0 ? interval(a.lo * c, a.hi * c) : interval(a.hi * c, a.lo * c); }

function jet(v, d = point(0), dd = point(0)) { return { v, d, dd }; }
function constJ(x) { return jet(point(x)); }
function addJ(a, b) { return jet(addI(a.v, b.v), addI(a.d, b.d), addI(a.dd, b.dd)); }
function negJ(a) { return jet(negI(a.v), negI(a.d), negI(a.dd)); }
function subJ(a, b) { return addJ(a, negJ(b)); }
function mulJ(a, b) {
  return jet(
    mulI(a.v, b.v),
    addI(mulI(a.d, b.v), mulI(a.v, b.d)),
    addI(addI(mulI(a.dd, b.v), scaleI(mulI(a.d, b.d), 2)), mulI(a.v, b.dd))
  );
}
function squareJ(a) {
  return jet(
    squareI(a.v),
    scaleI(mulI(a.v, a.d), 2),
    scaleI(addI(squareI(a.d), mulI(a.v, a.dd)), 2)
  );
}
function invJ(a) {
  const v2 = squareI(a.v);
  const v3 = mulI(v2, a.v);
  return jet(
    invI(a.v),
    negI(divI(a.d, v2)),
    subI(scaleI(divI(squareI(a.d), v3), 2), divI(a.dd, v2))
  );
}
function divJ(a, b) { return mulJ(a, invJ(b)); }
function sqrtJ(a) {
  const y = sqrtI(a.v);
  const twoY = scaleI(y, 2);
  const y3 = mulI(squareI(y), y);
  return jet(
    y,
    divI(a.d, twoY),
    subI(divI(a.dd, twoY), divI(squareI(a.d), scaleI(y3, 4)))
  );
}
function sumJ(values) { return values.reduce((a, b) => addJ(a, b), constJ(0)); }

if (raw.targetYear !== 4006 || segment.targetYear !== 4006 || precession.targetYear !== 4006 || lightTime.targetYear !== 4006) {
  throw new Error("year-4006 proof inputs are not aligned");
}
if (segment.provenance.swissUpstreamCommit !== precession.provenance.swissUpstreamCommit ||
    segment.provenance.swissUpstreamCommit !== lightTime.provenance.swissUpstreamCommit) {
  throw new Error("source certificates do not share the same pinned Swiss commit");
}
if (!segment.interpretation.chebyshevSegmentPositionVelocityAccelerationBoundsAnalytic ||
    !precession.interpretation.precessionMatrixFirstDerivativeCertified ||
    !precession.interpretation.precessionMatrixSecondDerivativeCertified ||
    !lightTime.interpretation.swissTwoPassSunLightTimeCertified ||
    !lightTime.interpretation.correctedRaFrameEvidenceRequired) {
  throw new Error("required lower-layer certificates are incomplete");
}
if (!raw.interpretation.annualAberrationEnabled || !raw.interpretation.nutationDisabled ||
    !raw.interpretation.vondrakPrecessionEnabled || raw.interpretation.gridMinimumIsContinuousLowerBound !== false) {
  throw new Error("raw aberration sampler scope is invalid");
}

for (const key of ["earthMoonBarycenter", "sunBarycenter", "moonGeocentric"]) {
  const r = raw.bodies[key];
  const e = segment.bodies[key];
  assertClose(r.maxPositionCoefficientEnvelopeAu, e.maxPositionCoefficientEnvelopeAu, `${key}.position`);
  assertClose(r.maxVelocityBoundAuPerDay, e.maxVelocityBoundAuPerDay, `${key}.velocity`);
  assertClose(r.maxAccelerationBoundAuPerDaySquared, e.maxAccelerationBoundAuPerDaySquared, `${key}.acceleration`);
  if (!(Number.isFinite(r.maxJerkBoundAuPerDayCubed) && r.maxJerkBoundAuPerDayCubed >= 0)) {
    throw new Error(`${key}.jerk is invalid`);
  }
}
assertClose(raw.earthMoonMassRatio, segment.derivedHardBounds.earthMoonMassRatio, "earthMoonMassRatio");

const massRatio = raw.earthMoonMassRatio;
const earthJerk = raw.bodies.earthMoonBarycenter.maxJerkBoundAuPerDayCubed
  + raw.bodies.moonGeocentric.maxJerkBoundAuPerDayCubed / (massRatio + 1);
const earthVelocity = segment.derivedHardBounds.earthVelocityAuPerDay;
const earthAcceleration = segment.derivedHardBounds.earthAccelerationAuPerDaySquared;
const k = lightTime.lightTimeSourceConstant.daysPerAu;
const beta = k * earthVelocity;
const betaPrime = k * earthAcceleration;
const betaSecond = k * earthJerk;

const p = lightTime.derivedHardBounds.lightTimeGeometricPositionAu;
const v = lightTime.derivedHardBounds.lightTimeGeometricVelocityAuPerDay;
const a = lightTime.derivedHardBounds.lightTimeGeometricAccelerationAuPerDaySquared;
const rMin = lightTime.retardedTimeHardBounds.firstRetardedDistanceLowerAu;
if (!(rMin > 0)) throw new Error("light-time distance lower bound is invalid");
const nPrime = v / rMin;
const nSecond = a / rMin + 3 * v * v / (rMin * rMin);
const rSecond = a + v * v / rMin;

const n = Array.from({ length: 3 }, () => jet(sym(1), sym(nPrime), sym(nSecond)));
const bvec = Array.from({ length: 3 }, () => jet(sym(beta), sym(betaPrime), sym(betaSecond)));
const beta2 = sumJ(bvec.map(squareJ));
const oneMinusBeta2 = subJ(constJ(1), beta2);
const lorentzB = sqrtJ(oneMinusBeta2);
const s = sumJ(n.map((ni, i) => mulJ(ni, bvec[i])));
const onePlusB = addJ(constJ(1), lorentzB);
const f2 = addJ(constJ(1), divJ(s, onePlusB));
const denom = addJ(constJ(1), s);
if (!(denom.v.lo > 0)) throw new Error(`aberration denominator is not certified positive: ${denom.v.lo}`);
const coefficient = subJ(subJ(lorentzB, constJ(1)), s);
const delta = n.map((ni, i) => divJ(addJ(mulJ(coefficient, ni), mulJ(f2, bvec[i])), denom));
const componentValue = Math.max(...delta.map(x => maxAbsI(x.v)));
const componentFirst = Math.max(...delta.map(x => maxAbsI(x.d)));
const componentSecond = Math.max(...delta.map(x => maxAbsI(x.dd)));
const sqrt3 = Math.sqrt(3);
const deltaNorm = sqrt3 * componentValue;
const deltaFirstNorm = sqrt3 * componentFirst;
const deltaSecondNorm = sqrt3 * componentSecond;

const correctionPosition = p * deltaNorm;
const correctionVelocity = v * deltaNorm + p * deltaFirstNorm;
const correctionAcceleration = rSecond * deltaNorm + 2 * v * deltaFirstNorm + p * deltaSecondNorm;
const aberratedPosition = p + correctionPosition;
const aberratedVelocity = v + correctionVelocity;
const aberratedAcceleration = a + correctionAcceleration;

const matrixFirst = precession.precessionMatrixHardBounds.firstDerivativeOperatorNormPerDay;
const matrixSecond = precession.precessionMatrixHardBounds.secondDerivativeOperatorNormPerDaySquared;
const precessedVelocity = aberratedVelocity + matrixFirst * aberratedPosition;
const precessedAcceleration = aberratedAcceleration
  + 2 * matrixFirst * aberratedVelocity
  + matrixSecond * aberratedPosition;
const hardXyLower = raw.minSampledAberrationPrecessedXyAu - precessedVelocity * raw.sampleCoverRadiusEtDays;
if (!(hardXyLower > 0)) throw new Error(`aberration precessed XY lower bound is not positive: ${hardXyLower}`);
const raSecondRad = precessedAcceleration / hardXyLower
  + 2 * precessedVelocity * precessedVelocity / (hardXyLower * hardXyLower);
const raSecondDeg = raSecondRad * 180 / Math.PI;
const fullThreshold = lightTime.planning.fullSwissEotSecondDerivativeThresholdDegPerDaySquared;

const manifest = {
  targetYear: 4006,
  method: "swieph-annual-aberration-interval-jet-plus-vondrak-ra-curvature-envelope-v1",
  provenance: {
    swissUpstreamCommit: segment.provenance.swissUpstreamCommit,
    sourceGeometryEvidenceId: segment.id,
    lightTimeEvidenceId: lightTime.id,
    precessionMatrixEvidenceId: precession.id,
    rawSamplerMethod: raw.method,
  },
  sample: {
    intervals: raw.sampleIntervals,
    stepEtDays: raw.sampleStepEtDays,
    coverRadiusEtDays: raw.sampleCoverRadiusEtDays,
    minSampledAberrationPrecessedXyAu: raw.minSampledAberrationPrecessedXyAu,
    minSampleIndex: raw.minSampleIndex,
    minSampleEtJd: raw.minSampleEtJd,
    gridMinimumIsContinuousLowerBound: false,
  },
  sourceJerkHardBounds: {
    earthMoonBarycenterAuPerDayCubed: raw.bodies.earthMoonBarycenter.maxJerkBoundAuPerDayCubed,
    moonGeocentricAuPerDayCubed: raw.bodies.moonGeocentric.maxJerkBoundAuPerDayCubed,
    earthAuPerDayCubed: earthJerk,
  },
  aberrationDimensionlessHardBounds: {
    betaNorm: beta,
    betaPrimeNormPerDay: betaPrime,
    betaSecondNormPerDaySquared: betaSecond,
    denominatorLower: denom.v.lo,
    directionFirstNormPerDay: nPrime,
    directionSecondNormPerDaySquared: nSecond,
    correctionDirectionNorm: deltaNorm,
    correctionDirectionFirstNormPerDay: deltaFirstNorm,
    correctionDirectionSecondNormPerDaySquared: deltaSecondNorm,
  },
  derivedHardBounds: {
    aberrationCorrectionPositionAu: correctionPosition,
    aberrationCorrectionVelocityAuPerDay: correctionVelocity,
    aberrationCorrectionAccelerationAuPerDaySquared: correctionAcceleration,
    aberratedGeometricPositionAu: aberratedPosition,
    aberratedGeometricVelocityAuPerDay: aberratedVelocity,
    aberratedGeometricAccelerationAuPerDaySquared: aberratedAcceleration,
    aberrationPrecessedVelocityAuPerDay: precessedVelocity,
    aberrationPrecessedAccelerationAuPerDaySquared: precessedAcceleration,
    hardAberrationPrecessedXyLowerAu: hardXyLower,
    aberrationPrecessedRaSecondDerivativeBoundRadPerDaySquared: raSecondRad,
    aberrationPrecessedRaSecondDerivativeBoundDegPerDaySquared: raSecondDeg,
  },
  planning: {
    fullSwissEotSecondDerivativeThresholdDegPerDaySquared: fullThreshold,
    priorLightTimePrecessedRaBoundDegPerDaySquared: lightTime.derivedHardBounds.lightTimePrecessedRaSecondDerivativeBoundDegPerDaySquared,
    aberrationPrecessedFractionOfThreshold: raSecondDeg / fullThreshold,
    thresholdRemainingAfterAberrationPrecessedBoundDegPerDaySquared: fullThreshold - raSecondDeg,
  },
  proof: {
    chebyshevThirdDerivativeBasisBound: "sup_abs_Tn_triple_prime=n^2(n^2-1)(n^2-4)/15",
    normalizedDirectionFirstBound: "|n'| <= V/r_min",
    normalizedDirectionSecondBound: "|n''| <= A/r_min + 3 V^2/r_min^2",
    aberrationCorrectionIdentity: "delta=((b-1-s)n+f2*beta)/(1+s)",
    intervalJetOrder: 2,
    intervalDependencyConservative: true,
    transformedVelocityInequality: "|(R x)'| <= |x'| + ||R'|| |x|",
    transformedAccelerationInequality: "|(R x)''| <= |x''| + 2 ||R'|| |x'| + ||R''|| |x|",
    betweenSampleXyLowerBound: "rho(t) >= rho(sample) - V_aberration_precessed * cover_radius",
    raCurvatureInequality: "|alpha''| <= A_xy/rho + 2 V_xy^2/rho^2",
  },
  interpretation: {
    sourceDerivedContinuousBound: true,
    swissTwoPassSunLightTimeCertified: true,
    earthJerkFromChebyshevCoefficientsCertified: true,
    annualAberrationFormulaSourceAudited: true,
    annualAberrationIntervalJetCertified: true,
    annualAberrationCertified: true,
    vondrakPrecessionMatrixCertified: true,
    aberrationPrecessedXySeparationContinuous: true,
    aberrationPrecessedRaSecondDerivativeCertified: true,
    nutationCertified: false,
    apparentPositionCorrectionChainCertified: false,
    longTermSiderealSecondDerivativeCertified: false,
    swissEotSecondDerivativeCertified: false,
    swissEotDerivativeCertified: false,
    continuousResidualUpperBound: false,
    deterministicMembership: false,
    recurrenceAuthorityGranted: false,
    reason: "The pinned Swiss aberration formula is bounded with second-order interval jets using source-derived Earth velocity, acceleration and jerk envelopes. Light-time and Vondrak precession are already certified; nutation and long-term sidereal curvature remain outside this certificate."
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
