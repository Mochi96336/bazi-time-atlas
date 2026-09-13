import { BERGER_MODEL } from "./berger-orbit.js";

const J2000_YEAR = 2000;

function source(value) {
  return Object.freeze({
    ...value,
    capabilities:Object.freeze({ ...value.capabilities }),
    coverage:Object.freeze({ ...value.coverage })
  });
}

/**
 * Audit source coverage without conflating an absolute numerical ephemeris with
 * a ready-made solar-term timestamp.
 *
 * An ephemeris basis must provide an absolute state vector on a continuous
 * dynamical-time axis. Turning that state into a Jie crossing still requires an
 * app-side apparent/geocentric solar-longitude-of-date transform and root solve.
 * Long-term orbital / insolation parameter sets can cover an epoch while still
 * lacking the annual absolute phase needed for that job.
 */
export const SEASONAL_EPOCH_SOURCES = Object.freeze([
  source({
    id:"berger-1978-shape",
    label:"Berger 1978 · shape model",
    authority:"Berger 1978 / current atlas implementation",
    sourceUrl:"https://doi.org/10.1175/1520-0469(1978)035%3C2362:LTVODI%3E2.0.CO;2",
    coverage:{
      mode:"absolute-year",
      minYear:BERGER_MODEL.epochYear - BERGER_MODEL.validityYearsFromEpoch,
      maxYear:BERGER_MODEL.epochYear + BERGER_MODEL.validityYearsFromEpoch
    },
    capabilities:{
      relativeSeasonGeometry:true,
      absoluteStateVector:false,
      continuousDynamicalTime:false,
      directSeasonalEpoch:false
    },
    implementation:"bundled-shape-only",
    timeScale:"spring-equinox-normalized phase",
    note:"repo 內已實作長期 eccentricity / perihelion 幾何，但主動移除共同季節平移；不是逐年絕對 state ephemeris。"
  }),
  source({
    id:"jpl-de441",
    label:"JPL DE441",
    authority:"NASA/JPL numerical planetary ephemeris",
    sourceUrl:"https://ssd.jpl.nasa.gov/doc/de440_de441.html",
    coverage:{ mode:"absolute-year", minYear:-13_200, maxYear:17_191 },
    capabilities:{
      relativeSeasonGeometry:true,
      absoluteStateVector:true,
      continuousDynamicalTime:true,
      directSeasonalEpoch:false
    },
    implementation:"not-bundled",
    timeScale:"JED / ephemeris dynamical-time family",
    note:"可作為高品質絕對 Earth/Sun state basis；仍須在 app 內做視／地心太陽黃經-of-date 轉換與交點 root solve。正式解只延伸到 AD 17191。"
  }),
  source({
    id:"la2004-insolation-parameters",
    label:"La2004 · public insolation parameters",
    authority:"Laskar et al. 2004 / IMCCE public insolation files",
    sourceUrl:"https://vo.imcce.fr/insola/earth/online/earth/La2004/index.html",
    coverage:{
      mode:"years-from-j2000",
      minOffsetYears:-101_000_000,
      maxOffsetYears:21_000_000
    },
    capabilities:{
      relativeSeasonGeometry:true,
      absoluteStateVector:false,
      continuousDynamicalTime:false,
      directSeasonalEpoch:false
    },
    implementation:"not-bundled",
    timeScale:"orbital/precessional solution indexed from J2000",
    note:"公開 insolation parameter 檔提供 e、obliquity、moving-equinox perihelion 等長期量；年份 coverage 很長，但不是逐年 Earth/Sun absolute state 或節氣 timestamp。"
  })
]);

function assertYear(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer year`);
}

function coverageBounds(source) {
  if (source.coverage.mode === "absolute-year") {
    return Object.freeze({ minYear:source.coverage.minYear, maxYear:source.coverage.maxYear });
  }
  return Object.freeze({
    minYear:J2000_YEAR + source.coverage.minOffsetYears,
    maxYear:J2000_YEAR + source.coverage.maxOffsetYears
  });
}

function evaluateSource(source, targetYear) {
  const bounds = coverageBounds(source);
  const coversTarget = targetYear >= bounds.minYear && targetYear <= bounds.maxYear;
  const ephemerisBasisCapable = source.capabilities.absoluteStateVector
    && source.capabilities.continuousDynamicalTime;
  const implementedAsBasis = source.implementation === "bundled-absolute-state";
  const qualifiedCoverage = coversTarget && ephemerisBasisCapable;
  // No registered source currently bypasses the app-side longitude/root solver.
  const directSeasonalEpoch = source.capabilities.directSeasonalEpoch;
  const usableNow = coversTarget && directSeasonalEpoch
    || qualifiedCoverage && implementedAsBasis;

  let reason;
  if (!coversTarget) reason = "outside-source-coverage";
  else if (!ephemerisBasisCapable && !directSeasonalEpoch) reason = "parameter-source-without-absolute-state";
  else if (!usableNow) reason = "qualified-ephemeris-basis-not-integrated";
  else reason = "usable";

  return Object.freeze({
    id:source.id,
    label:source.label,
    authority:source.authority,
    sourceUrl:source.sourceUrl,
    targetYear,
    coverage:bounds,
    coversTarget,
    ephemerisBasisCapable,
    directSeasonalEpoch,
    implementedAsBasis,
    qualifiedCoverage,
    usableNow,
    reason,
    timeScale:source.timeScale,
    note:source.note,
    capabilities:source.capabilities
  });
}

function nearestEphemerisCoverageBoundary(evaluations, targetYear) {
  const absoluteSources = evaluations.filter(item => item.ephemerisBasisCapable || item.directSeasonalEpoch);
  if (!absoluteSources.length) return null;
  let best = null;
  for (const item of absoluteSources) {
    const { minYear, maxYear } = item.coverage;
    const boundaryYear = targetYear < minYear ? minYear : targetYear > maxYear ? maxYear : targetYear;
    const gapYears = Math.abs(targetYear - boundaryYear);
    if (!best || gapYears < best.gapYears) {
      best = Object.freeze({ sourceId:item.id, boundaryYear, gapYears });
    }
  }
  return best;
}

export function seasonalEpochSourceAudit({ baseYear, targetYear }) {
  assertYear(baseYear, "baseYear");
  assertYear(targetYear, "targetYear");
  const identity = baseYear === targetYear;
  const evaluations = Object.freeze(SEASONAL_EPOCH_SOURCES.map(item => evaluateSource(item, targetYear)));
  const qualified = evaluations.filter(item => item.qualifiedCoverage || item.coversTarget && item.directSeasonalEpoch);
  const usable = evaluations.filter(item => item.usableNow);
  const nearestEphemerisBoundary = nearestEphemerisCoverageBoundary(evaluations, targetYear);

  let status;
  let blocker;
  if (identity) {
    status = "identity-bypass";
    blocker = null;
  } else if (usable.length) {
    status = "resolved";
    blocker = null;
  } else if (qualified.length) {
    status = "qualified-ephemeris-basis-not-integrated";
    blocker = "implementation-and-seasonal-epoch-solver";
  } else {
    status = "absolute-state-coverage-gap";
    blocker = "ephemeris-source-coverage";
  }

  return Object.freeze({
    baseYear,
    targetYear,
    deltaYears:targetYear - baseYear,
    identity,
    status,
    blocker,
    evaluations,
    qualifiedSourceIds:Object.freeze(qualified.map(item => item.id)),
    usableSourceIds:Object.freeze(usable.map(item => item.id)),
    nearestEphemerisBoundary,
    seasonalEpochSolverRequired:!identity && !usable.length
  });
}
