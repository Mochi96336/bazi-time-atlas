import test from "node:test";
import assert from "node:assert/strict";
import { fixedZoneTargetClock } from "../src/recurrence/fixed-zone-target-clock.js";
import {
  LI_CHUN_TARGET_RESOLUTION_CONTRACT,
  resolveLiChunYearSideFromTargetInstant
} from "../src/recurrence/li-chun-target-resolution.js";

function targetAt(hour, minute = 0, second = 0) {
  return fixedZoneTargetClock(
    { year:2024, month:2, day:4, hour, minute, second },
    8
  ).targetInstant;
}

test("2024 Li Chun boundary day resolves before and after on a shared TT basis", () => {
  const before = resolveLiChunYearSideFromTargetInstant({
    year:2024,
    targetInstant:targetAt(0)
  });
  const after = resolveLiChunYearSideFromTargetInstant({
    year:2024,
    targetInstant:targetAt(23, 59, 59)
  });

  assert.equal(before.status, "resolved");
  assert.equal(before.side, "before");
  assert.ok(before.deltaSeconds < 0);
  assert.equal(after.status, "resolved");
  assert.equal(after.side, "after");
  assert.ok(after.deltaSeconds > 0);
  assert.equal(before.providerId, LI_CHUN_TARGET_RESOLUTION_CONTRACT.seasonalProviderId);
});

test("Li Chun instant resolution fails closed outside validated direct-provider coverage", () => {
  const target = fixedZoneTargetClock(
    { year:2426, month:2, day:4, hour:23, minute:59, second:59 },
    8
  ).targetInstant;
  const result = resolveLiChunYearSideFromTargetInstant({
    year:2426,
    targetInstant:target
  });

  assert.equal(result.status, "outside-validated-coverage");
  assert.equal(result.side, null);
  assert.equal(result.minYear, 1900);
  assert.equal(result.maxYear, 2100);
});

test("Li Chun instant resolution preserves date-only ambiguity", () => {
  const result = resolveLiChunYearSideFromTargetInstant({
    year:2024,
    targetInstant:null
  });

  assert.equal(result.status, "target-instant-unbound");
  assert.equal(result.side, null);
});
