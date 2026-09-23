import test from "node:test";
import assert from "node:assert/strict";
import {
  publishSelectedTargetInstant,
  readSelectedTargetInstant
} from "../src/recurrence/target-instant-instrument.js";
import { fixedZoneTargetClock } from "../src/recurrence/fixed-zone-target-clock.js";

test("selected target instant instrument contract round-trips fixed-zone UT1 bindings", () => {
  const dataset = {};
  const target = fixedZoneTargetClock(
    { year:2024, month:2, day:4, hour:12, minute:34, second:56 },
    8
  ).targetInstant;

  publishSelectedTargetInstant(dataset, target);
  const parsed = readSelectedTargetInstant(dataset);

  assert.equal(dataset.selectedTargetInstantBasis, "fixed-zone-from-ut1");
  assert.equal(dataset.selectedTargetInstantBound, "true");
  assert.equal(parsed.basis, target.basis);
  assert.equal(parsed.julianDay, target.julianDay);
  assert.equal(parsed.localOffsetHoursFromUt1, 8);
});

test("publishing date-only target clears stale instant coordinates", () => {
  const dataset = {
    selectedTargetInstantBasis:"fixed-zone-from-ut1",
    selectedTargetInstantBound:"true",
    selectedTargetInstantJulianDay:"2460344.5",
    selectedTargetInstantLocalOffsetHoursFromUt1:"8"
  };

  publishSelectedTargetInstant(dataset, null);
  const parsed = readSelectedTargetInstant(dataset);

  assert.equal(dataset.selectedTargetInstantBasis, "date-only");
  assert.equal(dataset.selectedTargetInstantBound, "false");
  assert.equal("selectedTargetInstantJulianDay" in dataset, false);
  assert.equal("selectedTargetInstantLocalOffsetHoursFromUt1" in dataset, false);
  assert.equal(parsed.bound, false);
  assert.equal(parsed.basis, "date-only");
});
