#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EQUATION_OF_TIME_4006_SWISS_VONDRAK_PRECESSION_EVIDENCE as precession } from "../src/astronomy/equation-of-time-4006-swiss-vondrak-precession-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_ANNUAL_ABERRATION_RA_EVIDENCE as aberration } from "../src/astronomy/equation-of-time-4006-swiss-annual-aberration-ra-evidence.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = process.env.RAW_MANIFEST ?? path.join(here, "../tmp/swiss-nutation-ra-bound-4006/raw.json");
const outputPath = process.env.OUTPUT_MANIFEST ?? path.join(here, "../tmp/swiss-nutation-ra-bound-4006/manifest.json");
const swissLibPath = process.env.SWISS_LIB_SOURCE ?? path.join(here, "../tmp/swisseph/swephlib.c");
const swissHeaderPath = process.env.SWISS_HEADER_SOURCE ?? path.join(here, "../tmp/swisseph/swephexp.h");
const nutTablePath = process.env.SWISS_NUT_TABLE ?? path.join(here, "../tmp/swisseph/swenut2000a.h");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const libSource = fs.readFileSync(swissLibPath, "utf8");
const headerSource = fs.readFileSync(swissHeaderPath, "utf8");
const tableSource = fs.readFileSync(nutTablePath, "utf8");

const J2000 = 2451545.0;
const CENTURY_DAYS = 36525.0;
const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
const TABLE_UNIT_TO_RAD = ARCSEC_TO_RAD * 1e-7;

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
function parseArray(source, cType, name) {
  const clean = stripComments(source);
  const re = new RegExp(`static\\s+const\\s+${cType}\\s+${name}\\s*\\[\\s*\\]\\s*=\\s*\\{([\\s\\S]*?)\\};`);
  const match = clean.match(re);
  if (!match) throw new Error(`cannot locate ${name} in pinned Swiss source`);
  return [...match[1].matchAll(/[-+]?\d+/g)].map(m => Number(m[0]));
}
function polyDerivativeBounds(coeff, tAbsMax) {
  let firstPerCentury = 0;
  let secondPerCentury2 = 0;
  for (let p = 1; p < coeff.length; p++) {
    firstPerCentury += p * Math.abs(coeff[p]) * tAbsMax ** (p - 1);
    if (p >= 2) secondPerCentury2 += p * (p - 1) * Math.abs(coeff[p]) * tAbsMax ** (p - 2);
  }
  return {
    firstRadPerDay: firstPerCentury * ARCSEC_TO_RAD / CENTURY_DAYS,
    secondRadPerDaySquared: secondPerCentury2 * ARCSEC_TO_RAD / (CENTURY_DAYS ** 2),
  };
}

if (!headerSource.includes("#define SEMOD_NUT_DEFAULT           SEMOD_NUT_IAU_2000B")) {
  throw new Error("pinned Swiss source no longer defaults to IAU 2000B nutation");
}
if (!tableSource.includes("#define NLS_2000B 77")) throw new Error("pinned IAU 2000B term count changed");
for (const fragment of [
  "if (nut_model == SEMOD_NUT_IAU_2000B)",
  "inls = NLS_2000B;",
  "dpsi += (cls[k+0] + cls[k+1] * T) * sinarg + cls[k+2] * cosarg;",
  "deps += (cls[k+3] + cls[k+4] * T) * cosarg + cls[k+5] * sinarg;",
  "nutlo[0] = dpsi * O1MAS2DEG;",
  "nutlo[1] = deps * O1MAS2DEG;",
  "nutlo[0] *= DEGTORAD;",
  "nutlo[1] *= DEGTORAD;",
]) {
  if (!libSource.includes(fragment)) throw new Error(`pinned nutation source changed: ${fragment}`);
}

const nls = parseArray(tableSource, "int16", "nls");
const cls = parseArray(tableSource, "int32", "cls");
const termCount = 77;
if (nls.length < termCount * 5 || cls.length < termCount * 6) {
  throw new Error(`pinned nutation tables are too short: nls=${nls.length}, cls=${cls.length}`);
}

if (raw.targetYear !== 4006 || aberration.targetYear !== 4006 || precession.targetYear !== 4006) {
  throw new Error("year-4006 proof inputs are not aligned");
}
if (!aberration.interpretation.annualAberrationCertified ||
    !aberration.interpretation.aberrationPrecessedRaSecondDerivativeCertified ||
    !precession.interpretation.precessionMatrixSecondDerivativeCertified) {
  throw new Error("required lower-layer certificates are incomplete");
}
if (!raw.interpretation.defaultNutationEnabled || raw.interpretation.gridMinimumIsContinuousLowerBound !== false) {
  throw new Error("raw nutation sampler scope is invalid");
}

const t0 = (raw.domain.startEtJd - J2000) / CENTURY_DAYS;
const t1 = (raw.domain.endEtJd - J2000) / CENTURY_DAYS;
const tAbsMax = Math.max(Math.abs(t0), Math.abs(t1));

/* Simon et al. fundamental arguments exactly as frozen in pinned swephlib.c,
 * coefficients in arcseconds as powers of Julian centuries T. */
const args = [
  [485868.249036, 1717915923.2178, 31.8792, 0.051635, -0.00024470],
  [1287104.79305, 129596581.0481, -0.5532, 0.000136, -0.00001149],
  [335779.526232, 1739527262.8478, -12.7512, -0.001037, 0.00000417],
  [1072260.70369, 1602961601.2090, -6.3706, 0.006593, -0.00003169],
  [450160.398036, -6962890.5431, 7.4722, 0.007702, -0.00005939],
];
for (const literal of ["485868.249036", "1717915923.2178", "1287104.79305", "335779.526232", "1072260.70369", "450160.398036", "6962890.5431"]) {
  if (!libSource.includes(literal)) throw new Error(`pinned fundamental argument changed: ${literal}`);
}
const argBounds = args.map(c => polyDerivativeBounds(c, tAbsMax));

let dpsi1 = 0, dpsi2 = 0, deps1 = 0, deps2 = 0;
for (let i = 0; i < termCount; i++) {
  let phase1 = 0, phase2 = 0;
  for (let j = 0; j < 5; j++) {
    const mult = Math.abs(nls[i * 5 + j]);
    phase1 += mult * argBounds[j].firstRadPerDay;
    phase2 += mult * argBounds[j].secondRadPerDaySquared;
  }
  const [A, B, C, D, E, F] = cls.slice(i * 6, i * 6 + 6);
  const psiAmp = Math.abs(A) + Math.abs(B) * tAbsMax + Math.abs(C);
  const epsAmp = Math.abs(D) + Math.abs(E) * tAbsMax + Math.abs(F);
  const bPerDay = Math.abs(B) / CENTURY_DAYS;
  const ePerDay = Math.abs(E) / CENTURY_DAYS;
  dpsi1 += (bPerDay + psiAmp * phase1) * TABLE_UNIT_TO_RAD;
  dpsi2 += (2 * bPerDay * phase1 + psiAmp * (phase2 + phase1 * phase1)) * TABLE_UNIT_TO_RAD;
  deps1 += (ePerDay + epsAmp * phase1) * TABLE_UNIT_TO_RAD;
  deps2 += (2 * ePerDay * phase1 + epsAmp * (phase2 + phase1 * phase1)) * TABLE_UNIT_TO_RAD;
}

/* Bound mean-obliquity derivatives from the already-certified Vondrak equator
 * and ecliptic unit-pole derivatives.  Their cross-product norm is sin(eps). */
const q = precession.poleHardBounds.equator;
const e = precession.poleHardBounds.ecliptic;
const sinEpsLower = precession.crossProductHardBounds.hardNormLower;
const cosDerivative = q.firstDerivativeNormPerDay + e.firstDerivativeNormPerDay;
const cosSecond = q.secondDerivativeNormPerDaySquared + e.secondDerivativeNormPerDaySquared
  + 2 * q.firstDerivativeNormPerDay * e.firstDerivativeNormPerDay;
const eps1 = cosDerivative / sinEpsLower;
const eps2 = (cosSecond + eps1 * eps1) / sinEpsLower;

/* N is the standard mean-equator -> true-equator nutation rotation product
 * with angles eps_mean, dpsi, eps_true=eps_mean+deps.  For axis rotations,
 * ||R'||<=|theta'| and ||R''||<=|theta''|+|theta'|^2.  Product rule gives
 * ||N'||<=S1 and ||N''||<=S2+S1^2. */
const nutationFirst = 2 * eps1 + dpsi1 + deps1;
const nutationAngleSecondSum = 2 * eps2 + dpsi2 + deps2;
const nutationSecond = nutationAngleSecondSum + nutationFirst * nutationFirst;

const p = aberration.derivedHardBounds.aberratedGeometricPositionAu;
const v = aberration.derivedHardBounds.aberrationPrecessedVelocityAuPerDay;
const a = aberration.derivedHardBounds.aberrationPrecessedAccelerationAuPerDaySquared;
const nutatedVelocity = v + nutationFirst * p;
const nutatedAcceleration = a + 2 * nutationFirst * v + nutationSecond * p;
const hardXyLower = raw.minSampledNutatedEquatorialXyAu - nutatedVelocity * raw.sampleCoverRadiusEtDays;
if (!(hardXyLower > 0)) throw new Error(`nutated XY lower bound is not positive: ${hardXyLower}`);
const raSecondRad = nutatedAcceleration / hardXyLower
  + 2 * nutatedVelocity * nutatedVelocity / (hardXyLower * hardXyLower);
const raSecondDeg = raSecondRad * 180 / Math.PI;
const fullThreshold = aberration.planning.fullSwissEotSecondDerivativeThresholdDegPerDaySquared;

const manifest = {
  targetYear: 4006,
  method: "swiss-iau2000b-77term-nutation-matrix-ra-curvature-envelope-v1",
  provenance: {
    swissUpstreamCommit: aberration.provenance.swissUpstreamCommit,
    annualAberrationEvidenceId: aberration.id,
    precessionMatrixEvidenceId: precession.id,
    rawSamplerMethod: raw.method,
    nutationModel: "SEMOD_NUT_IAU_2000B",
    luniSolarTermCount: termCount,
  },
  sample: {
    intervals: raw.sampleIntervals,
    stepEtDays: raw.sampleStepEtDays,
    coverRadiusEtDays: raw.sampleCoverRadiusEtDays,
    minSampledNutatedEquatorialXyAu: raw.minSampledNutatedEquatorialXyAu,
    minSampleIndex: raw.minSampleIndex,
    minSampleEtJd: raw.minSampleEtJd,
    gridMinimumIsContinuousLowerBound: false,
  },
  argumentDerivativeHardBounds: argBounds,
  nutationAngleHardBounds: {
    dpsiFirstAbsRadPerDay: dpsi1,
    dpsiSecondAbsRadPerDaySquared: dpsi2,
    depsFirstAbsRadPerDay: deps1,
    depsSecondAbsRadPerDaySquared: deps2,
    meanObliquityFirstAbsRadPerDay: eps1,
    meanObliquitySecondAbsRadPerDaySquared: eps2,
  },
  nutationMatrixHardBounds: {
    firstDerivativeOperatorNormPerDay: nutationFirst,
    secondDerivativeOperatorNormPerDaySquared: nutationSecond,
    meanObliquitySinLower: sinEpsLower,
  },
  derivedHardBounds: {
    nutatedPositionAu: p,
    nutatedVelocityAuPerDay: nutatedVelocity,
    nutatedAccelerationAuPerDaySquared: nutatedAcceleration,
    hardNutatedEquatorialXyLowerAu: hardXyLower,
    nutatedRaSecondDerivativeBoundRadPerDaySquared: raSecondRad,
    nutatedRaSecondDerivativeBoundDegPerDaySquared: raSecondDeg,
  },
  planning: {
    fullSwissEotSecondDerivativeThresholdDegPerDaySquared: fullThreshold,
    priorAberrationPrecessedRaBoundDegPerDaySquared: aberration.derivedHardBounds.aberrationPrecessedRaSecondDerivativeBoundDegPerDaySquared,
    nutatedFractionOfThreshold: raSecondDeg / fullThreshold,
    thresholdRemainingAfterNutatedBoundDegPerDaySquared: fullThreshold - raSecondDeg,
  },
  proof: {
    nutationSeries:"77-term IAU 2000B luni-solar finite series",
    termDerivativeBound:"differentiate (A+B*T)sin(phi)+Ccos(phi) and bound |sin|,|cos|<=1",
    meanObliquityDerivativeBound:"derive eps from certified Vondrak equator/ecliptic unit-pole dot product with sin(eps) lower bound",
    nutationMatrixFirstDerivativeBound:"||N'|| <= 2|eps'|+|dpsi'|+|deps'|",
    nutationMatrixSecondDerivativeBound:"||N''|| <= 2|eps''|+|dpsi''|+|deps''|+||N'||^2",
    transformedVelocityInequality:"|(N x)'| <= |x'| + ||N'|| |x|",
    transformedAccelerationInequality:"|(N x)''| <= |x''| + 2 ||N'|| |x'| + ||N''|| |x|",
    betweenSampleXyLowerBound:"rho(t) >= rho(sample) - V_nutated * cover_radius",
    raCurvatureInequality:"|alpha''| <= A_xy/rho + 2 V_xy^2/rho^2",
  },
  interpretation: {
    sourceDerivedContinuousBound: true,
    iau2000bDefaultModelSourceAudited: true,
    iau2000bTermDerivativeBoundsAnalytic: true,
    meanObliquityDerivativeBoundCertified: true,
    nutationMatrixFirstDerivativeCertified: true,
    nutationMatrixSecondDerivativeCertified: true,
    nutationCertified: true,
    apparentPositionCorrectionChainCertified: true,
    nutatedXySeparationContinuous: true,
    nutatedRaSecondDerivativeCertified: true,
    longTermSiderealSecondDerivativeCertified: false,
    swissEotSecondDerivativeCertified: false,
    swissEotDerivativeCertified: false,
    continuousResidualUpperBound: false,
    deterministicMembership: false,
    recurrenceAuthorityGranted: false,
    reason:"Pinned Swiss IAU 2000B 77-term nutation coefficients and Vondrak mean-obliquity pole certificates establish continuous nutation-matrix derivative bounds. Combined with the merged light-time/aberration/precession certificate, the apparent-Sun RA curvature is now scoped certified; long-term sidereal curvature remains unresolved."
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
