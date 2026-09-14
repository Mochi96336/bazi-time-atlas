export const SEASONAL_EPOCH_PROVIDER_ROLES = Object.freeze({
  SHAPE_PARAMETERS:"shape-parameters",
  ABSOLUTE_STATE_BASIS:"absolute-state-basis",
  DIRECT_EVENT:"direct-seasonal-event"
});

const PROVIDER_ROLES = new Set(Object.values(SEASONAL_EPOCH_PROVIDER_ROLES));
const J2000_YEAR = 2000;

function assertInteger(value, name) {
  if (!Number.isInteger(value)) throw new RangeError(`${name} must be an integer`);
}

function freezeCoverage(coverage) {
  if (!coverage || typeof coverage !== "object") throw new TypeError("coverage is required");
  if (coverage.mode === "absolute-year") {
    assertInteger(coverage.minYear, "coverage.minYear");
    assertInteger(coverage.maxYear, "coverage.maxYear");
    if (coverage.minYear > coverage.maxYear) throw new RangeError("coverage minYear must be <= maxYear");
    return Object.freeze({ ...coverage });
  }
  if (coverage.mode === "years-from-j2000") {
    assertInteger(coverage.minOffsetYears, "coverage.minOffsetYears");
    assertInteger(coverage.maxOffsetYears, "coverage.maxOffsetYears");
    if (coverage.minOffsetYears > coverage.maxOffsetYears) {
      throw new RangeError("coverage minOffsetYears must be <= maxOffsetYears");
    }
    return Object.freeze({ ...coverage });
  }
  throw new RangeError(`unsupported coverage mode: ${coverage.mode}`);
}

export function defineSeasonalEpochProvider(value) {
  if (!value || typeof value !== "object") throw new TypeError("provider definition is required");
  if (!value.id || typeof value.id !== "string") throw new TypeError("provider.id is required");
  if (!PROVIDER_ROLES.has(value.role)) throw new RangeError(`unsupported seasonal-epoch provider role: ${value.role}`);

  const capabilities = Object.freeze({
    relativeSeasonGeometry:Boolean(value.capabilities?.relativeSeasonGeometry),
    absoluteStateVector:Boolean(value.capabilities?.absoluteStateVector),
    continuousDynamicalTime:Boolean(value.capabilities?.continuousDynamicalTime),
    directSeasonalEpoch:Boolean(value.capabilities?.directSeasonalEpoch)
  });

  if (value.role === SEASONAL_EPOCH_PROVIDER_ROLES.ABSOLUTE_STATE_BASIS) {
    if (!capabilities.absoluteStateVector || !capabilities.continuousDynamicalTime || capabilities.directSeasonalEpoch) {
      throw new TypeError("absolute-state-basis requires absolute state + continuous dynamical time and must not claim direct seasonal epochs");
    }
  }
  if (value.role === SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT) {
    if (!capabilities.directSeasonalEpoch || !capabilities.continuousDynamicalTime) {
      throw new TypeError("direct-seasonal-event requires direct seasonal epochs on a continuous dynamical-time axis");
    }
  }
  if (value.role === SEASONAL_EPOCH_PROVIDER_ROLES.SHAPE_PARAMETERS && capabilities.directSeasonalEpoch) {
    throw new TypeError("shape-parameters cannot claim direct seasonal epochs");
  }

  return Object.freeze({
    ...value,
    coverage:freezeCoverage(value.coverage),
    capabilities
  });
}

export function seasonalEpochCoverageBounds(provider) {
  if (provider.coverage.mode === "absolute-year") {
    return Object.freeze({ minYear:provider.coverage.minYear, maxYear:provider.coverage.maxYear });
  }
  return Object.freeze({
    minYear:J2000_YEAR + provider.coverage.minOffsetYears,
    maxYear:J2000_YEAR + provider.coverage.maxOffsetYears
  });
}

export function seasonalEpochProviderAvailability(provider, targetYear, pipeline) {
  assertInteger(targetYear, "targetYear");
  const bounds = seasonalEpochCoverageBounds(provider);
  const coversTarget = targetYear >= bounds.minYear && targetYear <= bounds.maxYear;
  const role = provider.role;
  const ephemerisBasisCapable = role === SEASONAL_EPOCH_PROVIDER_ROLES.ABSOLUTE_STATE_BASIS;
  const directSeasonalEpoch = role === SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT;
  const stateAdapterIntegrated = ephemerisBasisCapable
    && pipeline.absoluteStateAdapterIds.includes(provider.id);
  const directProviderIntegrated = directSeasonalEpoch
    && pipeline.directEventProviderIds.includes(provider.id);
  const deepTimeSolverReady = Boolean(
    pipeline.apparentGeocentricSolarLongitudeOfDate
    && pipeline.crossingRootSolve
  );
  const qualifiedCoverage = coversTarget && (ephemerisBasisCapable || directSeasonalEpoch);
  const usableNow = coversTarget && (
    directSeasonalEpoch
      ? directProviderIntegrated
      : ephemerisBasisCapable && stateAdapterIntegrated && deepTimeSolverReady
  );

  let reason;
  if (!coversTarget) reason = "outside-source-coverage";
  else if (role === SEASONAL_EPOCH_PROVIDER_ROLES.SHAPE_PARAMETERS) reason = "parameter-source-without-absolute-epoch";
  else if (directSeasonalEpoch && !directProviderIntegrated) reason = "qualified-direct-event-provider-not-integrated";
  else if (ephemerisBasisCapable && !stateAdapterIntegrated) reason = "qualified-ephemeris-basis-not-integrated";
  else if (ephemerisBasisCapable && !deepTimeSolverReady) reason = "deep-time-seasonal-epoch-solver-incomplete";
  else reason = "usable";

  return Object.freeze({
    id:provider.id,
    role,
    targetYear,
    coverage:bounds,
    coversTarget,
    ephemerisBasisCapable,
    directSeasonalEpoch,
    stateAdapterIntegrated,
    directProviderIntegrated,
    implementedAsBasis:stateAdapterIntegrated,
    implementedDirectProvider:directProviderIntegrated,
    deepTimeSolverReady,
    qualifiedCoverage,
    usableNow,
    reason
  });
}
