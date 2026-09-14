import test from "node:test";
import assert from "node:assert/strict";
import {
  SEASONAL_EPOCH_PIPELINE,
  SEASONAL_EPOCH_SOURCES,
  seasonalEpochSourceAudit
} from "../src/recurrence/seasonal-epoch-source-audit.js";

test("source registry keeps shape parameters, state basis and direct events semantically distinct", () => {
  const byId = Object.fromEntries(SEASONAL_EPOCH_SOURCES.map(item => [item.id, item]));
  assert.equal(byId["berger-1978-shape"].role, "shape-parameters");
  assert.equal(byId["berger-1978-shape"].capabilities.relativeSeasonGeometry, true);
  assert.equal(byId["berger-1978-shape"].capabilities.absoluteStateVector, false);
  assert.equal(byId["jpl-de441"].role, "absolute-state-basis");
  assert.equal(byId["jpl-de441"].capabilities.absoluteStateVector, true);
  assert.equal(byId["jpl-de441"].capabilities.continuousDynamicalTime, true);
  assert.equal(byId["jpl-de441"].capabilities.directSeasonalEpoch, false);
  assert.equal(byId["la2004-insolation-parameters"].role, "shape-parameters");
  assert.equal(byId["la2004-insolation-parameters"].capabilities.relativeSeasonGeometry, true);
  assert.equal(byId["la2004-insolation-parameters"].capabilities.absoluteStateVector, false);
  assert.equal(SEASONAL_EPOCH_SOURCES.some(item => item.role === "direct-seasonal-event"), false);
});

test("deep-time app pipeline keeps state adapters and direct event providers in separate registries", () => {
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds, []);
  assert.deepEqual(SEASONAL_EPOCH_PIPELINE.directEventProviderIds, []);
  assert.equal(SEASONAL_EPOCH_PIPELINE.apparentGeocentricSolarLongitudeOfDate, false);
  assert.equal(SEASONAL_EPOCH_PIPELINE.crossingRootSolve, false);

  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.deepTimeSolverReady, false);
  assert.equal(result.seasonalEpochSolverRequired, true);
  assert.equal(result.seasonalEpochProviderIntegrationRequired, false);
  assert.equal(result.absoluteSeasonalEpochAvailable, false);
});

test("1980-year recurrence lands inside DE441 state coverage but still needs app integration and a seasonal-epoch solver", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "qualified-ephemeris-basis-not-integrated");
  assert.equal(result.blocker, "implementation-and-seasonal-epoch-solver");
  assert.equal(result.seasonalEpochSolverRequired, true);
  assert.equal(result.seasonalEpochProviderIntegrationRequired, false);
  assert.deepEqual(result.qualifiedSourceIds, ["jpl-de441"]);
  assert.deepEqual(result.qualifiedStateBasisSourceIds, ["jpl-de441"]);
  assert.deepEqual(result.qualifiedDirectEventSourceIds, []);
  assert.deepEqual(result.usableSourceIds, []);

  const de441 = result.evaluations.find(item => item.id === "jpl-de441");
  assert.equal(de441.role, "absolute-state-basis");
  assert.equal(de441.coversTarget, true);
  assert.equal(de441.ephemerisBasisCapable, true);
  assert.equal(de441.directSeasonalEpoch, false);
  assert.equal(de441.implementedAsBasis, false);
  assert.equal(de441.implementedDirectProvider, false);
  assert.equal(de441.deepTimeSolverReady, false);
  assert.equal(de441.reason, "qualified-ephemeris-basis-not-integrated");
});

test("24000-year recurrence exposes an absolute-epoch provider coverage gap", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:26026 });
  assert.equal(result.status, "absolute-state-coverage-gap");
  assert.equal(result.blocker, "ephemeris-source-coverage");
  assert.equal(result.seasonalEpochSolverRequired, true);
  assert.equal(result.seasonalEpochProviderIntegrationRequired, false);
  assert.deepEqual(result.qualifiedSourceIds, []);
  assert.deepEqual(result.qualifiedStateBasisSourceIds, []);
  assert.deepEqual(result.qualifiedDirectEventSourceIds, []);
  assert.deepEqual(result.usableSourceIds, []);

  const de441 = result.evaluations.find(item => item.id === "jpl-de441");
  const berger = result.evaluations.find(item => item.id === "berger-1978-shape");
  const la2004 = result.evaluations.find(item => item.id === "la2004-insolation-parameters");

  assert.equal(de441.coversTarget, false);
  assert.equal(de441.ephemerisBasisCapable, true);
  assert.equal(berger.coversTarget, true);
  assert.equal(berger.ephemerisBasisCapable, false);
  assert.equal(la2004.coversTarget, true);
  assert.equal(la2004.ephemerisBasisCapable, false);

  assert.equal(result.nearestEphemerisBoundary.sourceId, "jpl-de441");
  assert.equal(result.nearestEphemerisBoundary.role, "absolute-state-basis");
  assert.equal(result.nearestEphemerisBoundary.boundaryYear, 17191);
  assert.equal(result.nearestEphemerisBoundary.gapYears, 8835);
});

test("deep near recurrence still has long-term geometry coverage but no absolute-epoch provider basis", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:794026 });
  assert.equal(result.status, "absolute-state-coverage-gap");
  assert.equal(result.evaluations.find(item => item.id === "berger-1978-shape").coversTarget, true);
  assert.equal(result.evaluations.find(item => item.id === "la2004-insolation-parameters").coversTarget, true);
  assert.equal(result.evaluations.find(item => item.id === "jpl-de441").coversTarget, false);
});

test("identity comparison bypasses cross-epoch source requirements without promoting any source", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:2026 });
  assert.equal(result.identity, true);
  assert.equal(result.status, "identity-bypass");
  assert.equal(result.blocker, null);
  assert.equal(result.seasonalEpochSolverRequired, false);
  assert.equal(result.seasonalEpochProviderIntegrationRequired, false);
  assert.equal(result.absoluteSeasonalEpochAvailable, true);
  assert.deepEqual(result.usableSourceIds, []);
});

test("audit requires integer years", () => {
  assert.throws(() => seasonalEpochSourceAudit({ baseYear:2026.5, targetYear:4006 }), /baseYear/);
  assert.throws(() => seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006.25 }), /targetYear/);
});
