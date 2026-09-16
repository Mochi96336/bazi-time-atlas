import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { ShouXingUtil } from "../vendor/tyme4ts-1.5.2.mjs";
import {
  EQUATION_OF_TIME_MEAN_OBLIQUITY_COEFFICIENTS,
  EQUATION_OF_TIME_SUN_MEAN_LONGITUDE_COEFFICIENTS,
  equationOfTime
} from "../src/astronomy/equation-of-time.js";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "tmp/eot-production-derivative-bound-4006";
const TARGET_YEAR = 4006;
const SECONDS_PER_DAY = 86400;
const DAYS_PER_JULIAN_CENTURY = 36525;
const DAYS_PER_JULIAN_MILLENNIUM = 365250;
const DAYS_PER_SHOUXING_YEAR = 365.2425;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const SOLAR_SECONDS_PER_DEGREE = 240;
const PLANNING_RESIDUAL_LIPSCHITZ_BUDGET_SECONDS_PER_DAY = 146.03566713968326;
const RECON_OBSERVED_PRODUCTION_RESIDUAL_SLOPE_SECONDS_PER_DAY = 0.01713795771234664;
const SOURCE_AUDIT_TOLERANCE_RAD = 5e-13;

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function polynomial(coefficients, x) {
  return coefficients.reduceRight((acc, coefficient) => acc * x + coefficient, 0);
}

function polynomialDerivative(coefficients, x) {
  let sum = 0;
  for (let i = 1; i < coefficients.length; i += 1) {
    sum += i * coefficients[i] * x ** (i - 1);
  }
  return sum;
}

function polynomialDerivativeAbsoluteBound(coefficients, maxAbsX) {
  let sum = 0;
  for (let i = 1; i < coefficients.length; i += 1) {
    sum += Math.abs(i * coefficients[i]) * maxAbsX ** (i - 1);
  }
  return sum;
}

function polynomialAbsoluteBound(coefficients, maxAbsX) {
  return coefficients.reduce(
    (sum, coefficient, i) => sum + Math.abs(coefficient) * maxAbsX ** i,
    0
  );
}

function maxAbsEndpointLinear(a, b) {
  return Math.max(Math.abs(a), Math.abs(b));
}

function auditRuntimeTables() {
  const xl0 = ShouXingUtil.XL0;
  const nutB = ShouXingUtil.NUT_B;
  const dtAt = ShouXingUtil.DT_AT;
  const secondPerRad = ShouXingUtil.SECOND_PER_RAD;

  if (!Array.isArray(xl0) || xl0.length < 1200) {
    throw new Error("Tyme ShouXingUtil.XL0 must be exposed as the full finite Earth-longitude coefficient table");
  }
  if (!Array.isArray(nutB) || nutB.length === 0 || nutB.length % 5 !== 0) {
    throw new Error("Tyme ShouXingUtil.NUT_B must be exposed as five-value nutation groups");
  }
  if (!Array.isArray(dtAt) || dtAt.length < 6) {
    throw new Error("Tyme ShouXingUtil.DT_AT must be exposed for delta-T branch audit");
  }
  if (!Number.isFinite(secondPerRad) || secondPerRad < 200000 || secondPerRad > 210000) {
    throw new Error(`unexpected Tyme SECOND_PER_RAD=${secondPerRad}`);
  }
  if (xl0[0] !== 10000000000) {
    throw new Error(`unexpected XL0 normalization ${xl0[0]}`);
  }

  const boundaries = [];
  for (let i = 0; i <= 6; i += 1) boundaries.push(Math.trunc(xl0[1 + i]));
  for (let i = 0; i < 6; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (start < 0 || end < start || end > xl0.length || (end - start) % 3 !== 0) {
      throw new Error(`invalid XL0 group ${i}: ${start}..${end}`);
    }
  }

  return Object.freeze({ xl0, nutB, dtAt, secondPerRad, boundaries });
}

function reconstructEarthLongitude(jce, runtime) {
  const x = jce / 10;
  let value = 0;
  for (let i = 0; i < 6; i += 1) {
    let c = 0;
    for (let j = runtime.boundaries[i]; j < runtime.boundaries[i + 1]; j += 3) {
      c += runtime.xl0[j] * Math.cos(runtime.xl0[j + 1] + x * runtime.xl0[j + 2]);
    }
    value += c * x ** i;
  }
  value /= runtime.xl0[0];
  value += (-0.0728 - 2.7702 * x - 1.1019 * x ** 2 - 0.0996 * x ** 3) / runtime.secondPerRad;
  return value;
}

function reconstructNutationLongitude(jce, runtime) {
  let firstAmplitudeTimeTerm = -1.742 * jce;
  const t2 = jce * jce;
  let value = 0;
  for (let i = 0; i < runtime.nutB.length; i += 5) {
    value += (runtime.nutB[i + 3] + firstAmplitudeTimeTerm)
      * Math.sin(runtime.nutB[i] + runtime.nutB[i + 1] * jce + runtime.nutB[i + 2] * t2);
    firstAmplitudeTimeTerm = 0;
  }
  return value / 100 / runtime.secondPerRad;
}

function reconstructGxcSunLongitude(jce, runtime) {
  const t2 = jce * jce;
  return -20.49552 * (
    1
    + (0.016708634 - 0.000042037 * jce - 0.0000001267 * t2)
      * Math.cos(-0.043126 + 628.301955 * jce - 0.000002732 * t2)
  ) / runtime.secondPerRad;
}

function auditSourceRelations(jceValues, runtime) {
  const probes = [];
  for (const jce of jceValues) {
    const reconstructedEarth = reconstructEarthLongitude(jce, runtime);
    const reconstructedNutation = reconstructNutationLongitude(jce, runtime);
    const reconstructedGxc = reconstructGxcSunLongitude(jce, runtime);
    const runtimeEarth = ShouXingUtil.eLon(jce, -1);
    const runtimeNutation = ShouXingUtil.nutationLon2(jce);
    const runtimeGxc = ShouXingUtil.gxcSunLon(jce);
    const runtimeSaLon = ShouXingUtil.saLon(jce, -1);
    const reconstructedSaLon = reconstructedEarth + reconstructedNutation + reconstructedGxc + Math.PI;

    for (const [label, actual, expected] of [
      ["eLon", runtimeEarth, reconstructedEarth],
      ["nutationLon2", runtimeNutation, reconstructedNutation],
      ["gxcSunLon", runtimeGxc, reconstructedGxc],
      ["saLon", runtimeSaLon, reconstructedSaLon]
    ]) {
      const error = Math.abs(actual - expected);
      if (error > SOURCE_AUDIT_TOLERANCE_RAD) {
        throw new Error(`${label} source reconstruction mismatch at JCE=${jce}: ${error} rad`);
      }
    }
    probes.push(Object.freeze({
      jce,
      eLonErrorRad:runtimeEarth - reconstructedEarth,
      nutationErrorRad:runtimeNutation - reconstructedNutation,
      gxcErrorRad:runtimeGxc - reconstructedGxc,
      saLonErrorRad:runtimeSaLon - reconstructedSaLon
    }));
  }
  return Object.freeze(probes);
}

function deltaTAndEphemerisTimeBound(startContext, endContext, runtime) {
  const y0 = runtime.dtAt[runtime.dtAt.length - 2];
  const transitionEndYear = y0 + 100;
  const utcDays = [startContext.utcDaysFromJ2000, endContext.utcDaysFromJ2000];
  const shouxingYears = utcDays.map(days => days / DAYS_PER_SHOUXING_YEAR + 2000);
  const minYear = Math.min(...shouxingYears);
  const maxYear = Math.max(...shouxingYears);
  if (!(minYear > transitionEndYear)) {
    throw new Error(`year-4006 proof expected Tyme dtExt branch beyond ${transitionEndYear}, got ${minYear}`);
  }

  // Exact year-4006 Tyme extrapolation branch:
  // ΔT_seconds(y) = -20 + 31 * ((y - 1820) / 100)^2.
  // y = UT_days / 365.2425 + 2000.
  const maxAbsDeltaTSecondsDerivativePerUtDay =
    62 * Math.max(Math.abs(minYear - 1820), Math.abs(maxYear - 1820))
    / 10000
    / DAYS_PER_SHOUXING_YEAR;
  const maxAbsDeltaTDaysDerivativePerUtDay =
    maxAbsDeltaTSecondsDerivativePerUtDay / SECONDS_PER_DAY;
  const maxJceRatePerUtDay =
    (1 + maxAbsDeltaTDaysDerivativePerUtDay) / DAYS_PER_JULIAN_CENTURY;
  const maxJmeRatePerUtDay = maxJceRatePerUtDay / 10;

  return Object.freeze({
    dtBranch:"dtExt-jsd-31",
    transitionEndYear,
    shouxingYearMin:minYear,
    shouxingYearMax:maxYear,
    maxAbsDeltaTSecondsDerivativePerUtDay,
    maxAbsDeltaTDaysDerivativePerUtDay,
    maxJceRatePerUtDay,
    maxJmeRatePerUtDay
  });
}

function earthLongitudeBounds(jmeMin, jmeMax, runtime) {
  const maxAbsX = Math.max(Math.abs(jmeMin), Math.abs(jmeMax));
  const secularCoefficientsRad = Array(6).fill(0);
  let oscillatoryDerivativeBoundRadPerJme = 0;
  let oscillatoryTermCount = 0;
  let secularTermCount = 0;

  for (let i = 0; i < 6; i += 1) {
    for (let j = runtime.boundaries[i]; j < runtime.boundaries[i + 1]; j += 3) {
      const amplitude = runtime.xl0[j] / runtime.xl0[0];
      const phase = runtime.xl0[j + 1];
      const frequency = runtime.xl0[j + 2];
      if (frequency === 0) {
        secularCoefficientsRad[i] += amplitude * Math.cos(phase);
        secularTermCount += 1;
      } else {
        const powerDerivative = i === 0 ? 0 : i * maxAbsX ** (i - 1);
        const phaseDerivative = Math.abs(frequency) * maxAbsX ** i;
        oscillatoryDerivativeBoundRadPerJme +=
          Math.abs(amplitude) * (powerDerivative + phaseDerivative);
        oscillatoryTermCount += 1;
      }
    }
  }

  const correctionCoefficientsRad = [
    -0.0728,
    -2.7702,
    -1.1019,
    -0.0996
  ].map(value => value / runtime.secondPerRad);
  for (let i = 0; i < correctionCoefficientsRad.length; i += 1) {
    secularCoefficientsRad[i] += correctionCoefficientsRad[i];
  }

  const secularDerivativeBoundRadPerJme =
    polynomialDerivativeAbsoluteBound(secularCoefficientsRad, maxAbsX);
  const totalDerivativeBoundRadPerJme =
    secularDerivativeBoundRadPerJme + oscillatoryDerivativeBoundRadPerJme;

  const meanLongitudeCoefficientsRad =
    EQUATION_OF_TIME_SUN_MEAN_LONGITUDE_COEFFICIENTS.map(value => value * DEG_TO_RAD);
  const differenceCoefficientsRad = Array(
    Math.max(meanLongitudeCoefficientsRad.length, secularCoefficientsRad.length)
  ).fill(0);
  for (let i = 0; i < differenceCoefficientsRad.length; i += 1) {
    differenceCoefficientsRad[i] =
      (meanLongitudeCoefficientsRad[i] ?? 0) - (secularCoefficientsRad[i] ?? 0);
  }
  const secularDifferenceDerivativeBoundRadPerJme =
    polynomialDerivativeAbsoluteBound(differenceCoefficientsRad, maxAbsX);
  const meanMinusEarthDerivativeBoundRadPerJme =
    secularDifferenceDerivativeBoundRadPerJme + oscillatoryDerivativeBoundRadPerJme;

  return Object.freeze({
    maxAbsJme:maxAbsX,
    secularTermCount,
    oscillatoryTermCount,
    secularCoefficientsRad:Object.freeze(secularCoefficientsRad),
    correctionCoefficientsRad:Object.freeze(correctionCoefficientsRad),
    meanLongitudeCoefficientsRad:Object.freeze(meanLongitudeCoefficientsRad),
    meanMinusEarthSecularDifferenceCoefficientsRad:Object.freeze(differenceCoefficientsRad),
    secularDerivativeBoundRadPerJme,
    oscillatoryDerivativeBoundRadPerJme,
    totalDerivativeBoundRadPerJme,
    meanMinusEarthSecularDerivativeBoundRadPerJme:secularDifferenceDerivativeBoundRadPerJme,
    meanMinusEarthDerivativeBoundRadPerJme
  });
}

function nutationBounds(jceMin, jceMax, runtime) {
  const maxAbsT = Math.max(Math.abs(jceMin), Math.abs(jceMax));
  let valueBoundRad = 0;
  let derivativeBoundRadPerJce = 0;

  for (let i = 0; i < runtime.nutB.length; i += 5) {
    const baseAmplitude = runtime.nutB[i + 3];
    const firstTermTimeAmplitude = i === 0;
    const amplitudeAtMin = baseAmplitude + (firstTermTimeAmplitude ? -1.742 * jceMin : 0);
    const amplitudeAtMax = baseAmplitude + (firstTermTimeAmplitude ? -1.742 * jceMax : 0);
    const amplitudeBound = maxAbsEndpointLinear(amplitudeAtMin, amplitudeAtMax);
    const amplitudeDerivativeBound = firstTermTimeAmplitude ? 1.742 : 0;
    const phaseDerivativeBound =
      Math.abs(runtime.nutB[i + 1]) + 2 * Math.abs(runtime.nutB[i + 2]) * maxAbsT;

    valueBoundRad += amplitudeBound / 100 / runtime.secondPerRad;
    derivativeBoundRadPerJce +=
      (amplitudeDerivativeBound + amplitudeBound * phaseDerivativeBound)
      / 100
      / runtime.secondPerRad;
  }

  return Object.freeze({
    termCount:runtime.nutB.length / 5,
    maxAbsJce:maxAbsT,
    valueBoundRad,
    derivativeBoundRadPerJce
  });
}

function gxcBounds(jceMin, jceMax, runtime) {
  const maxAbsT = Math.max(Math.abs(jceMin), Math.abs(jceMax));
  const eccentricityCoefficients = [0.016708634, -0.000042037, -0.0000001267];
  const eccentricityBound = polynomialAbsoluteBound(eccentricityCoefficients, maxAbsT);
  const eccentricityDerivativeBound =
    polynomialDerivativeAbsoluteBound(eccentricityCoefficients, maxAbsT);
  const phaseDerivativeBound = 628.301955 + 2 * 0.000002732 * maxAbsT;
  const derivativeBoundRadPerJce =
    20.49552
    * (eccentricityDerivativeBound + eccentricityBound * phaseDerivativeBound)
    / runtime.secondPerRad;

  return Object.freeze({
    eccentricityBound,
    eccentricityDerivativeBoundPerJce:eccentricityDerivativeBound,
    phaseDerivativeBoundRadPerJce:phaseDerivativeBound,
    derivativeBoundRadPerJce
  });
}

function obliquityBounds(jmeMin, jmeMax) {
  const maxAbsU = Math.max(Math.abs(jmeMin / 10), Math.abs(jmeMax / 10));
  const coefficients = EQUATION_OF_TIME_MEAN_OBLIQUITY_COEFFICIENTS;
  const absoluteBoundDegrees = polynomialAbsoluteBound(coefficients, maxAbsU) / 3600;
  const derivativeBoundDegreesPerJme =
    polynomialDerivativeAbsoluteBound(coefficients, maxAbsU) / 10 / 3600;
  const absoluteBoundRad = absoluteBoundDegrees * DEG_TO_RAD;
  const derivativeBoundRadPerJme = derivativeBoundDegreesPerJme * DEG_TO_RAD;
  if (!(absoluteBoundRad > 0 && absoluteBoundRad < Math.PI / 2)) {
    throw new Error(`obliquity bound must stay inside (-pi/2, pi/2), got ${absoluteBoundRad}`);
  }
  return Object.freeze({
    maxAbsU,
    absoluteBoundDegrees,
    absoluteBoundRad,
    derivativeBoundDegreesPerJme,
    derivativeBoundRadPerJme
  });
}

function rightAscensionGeometry(obliquityAbsoluteBoundRad) {
  const cosE = Math.cos(obliquityAbsoluteBoundRad);
  const sinE = Math.sin(obliquityAbsoluteBoundRad);
  if (!(cosE > 0)) throw new Error("right-ascension derivative denominator bound must be positive");
  const qMin = cosE;
  const qMax = 1 / cosE;
  const qDeviationFromOneBound = Math.max(1 - qMin, qMax - 1);
  const epsilonPartialBound = sinE / (2 * cosE * cosE);
  return Object.freeze({
    denominatorLowerBound:cosE * cosE,
    lambdaPartialMin:qMin,
    lambdaPartialMax:qMax,
    lambdaPartialDeviationFromOneBound:qDeviationFromOneBound,
    epsilonPartialAbsoluteBound:epsilonPartialBound
  });
}

const runtime = auditRuntimeTables();
const startInput = { year:TARGET_YEAR, month:1, day:1, hour:0, minute:0, second:0 };
const endInput = { year:TARGET_YEAR + 1, month:1, day:1, hour:0, minute:0, second:0 };
const startContext = equationOfTime(startInput, 0);
const endContext = equationOfTime(endInput, 0);
if (!(endContext.julianCenturyEphemeris > startContext.julianCenturyEphemeris)) {
  throw new Error("production ephemeris time must increase across year 4006");
}

const jceMin = startContext.julianCenturyEphemeris;
const jceMax = endContext.julianCenturyEphemeris;
const jmeMin = startContext.julianMillenniumEphemeris;
const jmeMax = endContext.julianMillenniumEphemeris;
const sourceAuditProbes = auditSourceRelations(
  [jceMin, (jceMin + jceMax) / 2, jceMax],
  runtime
);
const timeRate = deltaTAndEphemerisTimeBound(startContext, endContext, runtime);
const earth = earthLongitudeBounds(jmeMin, jmeMax, runtime);
const nutation = nutationBounds(jceMin, jceMax, runtime);
const gxc = gxcBounds(jceMin, jceMax, runtime);
const obliquity = obliquityBounds(jmeMin, jmeMax);
const raGeometry = rightAscensionGeometry(obliquity.absoluteBoundRad);

const earthRateBoundRadPerUtDay = earth.totalDerivativeBoundRadPerJme * timeRate.maxJmeRatePerUtDay;
const meanMinusEarthRateBoundRadPerUtDay =
  earth.meanMinusEarthDerivativeBoundRadPerJme * timeRate.maxJmeRatePerUtDay;
const nutationRateBoundRadPerUtDay =
  nutation.derivativeBoundRadPerJce * timeRate.maxJceRatePerUtDay;
const gxcRateBoundRadPerUtDay =
  gxc.derivativeBoundRadPerJce * timeRate.maxJceRatePerUtDay;
const obliquityRateBoundRadPerUtDay =
  obliquity.derivativeBoundRadPerJme * timeRate.maxJmeRatePerUtDay;

const apparentLongitudeRateBoundRadPerUtDay =
  earthRateBoundRadPerUtDay + nutationRateBoundRadPerUtDay + gxcRateBoundRadPerUtDay;
const meanMinusApparentLongitudeRateBoundRadPerUtDay =
  meanMinusEarthRateBoundRadPerUtDay + nutationRateBoundRadPerUtDay + gxcRateBoundRadPerUtDay;

// alpha(lambda, epsilon) = atan2(cos(epsilon) sin(lambda), cos(lambda)).
// Preserve the dominant cancellation by writing
//   L0' - alpha' = (L0' - lambda') + (1-q) lambda' - p epsilon'
// where q=d alpha/d lambda and p=d alpha/d epsilon.
const meanMinusRightAscensionRateBoundRadPerUtDay =
  meanMinusApparentLongitudeRateBoundRadPerUtDay
  + raGeometry.lambdaPartialDeviationFromOneBound * apparentLongitudeRateBoundRadPerUtDay
  + raGeometry.epsilonPartialAbsoluteBound * obliquityRateBoundRadPerUtDay;

// Production raw EoT angle is
//   L0 - alpha + psi*cos(epsilon) - constant.
const nutationProjectionRateBoundRadPerUtDay =
  nutationRateBoundRadPerUtDay
  + nutation.valueBoundRad
    * Math.sin(obliquity.absoluteBoundRad)
    * obliquityRateBoundRadPerUtDay;
const productionEotAngleDerivativeBoundRadPerUtDay =
  meanMinusRightAscensionRateBoundRadPerUtDay + nutationProjectionRateBoundRadPerUtDay;
const productionEotDerivativeBoundSolarSecondsPerUtDay =
  productionEotAngleDerivativeBoundRadPerUtDay * RAD_TO_DEG * SOLAR_SECONDS_PER_DEGREE;

assertFinite("productionEotDerivativeBoundSolarSecondsPerUtDay", productionEotDerivativeBoundSolarSecondsPerUtDay);
if (!(productionEotDerivativeBoundSolarSecondsPerUtDay > 0)) {
  throw new Error("production EoT derivative bound must be positive");
}

const remainingPlanningResidualBudgetSecondsPerDay =
  PLANNING_RESIDUAL_LIPSCHITZ_BUDGET_SECONDS_PER_DAY
  - productionEotDerivativeBoundSolarSecondsPerUtDay;

const manifest = Object.freeze({
  generatedAt:new Date().toISOString(),
  purpose:"analytic coefficient-bound certificate for the production year-4006 Equation-of-Time time derivative",
  target:Object.freeze({
    year:TARGET_YEAR,
    domain:"4006-01-01T00:00:00 through 4007-01-01T00:00:00 on the production zero-offset timeline",
    inputTimeline:"UT-like numerical timeline used by production equationOfTime(input, 0)",
    jceMin,
    jceMax,
    jmeMin,
    jmeMax
  }),
  sourceAudit:Object.freeze({
    tymePackage:"tyme4ts@1.5.2",
    xl0Length:runtime.xl0.length,
    nutBLength:runtime.nutB.length,
    dtAtLength:runtime.dtAt.length,
    secondPerRad:runtime.secondPerRad,
    xl0Sha256:sha256Json(runtime.xl0),
    nutBSha256:sha256Json(runtime.nutB),
    dtAtSha256:sha256Json(runtime.dtAt),
    reconstructionToleranceRad:SOURCE_AUDIT_TOLERANCE_RAD,
    reconstructionProbes:sourceAuditProbes,
    productionCoefficientTables:Object.freeze({
      meanObliquitySha256:sha256Json(EQUATION_OF_TIME_MEAN_OBLIQUITY_COEFFICIENTS),
      sunMeanLongitudeSha256:sha256Json(EQUATION_OF_TIME_SUN_MEAN_LONGITUDE_COEFFICIENTS)
    })
  }),
  proof:Object.freeze({
    method:"finite-series-absolute-derivative-bound-with-secular-cancellation-v1",
    deltaTAndTimeRate:timeRate,
    earthLongitude:earth,
    nutation,
    gxcSunLongitude:gxc,
    meanObliquity:obliquity,
    rightAscensionGeometry:raGeometry,
    ratesPerUtDay:Object.freeze({
      earthLongitudeRad:earthRateBoundRadPerUtDay,
      meanMinusEarthLongitudeRad:meanMinusEarthRateBoundRadPerUtDay,
      nutationLongitudeRad:nutationRateBoundRadPerUtDay,
      aberrationLongitudeRad:gxcRateBoundRadPerUtDay,
      obliquityRad:obliquityRateBoundRadPerUtDay,
      apparentLongitudeRad:apparentLongitudeRateBoundRadPerUtDay,
      meanMinusApparentLongitudeRad:meanMinusApparentLongitudeRateBoundRadPerUtDay,
      meanMinusRightAscensionRad:meanMinusRightAscensionRateBoundRadPerUtDay,
      nutationProjectionRad:nutationProjectionRateBoundRadPerUtDay,
      productionEotAngleRad:productionEotAngleDerivativeBoundRadPerUtDay,
      productionEotSolarSeconds:productionEotDerivativeBoundSolarSecondsPerUtDay
    }),
    wrapSemantics:Object.freeze({
      physicalQuantity:"continuous Equation-of-Time angle modulo full 2pi turns",
      normalizationAnd1440MinuteWrapChangeDerivativeByFullTurnConstantsOnly:true,
      boundAppliesToContinuousLift:true
    })
  }),
  planning:Object.freeze({
    residualTwoSecondCapExistingGridLipschitzBudgetSecondsPerDay:
      PLANNING_RESIDUAL_LIPSCHITZ_BUDGET_SECONDS_PER_DAY,
    productionDerivativeBoundSolarSecondsPerDay:productionEotDerivativeBoundSolarSecondsPerUtDay,
    remainingBudgetForIndependentSwissDerivativeBoundSecondsPerDay:
      remainingPlanningResidualBudgetSecondsPerDay,
    empiricalResidualSlopeSecondsPerDay:
      RECON_OBSERVED_PRODUCTION_RESIDUAL_SLOPE_SECONDS_PER_DAY,
    empiricalResidualSlopeIsNotUsedInCertificate:true
  }),
  interpretation:Object.freeze({
    productionDerivativeCertified:true,
    productionDerivativeCertificateScope:"production-equation-of-time-year-4006-only",
    independentSwissDerivativeCertified:false,
    residualDerivativeCertified:false,
    continuousResidualUpperBound:false,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false,
    reason:"This certificate bounds only the production EoT derivative from audited finite coefficient tables and analytic inequalities. A separate independent Swiss-reference derivative certificate is still required before the production-minus-Swiss residual can receive a certified Lipschitz bound."
  })
});

await mkdir(OUTPUT_DIR, { recursive:true });
await writeFile(`${OUTPUT_DIR}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
