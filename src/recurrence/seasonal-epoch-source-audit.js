import { BERGER_MODEL } from "./berger-orbit.js";
import {
  SEASONAL_EPOCH_PROVIDER_ROLES,
  defineSeasonalEpochProvider,
  seasonalEpochProviderAvailability
} from "./seasonal-epoch-provider.js";

/**
 * Deep-time provider integration is deliberately split by source role.
 *
 * - absolute-state adapters expose an Earth/Sun state basis and therefore still
 *   need the app-owned apparent longitude-of-date transform + crossing solver.
 *   Registration by provider id is not enough: every registered state adapter
 *   must also declare the bounded runtime year coverage actually shipped by the
 *   app. Runtime coverage must never inherit the broader source ephemeris range.
 * - direct-event providers already solve the seasonal longitude crossing and
 *   only need an explicit integration entry here; they must never masquerade
 *   as a DE441/state-vector adapter.
 */
export const SEASONAL_EPOCH_PIPELINE = Object.freeze({
  absoluteStateAdapterIds:Object.freeze([]),
  absoluteStateAdapterRuntimeCoverageById:Object.freeze({}),
  directEventProviderIds:Object.freeze([]),
  apparentGeocentricSolarLongitudeOfDate:false,
  crossingRootSolve:false
});

/**
 * Registry of source capabilities. Coverage alone is not enough: every source
 * has an explicit role describing what it can actually contribute to an
 * absolute seasonal epoch proof.
 */
export const SEASONAL_EPOCH_SOURCES = Object.freeze([
  defineSeasonalEpochProvider({
    id:"berger-1978-shape",
    role:SEASONAL_EPOCH_PROVIDER_ROLES.SHAPE_PARAMETERS,
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
    note:"repo 內已實作長期 eccentricity / perihelion 幾何，但主動移除共同季節平移；它只提供 shape，不是逐年 absolute state 或 seasonal-event timestamp。"
  }),
  defineSeasonalEpochProvider({
    id:"jpl-de441",
    role:SEASONAL_EPOCH_PROVIDER_ROLES.ABSOLUTE_STATE_BASIS,
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
    note:"高品質 absolute Earth/Sun state basis；它本身不是本 app 的節氣 timestamp API，仍須做視／地心太陽黃經-of-date 轉換與 crossing root solve。正式解只延伸到 AD 17191。"
  }),
  defineSeasonalEpochProvider({
    id:"la2004-insolation-parameters",
    role:SEASONAL_EPOCH_PROVIDER_ROLES.SHAPE_PARAMETERS,
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
    note:"公開 insolation parameter 檔提供 e、obliquity、moving-equinox perihelion 等長期量；年份 coverage 很長，但角色仍是 shape/parameters，不是 absolute state 或 direct seasonal event。"
  })
]);

function assertYear(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer year`);
}

function evaluateSource(source, targetYear, pipeline) {
  const availability = seasonalEpochProviderAvailability(source, targetYear, pipeline);
  return Object.freeze({
    ...availability,
    label:source.label,
    authority:source.authority,
    sourceUrl:source.sourceUrl,
    timeScale:source.timeScale,
    note:source.note,
    implementation:source.implementation,
    capabilities:source.capabilities
  });
}

function nearestAbsoluteEpochCoverageBoundary(evaluations, targetYear) {
  const absoluteSources = evaluations.filter(item => item.ephemerisBasisCapable || item.directSeasonalEpoch);
  if (!absoluteSources.length) return null;
  let best = null;
  for (const item of absoluteSources) {
    const { minYear, maxYear } = item.coverage;
    const boundaryYear = targetYear < minYear ? minYear : targetYear > maxYear ? maxYear : targetYear;
    const gapYears = Math.abs(targetYear - boundaryYear);
    if (!best || gapYears < best.gapYears) {
      best = Object.freeze({ sourceId:item.id, role:item.role, boundaryYear, gapYears });
    }
  }
  return best;
}

export function seasonalEpochSourceAudit({ baseYear, targetYear, pipeline = SEASONAL_EPOCH_PIPELINE }) {
  assertYear(baseYear, "baseYear");
  assertYear(targetYear, "targetYear");
  const identity = baseYear === targetYear;
  const evaluations = Object.freeze(SEASONAL_EPOCH_SOURCES.map(item => evaluateSource(item, targetYear, pipeline)));
  const qualified = evaluations.filter(item => item.qualifiedCoverage);
  const qualifiedDirect = qualified.filter(item => item.directSeasonalEpoch);
  const qualifiedState = qualified.filter(item => item.ephemerisBasisCapable);
  const stateNotIntegrated = qualifiedState.filter(item => !item.stateAdapterIntegrated);
  const stateRuntimeUndeclared = qualifiedState.filter(item =>
    item.stateAdapterIntegrated && !item.stateAdapterRuntimeCoverageDeclared
  );
  const stateRuntimeGap = qualifiedState.filter(item =>
    item.stateAdapterIntegrated
    && item.stateAdapterRuntimeCoverageDeclared
    && !item.stateAdapterCoversTarget
  );
  const stateSolverIncomplete = qualifiedState.filter(item =>
    item.stateAdapterIntegrated
    && item.stateAdapterCoversTarget
    && !item.deepTimeSolverReady
  );
  const usable = evaluations.filter(item => item.usableNow);
  const nearestEphemerisBoundary = nearestAbsoluteEpochCoverageBoundary(evaluations, targetYear);
  const deepTimeSolverReady = Boolean(
    pipeline.apparentGeocentricSolarLongitudeOfDate
    && pipeline.crossingRootSolve
  );

  let status;
  let blocker;
  if (identity) {
    status = "identity-bypass";
    blocker = null;
  } else if (usable.length) {
    status = "resolved";
    blocker = null;
  } else if (qualifiedDirect.length) {
    status = "qualified-direct-event-provider-not-integrated";
    blocker = "direct-event-provider-integration";
  } else if (stateRuntimeUndeclared.length) {
    status = "state-adapter-runtime-coverage-undeclared";
    blocker = "runtime-adapter-coverage-contract";
  } else if (stateRuntimeGap.length) {
    status = "state-adapter-runtime-coverage-gap";
    blocker = "runtime-adapter-coverage";
  } else if (stateSolverIncomplete.length) {
    status = "deep-time-seasonal-epoch-solver-incomplete";
    blocker = "seasonal-epoch-solver";
  } else if (stateNotIntegrated.length) {
    status = "qualified-ephemeris-basis-not-integrated";
    blocker = "implementation-and-seasonal-epoch-solver";
  } else {
    // Kept for compatibility with existing evidence. The gap now means there is
    // neither an absolute-state basis nor a direct-event provider covering the target.
    status = "absolute-state-coverage-gap";
    blocker = "ephemeris-source-coverage";
  }

  const seasonalEpochSolverRequired = !identity
    && !usable.length
    && qualifiedDirect.length === 0
    && (qualifiedState.length === 0 || qualifiedState.some(item => !item.deepTimeSolverReady));

  return Object.freeze({
    baseYear,
    targetYear,
    deltaYears:targetYear - baseYear,
    identity,
    status,
    blocker,
    evaluations,
    qualifiedSourceIds:Object.freeze(qualified.map(item => item.id)),
    qualifiedStateBasisSourceIds:Object.freeze(qualifiedState.map(item => item.id)),
    qualifiedDirectEventSourceIds:Object.freeze(qualifiedDirect.map(item => item.id)),
    usableSourceIds:Object.freeze(usable.map(item => item.id)),
    nearestEphemerisBoundary,
    appPipeline:pipeline,
    deepTimeSolverReady,
    absoluteSeasonalEpochAvailable:identity || usable.length > 0,
    seasonalEpochProviderIntegrationRequired:!identity && !usable.length && qualifiedDirect.length > 0,
    seasonalEpochSolverRequired
  });
}
