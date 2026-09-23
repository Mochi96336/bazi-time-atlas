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

test("year 10026 distinguishes DE441 source coverage from missing production runtime", () => {
  const result = resolveSeasonalBoundary({ year:10026, longitudeDegrees:LI_CHUN_LONGITUDE });

  assert.equal(result.status, "source-covered-runtime-missing");
  assert.equal(result.epochStatus, "unresolved");
  assert.equal(result.authorityClass, "qualified-source-without-runtime");
  assert.equal(result.ttJulianDay, null);
  assert.ok(result.sourceIds.includes("jpl-de441"));
  const de441 = result.sourceCoverage.find(item => item.providerId === "jpl-de441");
  assert.deepEqual(de441.coverage, { minYear:-13200, maxYear:17191 });
  assert.equal(result.blocker, "implementation-and-seasonal-epoch-solver");
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
