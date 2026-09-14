import test from "node:test";
import assert from "node:assert/strict";
import {
  SEASONAL_EPOCH_PROVIDER_ROLES,
  defineSeasonalEpochProvider,
  seasonalEpochCoverageBounds,
  seasonalEpochProviderAvailability
} from "../src/recurrence/seasonal-epoch-provider.js";

const emptyPipeline = Object.freeze({
  absoluteStateAdapterIds:Object.freeze([]),
  directEventProviderIds:Object.freeze([]),
  apparentGeocentricSolarLongitudeOfDate:false,
  crossingRootSolve:false
});

test("provider roles keep shape, absolute-state basis and direct event distinct", () => {
  assert.deepEqual(Object.values(SEASONAL_EPOCH_PROVIDER_ROLES), [
    "shape-parameters",
    "absolute-state-basis",
    "direct-seasonal-event"
  ]);
});

test("absolute-state basis needs state integration plus the app crossing solver", () => {
  const provider = defineSeasonalEpochProvider({
    id:"state-fixture",
    role:SEASONAL_EPOCH_PROVIDER_ROLES.ABSOLUTE_STATE_BASIS,
    coverage:{ mode:"absolute-year", minYear:-100, maxYear:5000 },
    capabilities:{
      relativeSeasonGeometry:true,
      absoluteStateVector:true,
      continuousDynamicalTime:true,
      directSeasonalEpoch:false
    }
  });

  const notIntegrated = seasonalEpochProviderAvailability(provider, 4006, emptyPipeline);
  assert.equal(notIntegrated.qualifiedCoverage, true);
  assert.equal(notIntegrated.usableNow, false);
  assert.equal(notIntegrated.reason, "qualified-ephemeris-basis-not-integrated");

  const adapterOnly = seasonalEpochProviderAvailability(provider, 4006, {
    ...emptyPipeline,
    absoluteStateAdapterIds:["state-fixture"]
  });
  assert.equal(adapterOnly.stateAdapterIntegrated, true);
  assert.equal(adapterOnly.usableNow, false);
  assert.equal(adapterOnly.reason, "deep-time-seasonal-epoch-solver-incomplete");

  const complete = seasonalEpochProviderAvailability(provider, 4006, {
    ...emptyPipeline,
    absoluteStateAdapterIds:["state-fixture"],
    apparentGeocentricSolarLongitudeOfDate:true,
    crossingRootSolve:true
  });
  assert.equal(complete.usableNow, true);
  assert.equal(complete.reason, "usable");
});

test("direct event provider can supply an epoch without pretending to be an absolute-state adapter", () => {
  const provider = defineSeasonalEpochProvider({
    id:"direct-fixture",
    role:SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT,
    coverage:{ mode:"absolute-year", minYear:-6000, maxYear:10000 },
    capabilities:{
      relativeSeasonGeometry:true,
      absoluteStateVector:false,
      continuousDynamicalTime:true,
      directSeasonalEpoch:true
    }
  });

  const notIntegrated = seasonalEpochProviderAvailability(provider, 4006, emptyPipeline);
  assert.equal(notIntegrated.ephemerisBasisCapable, false);
  assert.equal(notIntegrated.directSeasonalEpoch, true);
  assert.equal(notIntegrated.deepTimeSolverReady, false);
  assert.equal(notIntegrated.qualifiedCoverage, true);
  assert.equal(notIntegrated.usableNow, false);
  assert.equal(notIntegrated.reason, "qualified-direct-event-provider-not-integrated");

  const integrated = seasonalEpochProviderAvailability(provider, 4006, {
    ...emptyPipeline,
    directEventProviderIds:["direct-fixture"]
  });
  assert.equal(integrated.directProviderIntegrated, true);
  assert.equal(integrated.stateAdapterIntegrated, false);
  assert.equal(integrated.deepTimeSolverReady, false);
  assert.equal(integrated.usableNow, true);
  assert.equal(integrated.reason, "usable");
});

test("direct event coverage does not leak beyond its declared year range", () => {
  const provider = defineSeasonalEpochProvider({
    id:"direct-range-fixture",
    role:SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT,
    coverage:{ mode:"absolute-year", minYear:-6000, maxYear:10000 },
    capabilities:{
      relativeSeasonGeometry:true,
      absoluteStateVector:false,
      continuousDynamicalTime:true,
      directSeasonalEpoch:true
    }
  });
  assert.deepEqual(seasonalEpochCoverageBounds(provider), { minYear:-6000, maxYear:10000 });
  const result = seasonalEpochProviderAvailability(provider, 26026, {
    ...emptyPipeline,
    directEventProviderIds:["direct-range-fixture"]
  });
  assert.equal(result.coversTarget, false);
  assert.equal(result.qualifiedCoverage, false);
  assert.equal(result.usableNow, false);
  assert.equal(result.reason, "outside-source-coverage");
});

test("provider definitions reject role capability contradictions", () => {
  assert.throws(() => defineSeasonalEpochProvider({
    id:"bad-state",
    role:SEASONAL_EPOCH_PROVIDER_ROLES.ABSOLUTE_STATE_BASIS,
    coverage:{ mode:"absolute-year", minYear:0, maxYear:1 },
    capabilities:{ absoluteStateVector:false, continuousDynamicalTime:true }
  }), /absolute-state-basis/);

  assert.throws(() => defineSeasonalEpochProvider({
    id:"bad-direct",
    role:SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT,
    coverage:{ mode:"absolute-year", minYear:0, maxYear:1 },
    capabilities:{ directSeasonalEpoch:true, continuousDynamicalTime:false }
  }), /direct-seasonal-event/);
});
