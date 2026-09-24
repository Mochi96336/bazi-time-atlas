import test from "node:test";
import assert from "node:assert/strict";
import {
  DE441_SEASONAL_EVENT_DATA_PROVIDER
} from "../src/astronomy/de441-seasonal-event-data-product.js";
import {
  TYME_SHOUXING_DIRECT_PROVIDER
} from "../src/astronomy/direct-seasonal-event-provider.js";
import {
  productionSeasonalEventForLongitude
} from "../src/recurrence/seasonal-epoch-runtime-registry.js";
import {
  SEASONAL_BOUNDARY_AUTHORITY_CONTRACT,
  resolveSeasonalBoundary
} from "../src/recurrence/seasonal-boundary-authority.js";

const LI_CHUN_LONGITUDE = 315;

test("seasonal boundary authority is explicitly astronomical rather than civil-time authority", () => {
  assert.equal(SEASONAL_BOUNDARY_AUTHORITY_CONTRACT.outputClaim, "astronomical-seasonal-epoch-only");
  assert.equal(SEASONAL_BOUNDARY_AUTHORITY_CONTRACT.civilTimeResolved, false);
});

test("modern Li Chun uses the bounded ShouXing model without calling the whole window independently validated", () => {
  const result = resolveSeasonalBoundary({ year:2026, longitudeDegrees:LI_CHUN_LONGITUDE });

  assert.equal(result.status, "resolved");
  assert.equal(result.authorityClass, "declared-model-direct-event");
  assert.equal(result.providerId, TYME_SHOUXING_DIRECT_PROVIDER.id);
  assert.equal(result.timeScale, "TT");
  assert.ok(Number.isFinite(result.ttJulianDay));
  assert.deepEqual(result.sourceCoverage, { minYear:1900, maxYear:2100 });
  assert.ok(result.evidenceIds.includes("jpl-horizons-de441-shouxing-2026-24-term"));
});

test("year 4006 prefers the reviewed production DE441 direct-event runtime over ShouXing", () => {
  const result = resolveSeasonalBoundary({ year:4006, longitudeDegrees:LI_CHUN_LONGITUDE });
  const expected = productionSeasonalEventForLongitude({
    providerId:DE441_SEASONAL_EVENT_DATA_PROVIDER.id,
    year:4006,
    longitudeDegrees:LI_CHUN_LONGITUDE
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.authorityClass, "reviewed-production-direct-event");
  assert.equal(result.providerId, DE441_SEASONAL_EVENT_DATA_PROVIDER.id);
  assert.equal(result.timeScale, "TT");
  assert.equal(result.ttJulianDay, expected.ttJulianDay);
  assert.equal(result.event.sourceEvidenceId, expected.sourceEvidenceId);
  assert.notEqual(result.providerId, TYME_SHOUXING_DIRECT_PROVIDER.id);
});

test("year 10026 resolves pinned DE441-derived research evidence without granting production authority", () => {
  const result = resolveSeasonalBoundary({ year:10026, longitudeDegrees:LI_CHUN_LONGITUDE });

  assert.equal(result.status, "resolved-research-evidence");
  assert.equal(result.epochStatus, "resolved");
  assert.equal(result.authorityClass, "source-derived-research-evidence");
  assert.equal(result.providerRole, "research-source-derived-event");
  assert.equal(result.timeScale, "TT");
  assert.equal(result.ttJulianDay, 5383013.532143416);
  assert.deepEqual(result.sourceIds, ["jpl-de441"]);
  assert.deepEqual(result.sourceCoverage, { minYear:10026, maxYear:10026 });
  assert.equal(result.evidenceClass, "source-derived-reconstruction");
  assert.equal(result.independentTargetYearTruth, false);
  assert.equal(result.sourceDerivedTargetYear, true);
  assert.equal(result.productionAuthorityGranted, false);
  assert.equal(result.blocker, "target-year-independent-validation");
});

test("year 26026 reports an absolute ephemeris source coverage gap rather than a generic unavailable state", () => {
  const result = resolveSeasonalBoundary({ year:26026, longitudeDegrees:LI_CHUN_LONGITUDE });

  assert.equal(result.status, "absolute-source-unavailable");
  assert.equal(result.epochStatus, "unresolved");
  assert.equal(result.authorityClass, "no-qualified-absolute-source");
  assert.equal(result.ttJulianDay, null);
  assert.equal(result.blocker, "ephemeris-source-coverage");
  assert.deepEqual(result.nearestEphemerisBoundary, {
    sourceId:"jpl-de441",
    role:"absolute-state-basis",
    boundaryYear:17191,
    gapYears:8835
  });
});
