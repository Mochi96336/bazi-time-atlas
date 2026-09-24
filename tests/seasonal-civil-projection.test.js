import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveSeasonalBoundary
} from "../src/recurrence/seasonal-boundary-authority.js";
import {
  SEASONAL_CIVIL_PROJECTION_CONTRACT,
  projectSeasonalBoundaryToCivil
} from "../src/recurrence/seasonal-civil-projection.js";

const LI_CHUN = 315;

test("projection contract refuses to call a fixed-offset-from-UT1 clock future civil timezone truth", () => {
  assert.deepEqual(
    SEASONAL_CIVIL_PROJECTION_CONTRACT.statuses,
    ["resolved", "estimated", "basis-unbound", "unavailable"]
  );
  assert.equal(SEASONAL_CIVIL_PROJECTION_CONTRACT.futureUtcPolicyResolved, false);
  assert.equal(SEASONAL_CIVIL_PROJECTION_CONTRACT.civilTimezonePolicyResolved, false);
  assert.equal(SEASONAL_CIVIL_PROJECTION_CONTRACT.deepTimeEstimateIsDeterministic, false);
});

test("a resolved modern Li Chun remains basis-unbound until the fixed UT1 offset is explicit", () => {
  const boundary = resolveSeasonalBoundary({ year:2026, longitudeDegrees:LI_CHUN });
  const result = projectSeasonalBoundaryToCivil({ year:2026, boundary });

  assert.equal(result.status, "basis-unbound");
  assert.equal(result.localClockResolved, false);
  assert.equal(result.blocker, "fixed-offset-from-ut1-unbound");
});

test("modern Li Chun can project to an explicit +8 fixed-zone research clock without claiming future UTC", () => {
  const boundary = resolveSeasonalBoundary({ year:2026, longitudeDegrees:LI_CHUN });
  const result = projectSeasonalBoundaryToCivil({
    year:2026,
    boundary,
    localOffsetHoursFromUt1:8
  });

  assert.equal(result.status, "resolved");
  assert.equal(result.localClockResolved, true);
  assert.equal(result.deterministicWithinModel, true);
  assert.equal(result.projectionBasis, "proleptic-fixed-offset-from-ut1");
  assert.equal(result.futureUtcPolicyResolved, false);
  assert.equal(result.civilTimezonePolicyResolved, false);
  assert.equal(result.localClock.year, 2026);
  assert.equal(result.localClock.month, 2);
  assert.ok(result.localClock.day >= 3 && result.localClock.day <= 5);
  assert.equal(result.earthRotationBridge, "tyme4ts-1.5.2-shouxing-delta-t-model");
});

test("year 4006 DE441 Li Chun gets an uncertain local-clock interval rather than an exact civil position", () => {
  const boundary = resolveSeasonalBoundary({ year:4006, longitudeDegrees:LI_CHUN });
  const result = projectSeasonalBoundaryToCivil({
    year:4006,
    boundary,
    localOffsetHoursFromUt1:8
  });

  assert.equal(boundary.providerId, "jpl-de441-seasonal-events-v1");
  assert.equal(result.status, "estimated");
  assert.equal(result.localClockResolved, false);
  assert.equal(result.pointEstimateAvailable, true);
  assert.equal(result.deterministicWithinModel, false);
  assert.equal(result.localClock.year, 4006);
  assert.equal(result.localClock.month, 2);
  assert.ok(result.uncertaintySeconds > 6000);
  assert.ok(result.oneSigmaLocalJulianDayMin < result.localJulianDay);
  assert.ok(result.localJulianDay < result.oneSigmaLocalJulianDayMax);
  assert.equal(result.blocker, "deep-time-earth-rotation-uncertainty");
});

test("year 10026 source-derived TT evidence projects only as an uncertain local-clock interval", () => {
  const boundary = resolveSeasonalBoundary({ year:10026, longitudeDegrees:LI_CHUN });
  const result = projectSeasonalBoundaryToCivil({
    year:10026,
    boundary,
    localOffsetHoursFromUt1:8
  });

  assert.equal(boundary.status, "resolved-research-evidence");
  assert.equal(boundary.productionAuthorityGranted, false);
  assert.equal(result.status, "estimated");
  assert.equal(result.pointEstimateAvailable, true);
  assert.equal(result.localClockResolved, false);
  assert.equal(result.deterministicWithinModel, false);
  assert.equal(result.localClock.year, 10026);
  assert.equal(result.localClock.month, 1);
  assert.equal(result.localClock.day, 31);
  assert.ok(result.uncertaintySeconds > 60_000);
  assert.ok(result.oneSigmaLocalJulianDayMin < result.localJulianDay);
  assert.ok(result.localJulianDay < result.oneSigmaLocalJulianDayMax);
  assert.equal(result.blocker, "deep-time-earth-rotation-uncertainty");
});

test("absolute-source gap at year 26026 remains unavailable before civil projection is considered", () => {
  const boundary = resolveSeasonalBoundary({ year:26026, longitudeDegrees:LI_CHUN });
  const result = projectSeasonalBoundaryToCivil({
    year:26026,
    boundary,
    localOffsetHoursFromUt1:8
  });

  assert.equal(boundary.status, "absolute-source-unavailable");
  assert.equal(result.status, "unavailable");
  assert.equal(result.localClockResolved, false);
  assert.equal(result.blocker, "ephemeris-source-coverage");
});
