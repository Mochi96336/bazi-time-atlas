import test from "node:test";
import assert from "node:assert/strict";
import { solarTermEventForCivilYear } from "../src/astronomy/solar-term-boundaries.js";
import { resolveSeasonalBoundary } from "../src/recurrence/seasonal-boundary-authority.js";
import {
  SEASONAL_FIXED_ZONE_PROJECTION_CONTRACT,
  projectSeasonalBoundaryToFixedZone
} from "../src/recurrence/seasonal-fixed-zone-projection.js";

const LI_CHUN_LONGITUDE = 315;

test("fixed-zone projection contract refuses to claim UTC or exact civil time", () => {
  assert.equal(SEASONAL_FIXED_ZONE_PROJECTION_CONTRACT.inputTimeScale, "TT");
  assert.equal(
    SEASONAL_FIXED_ZONE_PROJECTION_CONTRACT.outputClockSemantics,
    "proleptic-gregorian-fixed-offset-from-ut1"
  );
  assert.equal(SEASONAL_FIXED_ZONE_PROJECTION_CONTRACT.resolvesUtc, false);
  assert.equal(SEASONAL_FIXED_ZONE_PROJECTION_CONTRACT.resolvesCivilTimezone, false);
  assert.equal(SEASONAL_FIXED_ZONE_PROJECTION_CONTRACT.exactCivilTimeClaim, false);
});

test("modern ShouXing Li Chun projects back onto the existing +08 reference clock", () => {
  const boundary = resolveSeasonalBoundary({ year:2024, longitudeDegrees:LI_CHUN_LONGITUDE });
  const projection = projectSeasonalBoundaryToFixedZone(boundary, {
    localOffsetHoursFromUt1:8
  });
  const reference = solarTermEventForCivilYear(2024, "立春").referenceFields;

  assert.equal(projection.status, "resolved");
  assert.equal(projection.certainty, "model-bounded");
  assert.equal(projection.boundaryProviderId, "tyme4ts-1.5.2-shouxing-direct");
  assert.equal(projection.localClock.year, reference.year);
  assert.equal(projection.localClock.month, reference.month);
  assert.equal(projection.localClock.day, reference.day);
  assert.equal(projection.localClock.hour, reference.hour);
  assert.equal(projection.localClock.minute, reference.minute);
  assert.equal(projection.civilTimeResolved, false);
  assert.equal(projection.futureUtcPolicyResolved, false);
});

test("a resolved TT seasonal epoch stays separate from local projection until a fixed-zone basis is bound", () => {
  const boundary = resolveSeasonalBoundary({ year:2024, longitudeDegrees:LI_CHUN_LONGITUDE });
  const projection = projectSeasonalBoundaryToFixedZone(boundary);

  assert.equal(projection.status, "projection-basis-unbound");
  assert.equal(projection.ttJulianDay, boundary.ttJulianDay);
  assert.equal(projection.localClock, null);
  assert.equal(projection.localOffsetHoursFromUt1, null);
});

test("year 4006 DE441 Li Chun projects as an uncertain fixed-zone interval, never exact civil time", () => {
  const boundary = resolveSeasonalBoundary({ year:4006, longitudeDegrees:LI_CHUN_LONGITUDE });
  const projection = projectSeasonalBoundaryToFixedZone(boundary, {
    localOffsetHoursFromUt1:8
  });

  assert.equal(boundary.providerId, "jpl-de441-seasonal-events-v1");
  assert.equal(projection.status, "estimated");
  assert.equal(projection.certainty, "statistical-one-sigma");
  assert.equal(projection.boundaryProviderId, boundary.providerId);
  assert.ok(projection.oneSigmaUncertaintySeconds > 6000);
  assert.ok(projection.interval.localJulianDayMin < projection.localJulianDay);
  assert.ok(projection.localJulianDay < projection.interval.localJulianDayMax);
  assert.equal(projection.localClock.year, 4006);
  assert.equal(projection.localClock.month, 2);
  assert.equal(projection.civilTimeResolved, false);
  assert.equal(projection.futureUtcPolicyResolved, false);
});

test("source-covered but unpublished year 10026 cannot fabricate a local Li Chun marker", () => {
  const boundary = resolveSeasonalBoundary({ year:10026, longitudeDegrees:LI_CHUN_LONGITUDE });
  const projection = projectSeasonalBoundaryToFixedZone(boundary, {
    localOffsetHoursFromUt1:8
  });

  assert.equal(boundary.status, "source-covered-runtime-missing");
  assert.equal(projection.status, "astronomical-epoch-unavailable");
  assert.equal(projection.boundaryStatus, "source-covered-runtime-missing");
  assert.equal(projection.localClock, null);
  assert.equal(projection.interval, null);
});

test("out-of-range fixed-zone offsets fail closed", () => {
  const boundary = resolveSeasonalBoundary({ year:2024, longitudeDegrees:LI_CHUN_LONGITUDE });
  assert.throws(
    () => projectSeasonalBoundaryToFixedZone(boundary, { localOffsetHoursFromUt1:25 }),
    /localOffsetHoursFromUt1/
  );
});
