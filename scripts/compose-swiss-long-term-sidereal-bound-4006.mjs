#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EQUATION_OF_TIME_4006_SWISS_VONDRAK_PRECESSION_EVIDENCE as precession } from "../src/astronomy/equation-of-time-4006-swiss-vondrak-precession-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_NUTATION_RA_EVIDENCE as nutation } from "../src/astronomy/equation-of-time-4006-swiss-nutation-ra-evidence.js";
import { EQUATION_OF_TIME_4006_SWISS_DERIVATIVE_COMPONENT_EVIDENCE as components } from "../src/astronomy/equation-of-time-4006-swiss-derivative-component-evidence.js";
import { EQUATION_OF_TIME_4006_PRODUCTION_DERIVATIVE_CERTIFICATE as production } from "../src/astronomy/equation-of-time-4006-production-derivative-certificate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const rawPath = process.env.RAW_MANIFEST ?? path.join(here, "../tmp/swiss-long-term-sidereal-bound-4006/raw.json");
const outputPath = process.env.OUTPUT_MANIFEST ?? path.join(here, "../tmp/swiss-long-term-sidereal-bound-4006/manifest.json");
const swissLibPath = process.env.SWISS_LIB_SOURCE ?? path.join(here, "../tmp/swisseph/swephlib.c");
const swissMainPath = process.env.SWISS_MAIN_SOURCE ?? path.join(here, "../tmp/swisseph/sweph.c");
const swissHeaderPath = process.env.SWISS_HEADER_SOURCE ?? path.join(here, "../tmp/swisseph/swephexp.h");

const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
const libSource = fs.readFileSync(swissLibPath, "utf8");
const mainSource = fs.readFileSync(swissMainPath, "utf8");
const headerSource = fs.readFileSync(swissHeaderPath, "utf8");

const J2000 = 2451545.0;
const DAYS_PER_JULIAN_YEAR = 365.25;
const DAYS_PER_JULIAN_MILLENNIUM = 365250.0;
const SECONDS_PER_DAY = 86400.0;
const SOLAR_SECONDS_PER_DEGREE = 240.0;
const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;
const SWISS_UPSTREAM = "9083a12d59e98034fb2337061481ac8800c16e64";

function requireSource(source, fragment, label = fragment) {
  if (!source.includes(fragment)) throw new Error(`pinned Swiss source changed: ${label}`);
}
function endpointAbsMax(fn, a, b) {
  return Math.max(Math.abs(fn(a)), Math.abs(fn(b)));
}

if (raw.targetYear !== 4006 || precession.targetYear !== 4006 || nutation.targetYear !== 4006 ||
    components.targetYear !== 4006 || production.targetYear !== 4006) {
  throw new Error("year-4006 proof inputs are not aligned");
}
if (nutation.provenance.swissUpstreamCommit !== SWISS_UPSTREAM ||
    precession.provenance.swissUpstreamCommit !== SWISS_UPSTREAM ||
    components.provenance.swissUpstreamCommit !== SWISS_UPSTREAM) {
  throw new Error("Swiss provenance is not pinned to the expected upstream commit");
}
if (!precession.interpretation.precessionMatrixSecondDerivativeCertified ||
    !nutation.interpretation.nutatedRaSecondDerivativeCertified ||
    !nutation.interpretation.nutationMatrixSecondDerivativeCertified ||
    !production.interpretation.analyticExpressionDerivativeCertified) {
  throw new Error("required lower-layer certificates are incomplete");
}
if (!raw.interpretation.longTermSiderealBranchReconstructed ||
    !raw.interpretation.publicTimeEquSampled ||
    raw.interpretation.gridMinimumIsContinuousLowerBound !== false ||
    raw.interpretation.sampledDpsiMaximumIsContinuousUpperBound !== false ||
    raw.interpretation.sampledEotMaximumIsContinuousUpperBound !== false ||
    raw.interpretation.continuousSiderealCurvatureCertified !== false ||
    raw.interpretation.publicTimeEquWrapBranchCertified !== false) {
  throw new Error("raw sidereal sampler scope is invalid");
}

for (const fragment of [
  "#define SEMOD_SIDT_DEFAULT          SEMOD_SIDT_LONGTERM",
  "#define SEMOD_DELTAT_DEFAULT   SEMOD_DELTAT_STEPHENSON_ETC_2016",
  "#define SEMOD_NUT_DEFAULT           SEMOD_NUT_IAU_2000B",
]) requireSource(headerSource, fragment);
for (const fragment of [
  "#define SIDT_LTERM_T0  2396758.5",
  "#define SIDT_LTERM_T1  2469807.5",
  "#define SIDT_LTERM_OFS1   (0.001385646 / 15.0)",
  "if (sidt_model == SEMOD_SIDT_LONGTERM)",
  "gmst = sidtime_long_term(tjd, eps, nut);",
  "tjd_et = tjd_ut + swe_deltat_ex(tjd_ut, -1, NULL);",
  "t = (tjd_et - J2000) / 365250.0;",
  "dlon = 100.46645683 + (1295977422.83429 * t - 2.04411 * t2 - 0.00523 * t3) / 3600.0;",
  "swi_precess(xs, tjd_et, 0, -1);",
  "xobl[1] = swi_epsiln(tjd_et, 0) * RADTODEG;",
  "swi_nutation(tjd_et, 0, nutlo);",
  "xs[0] += nut * cos(eps * DEGTORAD);",
  "dhour = fmod(tjd_ut - 0.5, 1) * 360;",
  "B = 0.01 * (Y - 2000);",
  "ans = B * B * 32.5 + 42.5;",
]) requireSource(libSource, fragment);
for (const fragment of [
  "double sidt = swe_sidtime(tjd_ut);",
  "dt = swe_degnorm(sidt - x[0] - 180);",
  "if (dt > 180)",
  "dt -= 360;",
  "dt *= 4;",
  "*E = dt / 1440.0;",
]) requireSource(mainSource, fragment);

if (!(raw.domain.startUtJd >= 2469807.5 && raw.domain.endUtJd >= 2469807.5)) {
  throw new Error("year-4006 domain does not remain on Swiss long-term sidereal branch");
}
const yearFromUt = jd => 2000.0 + (jd - J2000) / DAYS_PER_JULIAN_YEAR;
const y0 = yearFromUt(raw.domain.startUtJd);
const y1 = yearFromUt(raw.domain.endUtJd);
if (!(Math.min(y0, y1) >= 2500)) throw new Error("year-4006 domain does not remain on the post-2500 DeltaT parabola");

/* Swiss default future DeltaT branch for Y>=2500:
 * B=.01*(Y-2000), DeltaT_seconds=32.5*B^2+42.5. */
const dBdu = 0.01 / DAYS_PER_JULIAN_YEAR;
const bAt = jd => 0.01 * (yearFromUt(jd) - 2000.0);
const bAbsMax = endpointAbsMax(bAt, raw.domain.startUtJd, raw.domain.endUtJd);
const deltaTSecondsFirstAbsPerUtDay = 65.0 * bAbsMax * dBdu;
const deltaTSecondsSecondAbsPerUtDaySquared = 65.0 * dBdu * dBdu;
const etFirstAbsPerUtDay = 1.0 + deltaTSecondsFirstAbsPerUtDay / SECONDS_PER_DAY;
const etSecondAbsPerUtDaySquared = deltaTSecondsSecondAbsPerUtDaySquared / SECONDS_PER_DAY;

/* Mean Earth longitude in sidtime_long_term(), before constant light-time shift. */
const tAtEt = jdEt => (jdEt - J2000) / DAYS_PER_JULIAN_MILLENNIUM;
const tAbsMax = Math.max(Math.abs(tAtEt(raw.domain.startEtJd)), Math.abs(tAtEt(raw.domain.endEtJd)));
const L1 = 1295977422.83429;
const L2 = -2.04411;
const L3 = -0.00523;
const meanLongitudeFirstAbsDegPerEtDay =
  (Math.abs(L1) + 2 * Math.abs(L2) * tAbsMax + 3 * Math.abs(L3) * tAbsMax * tAbsMax) /
  (3600.0 * DAYS_PER_JULIAN_MILLENNIUM);
const meanLongitudeSecondAbsDegPerEtDaySquared =
  (2 * Math.abs(L2) + 6 * Math.abs(L3) * tAbsMax) /
  (3600.0 * DAYS_PER_JULIAN_MILLENNIUM ** 2);
const meanLongitudeFirstAbsRadPerUtDay =
  meanLongitudeFirstAbsDegPerEtDay * DEG_TO_RAD * etFirstAbsPerUtDay;
const meanLongitudeSecondAbsRadPerUtDaySquared =
  meanLongitudeSecondAbsDegPerEtDaySquared * DEG_TO_RAD * etFirstAbsPerUtDay ** 2 +
  meanLongitudeFirstAbsDegPerEtDay * DEG_TO_RAD * etSecondAbsPerUtDaySquared;

/* The starting vector is unit length. Constant light-time and J2000 obliquity
 * rotations do not change derivative norms. */
const initialVelocity = meanLongitudeFirstAbsRadPerUtDay;
const initialAcceleration = meanLongitudeSecondAbsRadPerUtDaySquared + initialVelocity ** 2;

const precessionFirst = precession.precessionMatrixHardBounds.firstDerivativeOperatorNormPerDay * etFirstAbsPerUtDay;
const precessionSecond =
  precession.precessionMatrixHardBounds.secondDerivativeOperatorNormPerDaySquared * etFirstAbsPerUtDay ** 2 +
  precession.precessionMatrixHardBounds.firstDerivativeOperatorNormPerDay * etSecondAbsPerUtDaySquared;
const precessedVelocity = initialVelocity + precessionFirst;
const precessedAcceleration = initialAcceleration + 2 * precessionFirst * initialVelocity + precessionSecond;

const meanEps1Et = nutation.nutationAngleHardBounds.meanObliquityFirstAbsRadPerDay;
const meanEps2Et = nutation.nutationAngleHardBounds.meanObliquitySecondAbsRadPerDaySquared;
const meanEps1Ut = meanEps1Et * etFirstAbsPerUtDay;
const meanEps2Ut = meanEps2Et * etFirstAbsPerUtDay ** 2 + meanEps1Et * etSecondAbsPerUtDaySquared;
const eclipticVelocity = precessedVelocity + meanEps1Ut;
const eclipticAcceleration = precessedAcceleration + 2 * meanEps1Ut * precessedVelocity + meanEps2Ut + meanEps1Ut ** 2;
const hardEclipticXyLower = raw.minSampledPreEqeqEclipticXy - eclipticVelocity * raw.sampleCoverRadiusUtDays;
if (!(hardEclipticXyLower > 0)) throw new Error(`sidereal pre-EqEq XY lower bound is not positive: ${hardEclipticXyLower}`);
const meanEclipticLongitudeFirstRadPerUtDay = eclipticVelocity / hardEclipticXyLower;
const meanEclipticLongitudeSecondRadPerUtDaySquared =
  eclipticAcceleration / hardEclipticXyLower +
  2 * eclipticVelocity ** 2 / hardEclipticXyLower ** 2;
const meanEclipticLongitudeSecondDegPerUtDaySquared = meanEclipticLongitudeSecondRadPerUtDaySquared * RAD_TO_DEG;

/* Equation of equinoxes in the public swe_sidtime() path is dpsi*cos(eps_true).
 * Reuse the #285 analytic derivative bounds; the sampled dpsi maximum is lifted
 * to a continuous amplitude upper bound with the certified first derivative. */
const dpsi1Ut = nutation.nutationAngleHardBounds.dpsiFirstAbsRadPerDay * etFirstAbsPerUtDay;
const dpsi2Ut =
  nutation.nutationAngleHardBounds.dpsiSecondAbsRadPerDaySquared * etFirstAbsPerUtDay ** 2 +
  nutation.nutationAngleHardBounds.dpsiFirstAbsRadPerDay * etSecondAbsPerUtDaySquared;
const deps1Ut = nutation.nutationAngleHardBounds.depsFirstAbsRadPerDay * etFirstAbsPerUtDay;
const deps2Ut =
  nutation.nutationAngleHardBounds.depsSecondAbsRadPerDaySquared * etFirstAbsPerUtDay ** 2 +
  nutation.nutationAngleHardBounds.depsFirstAbsRadPerDay * etSecondAbsPerUtDaySquared;
const trueEps1Ut = meanEps1Ut + deps1Ut;
const trueEps2Ut = meanEps2Ut + deps2Ut;
const dpsiAbsContinuous = raw.maxSampledAbsDpsiRad + dpsi1Ut * raw.sampleCoverRadiusUtDays;
const equationOfEquinoxesFirstRadPerUtDay = dpsi1Ut + dpsiAbsContinuous * trueEps1Ut;
const equationOfEquinoxesSecondRadPerUtDaySquared =
  dpsi2Ut + 2 * dpsi1Ut * trueEps1Ut + dpsiAbsContinuous * (trueEps2Ut + trueEps1Ut ** 2);
const equationOfEquinoxesSecondDegPerUtDaySquared = equationOfEquinoxesSecondRadPerUtDaySquared * RAD_TO_DEG;

/* UT hour is exactly linear on the continuous lift. The post-2050 alignment
 * offset is constant. Both therefore contribute zero second derivative, while
 * the UT hour cancels from the EoT residual first derivative. */
const longTermSiderealSecondDerivativeBoundDegPerUtDaySquared =
  meanEclipticLongitudeSecondDegPerUtDaySquared + equationOfEquinoxesSecondDegPerUtDaySquared;
const sunRaSecond = nutation.derivedHardBounds.nutatedRaSecondDerivativeBoundDegPerDaySquared;
const swissEotSecondDerivativeBoundDegPerUtDaySquared = longTermSiderealSecondDerivativeBoundDegPerUtDaySquared + sunRaSecond;

/* Prove the public swe_time_equ principal-value branch never approaches its
 * +/-180 degree wrap. This first-derivative envelope is source-derived and does
 * not depend on the five-minute forward-difference MVT bridge below. */
const apparentSunRaFirstRadPerUtDay =
  nutation.derivedHardBounds.nutatedVelocityAuPerDay * etFirstAbsPerUtDay /
  nutation.derivedHardBounds.hardNutatedEquatorialXyLowerAu;
const eotContinuousLiftFirstDerivativeBoundDegPerUtDay =
  (meanEclipticLongitudeFirstRadPerUtDay + equationOfEquinoxesFirstRadPerUtDay + apparentSunRaFirstRadPerUtDay) * RAD_TO_DEG;
const hardAbsPublicEotAngleUpperDeg =
  raw.maxSampledAbsPublicEotAngleDeg + eotContinuousLiftFirstDerivativeBoundDegPerUtDay * raw.sampleCoverRadiusUtDays;
if (!(hardAbsPublicEotAngleUpperDeg < 180.0)) {
  throw new Error(`Swiss swe_time_equ wrap branch is not certified stable: ${hardAbsPublicEotAngleUpperDeg}`);
}

/* With the public principal-value branch now proved stable, bridge the existing
 * five-minute swe_time_equ forward-slope grid to a continuous derivative bound. */
const observedForward = components.observed.maxAbsSwissEotForwardSlopeSolarSecondsPerDay;
const intervalDays = components.planning.intervalDays;
const swissEotDerivativeBoundSolarSecondsPerUtDay =
  observedForward + swissEotSecondDerivativeBoundDegPerUtDaySquared * intervalDays * SOLAR_SECONDS_PER_DEGREE;
const swissDerivativeBudget = production.proof.remainingPlanningBudgetForIndependentSwissDerivativeSecondsPerDay;
const analyticResidualDerivativeBoundSolarSecondsPerUtDay =
  production.proof.analyticExpressionDerivativeBoundSolarSecondsPerUtDay + swissEotDerivativeBoundSolarSecondsPerUtDay;
const residualPlanningBudget = production.proof.planningResidualLipschitzBudgetSecondsPerDay;

if (!(longTermSiderealSecondDerivativeBoundDegPerUtDaySquared > 0 &&
      longTermSiderealSecondDerivativeBoundDegPerUtDaySquared < nutation.planning.thresholdRemainingAfterNutatedBoundDegPerDaySquared)) {
  throw new Error("long-term sidereal curvature does not fit the remaining full-EoT threshold");
}
if (!(swissEotSecondDerivativeBoundDegPerUtDaySquared < components.planning.requiredCertifiedSecondDerivativeBoundDegPerDaySquared)) {
  throw new Error("full Swiss EoT second derivative does not close the MVT planning threshold");
}
if (!(swissEotDerivativeBoundSolarSecondsPerUtDay < swissDerivativeBudget)) {
  throw new Error("certified Swiss derivative exceeds independent-Swiss planning budget");
}
if (!(analyticResidualDerivativeBoundSolarSecondsPerUtDay < residualPlanningBudget)) {
  throw new Error("analytic residual derivative envelope exceeds planning budget");
}

const manifest = {
  targetYear: 4006,
  method: "pinned-swiss-long-term-sidereal-source-envelope-v2",
  provenance: {
    swissUpstreamCommit: SWISS_UPSTREAM,
    precessionEvidenceId: precession.id,
    apparentSunRaEvidenceId: nutation.id,
    derivativeGridEvidenceId: components.id,
    productionDerivativeCertificateId: production.id,
    siderealModel: "SEMOD_SIDT_LONGTERM",
    deltaTModel: "SEMOD_DELTAT_STEPHENSON_ETC_2016",
    nutationModel: nutation.provenance.nutationModel,
  },
  sample: {
    intervals: raw.sampleIntervals,
    stepUtDays: raw.sampleStepUtDays,
    coverRadiusUtDays: raw.sampleCoverRadiusUtDays,
    minSampledPreEqeqEclipticXy: raw.minSampledPreEqeqEclipticXy,
    hardPreEqeqEclipticXyLower: hardEclipticXyLower,
    maxSampledAbsDpsiRad: raw.maxSampledAbsDpsiRad,
    hardAbsDpsiRadUpper: dpsiAbsContinuous,
    maxSampledAbsPublicEotAngleDeg: raw.maxSampledAbsPublicEotAngleDeg,
    hardAbsPublicEotAngleUpperDeg,
    maxAbsReconstructedVsPublicSidtimeHours: raw.maxAbsReconstructedVsPublicSidtimeHours,
    gridMinimumIsContinuousLowerBound: false,
    sampledDpsiMaximumIsContinuousUpperBound: false,
    sampledEotMaximumIsContinuousUpperBound: false,
  },
  deltaTHardBounds: {
    yearMin: Math.min(y0, y1),
    yearMax: Math.max(y0, y1),
    branch: "post-2500 quadratic",
    firstAbsSecondsPerUtDay: deltaTSecondsFirstAbsPerUtDay,
    secondAbsSecondsPerUtDaySquared: deltaTSecondsSecondAbsPerUtDaySquared,
    etFirstAbsPerUtDay,
    etSecondAbsPerUtDaySquared,
  },
  longTermMeanLongitudeHardBounds: {
    firstAbsDegPerEtDay: meanLongitudeFirstAbsDegPerEtDay,
    secondAbsDegPerEtDaySquared: meanLongitudeSecondAbsDegPerEtDaySquared,
    firstAbsRadPerUtDay: meanLongitudeFirstAbsRadPerUtDay,
    secondAbsRadPerUtDaySquared: meanLongitudeSecondAbsRadPerUtDaySquared,
  },
  vectorHardBounds: {
    initialVelocityPerUtDay: initialVelocity,
    initialAccelerationPerUtDaySquared: initialAcceleration,
    precessionFirstOperatorPerUtDay: precessionFirst,
    precessionSecondOperatorPerUtDaySquared: precessionSecond,
    precessedVelocityPerUtDay: precessedVelocity,
    precessedAccelerationPerUtDaySquared: precessedAcceleration,
    meanObliquityFirstAbsRadPerUtDay: meanEps1Ut,
    meanObliquitySecondAbsRadPerUtDaySquared: meanEps2Ut,
    preEqeqEclipticVelocityPerUtDay: eclipticVelocity,
    preEqeqEclipticAccelerationPerUtDaySquared: eclipticAcceleration,
    meanEclipticLongitudeFirstRadPerUtDay,
  },
  equationOfEquinoxesHardBounds: {
    dpsiFirstAbsRadPerUtDay: dpsi1Ut,
    dpsiSecondAbsRadPerUtDaySquared: dpsi2Ut,
    trueObliquityFirstAbsRadPerUtDay: trueEps1Ut,
    trueObliquitySecondAbsRadPerUtDaySquared: trueEps2Ut,
    firstDerivativeBoundRadPerUtDay: equationOfEquinoxesFirstRadPerUtDay,
    secondDerivativeBoundRadPerUtDaySquared: equationOfEquinoxesSecondRadPerUtDaySquared,
    secondDerivativeBoundDegPerUtDaySquared: equationOfEquinoxesSecondDegPerUtDaySquared,
  },
  publicTimeEquWrapHardBounds: {
    apparentSunRaFirstDerivativeBoundRadPerUtDay: apparentSunRaFirstRadPerUtDay,
    eotContinuousLiftFirstDerivativeBoundDegPerUtDay,
    sampledAbsEotAngleDeg: raw.maxSampledAbsPublicEotAngleDeg,
    continuousAbsEotAngleUpperDeg: hardAbsPublicEotAngleUpperDeg,
    principalWrapBoundaryDeg: 180,
  },
  derivedHardBounds: {
    meanEclipticLongitudeSecondDerivativeBoundDegPerUtDaySquared: meanEclipticLongitudeSecondDegPerUtDaySquared,
    longTermSiderealSecondDerivativeBoundDegPerUtDaySquared,
    apparentSunRaSecondDerivativeBoundDegPerDaySquared: sunRaSecond,
    swissEotSecondDerivativeBoundDegPerUtDaySquared,
    swissEotDerivativeBoundSolarSecondsPerUtDay,
    independentSwissDerivativeBudgetSolarSecondsPerUtDay: swissDerivativeBudget,
    productionAnalyticDerivativeBoundSolarSecondsPerUtDay: production.proof.analyticExpressionDerivativeBoundSolarSecondsPerUtDay,
    analyticResidualDerivativeBoundSolarSecondsPerUtDay,
    analyticResidualPlanningBudgetSolarSecondsPerUtDay: residualPlanningBudget,
  },
  proof: {
    deltaTBranch: "differentiate pinned post-2500 Swiss quadratic exactly and chain UT->ET",
    meanLongitude: "differentiate pinned sidtime_long_term Earth mean-longitude polynomial exactly",
    precession: "reuse certified Vondrak matrix derivative envelope and chain ET derivatives to UT",
    eclipticRotation: "reuse certified Vondrak mean-obliquity derivative envelope",
    betweenSampleXyLower: "rho(t) >= rho(sample) - V * cover_radius",
    longitudeCurvature: "|lambda''| <= A/rho + 2 V^2/rho^2",
    equationOfEquinoxes: "differentiate dpsi*cos(eps_true), with continuous dpsi amplitude lifted from samples by certified |dpsi'|",
    hourAndAlignmentTerms: "UT hour cancels from the EoT residual continuous lift; the post-2050 Swiss alignment offset is constant",
    publicTimeEquWrap: "sample public EoT principal values and lift them with an independent source-derived first-derivative envelope; the resulting continuous bound stays strictly inside +/-180 degrees",
    swissDerivativeBridge: "after proving the public wrap branch stable, use five-minute Swiss EoT forward slope + certified full-EoT second derivative * interval via mean-value theorem",
  },
  interpretation: {
    sourceDerivedContinuousBound: true,
    defaultLongTermSiderealModelSourceAudited: true,
    futureDeltaTBranchSourceAudited: true,
    publicTimeEquWrapSourceAudited: true,
    reconstructedPublicSidtimeParitySampled: true,
    betweenSampleEclipticSeparationCertified: true,
    equationOfEquinoxesSecondDerivativeCertified: true,
    publicTimeEquWrapBranchCertified: true,
    longTermSiderealSecondDerivativeCertified: true,
    swissEotSecondDerivativeCertified: true,
    swissEotDerivativeCertified: true,
    independentSwissDerivativeCertified: true,
    analyticResidualDerivativeEnvelopeWithinBudget: true,
    productionRuntimeFloatingPointContinuityCertified: false,
    continuousResidualUpperBound: false,
    deterministicMembership: false,
    recurrenceAuthorityGranted: false,
    reason: "Pinned Swiss long-term sidereal and swe_time_equ source, the existing Vondrak/IAU-2000B certificates, an explicit no-wrap proof, and the five-minute Swiss EoT grid close a continuous independent-Swiss derivative bound for year 4006. Production runtime floating-point continuity/roundoff remains uncertified, so residual membership and recurrence authority stay fail-closed."
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));