import test from "node:test";
import assert from "node:assert/strict";
import {
  SEASONAL_EPOCH_SOURCES,
  seasonalEpochSourceAudit
} from "../src/recurrence/seasonal-epoch-source-audit.js";

test("source registry keeps coverage separate from absolute epoch capability", () => {
  const byId = Object.fromEntries(SEASONAL_EPOCH_SOURCES.map(item => [item.id, item]));
  assert.equal(byId["berger-1978-shape"].capabilities.relativeSeasonGeometry, true);
  assert.equal(byId["berger-1978-shape"].capabilities.absoluteOrbitalPhase, false);
  assert.equal(byId["jpl-de441"].capabilities.absoluteOrbitalPhase, true);
  assert.equal(byId["jpl-de441"].capabilities.absoluteDynamicalEpoch, true);
  assert.equal(byId["la2004-insolation-parameters"].capabilities.relativeSeasonGeometry, true);
  assert.equal(byId["la2004-insolation-parameters"].capabilities.absoluteOrbitalPhase, false);
});

test("1980-year recurrence lands inside DE441 coverage but remains unimplemented in the app", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006 });
  assert.equal(result.status, "qualified-source-not-integrated");
  assert.equal(result.blocker, "implementation");
  assert.deepEqual(result.qualifiedSourceIds, ["jpl-de441"]);
  assert.deepEqual(result.usableSourceIds, []);

  const de441 = result.evaluations.find(item => item.id === "jpl-de441");
  assert.equal(de441.coversTarget, true);
  assert.equal(de441.absoluteEpochCapable, true);
  assert.equal(de441.implementedForEpoch, false);
  assert.equal(de441.reason, "qualified-source-not-integrated");
});

test("24000-year recurrence exposes an absolute-phase coverage gap", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:26026 });
  assert.equal(result.status, "absolute-phase-coverage-gap");
  assert.equal(result.blocker, "source-coverage");
  assert.deepEqual(result.qualifiedSourceIds, []);
  assert.deepEqual(result.usableSourceIds, []);

  const de441 = result.evaluations.find(item => item.id === "jpl-de441");
  const berger = result.evaluations.find(item => item.id === "berger-1978-shape");
  const la2004 = result.evaluations.find(item => item.id === "la2004-insolation-parameters");

  assert.equal(de441.coversTarget, false);
  assert.equal(berger.coversTarget, true);
  assert.equal(berger.absoluteEpochCapable, false);
  assert.equal(la2004.coversTarget, true);
  assert.equal(la2004.absoluteEpochCapable, false);

  assert.equal(result.nearestAbsoluteBoundary.sourceId, "jpl-de441");
  assert.equal(result.nearestAbsoluteBoundary.boundaryYear, 17191);
  assert.equal(result.nearestAbsoluteBoundary.gapYears, 8835);
});

test("deep near recurrence still has long-term geometry sources but no qualified absolute ephemeris", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:794026 });
  assert.equal(result.status, "absolute-phase-coverage-gap");
  assert.equal(result.evaluations.find(item => item.id === "berger-1978-shape").coversTarget, true);
  assert.equal(result.evaluations.find(item => item.id === "la2004-insolation-parameters").coversTarget, true);
  assert.equal(result.evaluations.find(item => item.id === "jpl-de441").coversTarget, false);
});

test("identity comparison bypasses cross-epoch source requirements without promoting any source", () => {
  const result = seasonalEpochSourceAudit({ baseYear:2026, targetYear:2026 });
  assert.equal(result.identity, true);
  assert.equal(result.status, "identity-bypass");
  assert.equal(result.blocker, null);
  assert.deepEqual(result.usableSourceIds, []);
});

test("audit requires integer years", () => {
  assert.throws(() => seasonalEpochSourceAudit({ baseYear:2026.5, targetYear:4006 }), /baseYear/);
  assert.throws(() => seasonalEpochSourceAudit({ baseYear:2026, targetYear:4006.25 }), /targetYear/);
});
