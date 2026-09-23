import test from "node:test";
import assert from "node:assert/strict";
import { researchYearStripState } from "../src/research-year-strip-view.js";
import { fixedZoneTargetClock } from "../src/recurrence/fixed-zone-target-clock.js";

test("year strip orders the selected date before and after the exact Li Chun boundary", () => {
  const before = researchYearStripState({ year:2024, month:2, day:1 });
  const after = researchYearStripState({ year:2024, month:2, day:10 });

  assert.ok(before.liChun, "2024 Li Chun should be available from the exact solar-term authority");
  assert.ok(after.liChun, "2024 Li Chun should be available from the exact solar-term authority");
  assert.equal(before.selectedLiChunRelation, "before");
  assert.equal(after.selectedLiChunRelation, "after");
  assert.equal(before.selectedBeforeLiChun, true);
  assert.equal(after.selectedBeforeLiChun, false);
  assert.equal(before.selectedYearPillar.name, "癸卯");
  assert.equal(after.selectedYearPillar.name, "甲辰");
  assert.equal(before.liChunTransition.before.name, "癸卯");
  assert.equal(before.liChunTransition.after.name, "甲辰");
  assert.ok(before.selectedPosition < before.liChun.position);
  assert.ok(after.selectedPosition > after.liChun.position);
});

test("year strip does not assign a Ganzhi year from a date-only selection on Li Chun day", () => {
  const boundaryDay = researchYearStripState({ year:2024, month:2, day:4 });

  assert.ok(boundaryDay.liChun, "2024 Li Chun should be available");
  assert.deepEqual(boundaryDay.liChun.date, { year:2024, month:2, day:4 });
  assert.equal(boundaryDay.selectedCivilLiChunRelation, "boundary-day");
  assert.equal(boundaryDay.selectedLiChunRelation, "boundary-day");
  assert.equal(boundaryDay.liChunInstantResolution.status, "target-instant-unbound");
  assert.equal(boundaryDay.selectedBeforeLiChun, null);
  assert.equal(boundaryDay.selectedYearPillar, null);
  assert.equal(boundaryDay.liChunTransition.before.name, "癸卯");
  assert.equal(boundaryDay.liChunTransition.after.name, "甲辰");
});

test("year strip resolves a modern Li Chun boundary day when the shared target instant is bound", () => {
  const beforeTarget = fixedZoneTargetClock(
    { year:2024, month:2, day:4, hour:0, minute:0, second:0 },
    8
  ).targetInstant;
  const afterTarget = fixedZoneTargetClock(
    { year:2024, month:2, day:4, hour:23, minute:59, second:59 },
    8
  ).targetInstant;
  const before = researchYearStripState(
    { year:2024, month:2, day:4 },
    { targetInstant:beforeTarget }
  );
  const after = researchYearStripState(
    { year:2024, month:2, day:4 },
    { targetInstant:afterTarget }
  );

  assert.equal(before.selectedCivilLiChunRelation, "boundary-day");
  assert.equal(before.liChunInstantResolution.status, "resolved");
  assert.equal(before.selectedLiChunRelation, "before");
  assert.equal(before.selectedYearPillar.name, "癸卯");
  assert.equal(after.liChunInstantResolution.status, "resolved");
  assert.equal(after.selectedLiChunRelation, "after");
  assert.equal(after.selectedYearPillar.name, "甲辰");
});

test("year strip keeps a bound deep-time target unresolved outside validated TT bridge coverage", () => {
  const targetInstant = fixedZoneTargetClock(
    { year:2426, month:2, day:4, hour:23, minute:59, second:59 },
    8
  ).targetInstant;
  const state = researchYearStripState(
    { year:2426, month:2, day:4 },
    { targetInstant }
  );

  assert.equal(state.selectedCivilLiChunRelation, "boundary-day");
  assert.equal(state.liChunInstantResolution.status, "outside-validated-coverage");
  assert.equal(state.selectedLiChunRelation, "boundary-day");
  assert.equal(state.selectedYearPillar, null);
});

test("year strip recalculates Li Chun and Ganzhi transition for each civil year", () => {
  const year2024 = researchYearStripState({ year:2024, month:6, day:1 });
  const year2025 = researchYearStripState({ year:2025, month:6, day:1 });

  assert.ok(year2024.liChun);
  assert.ok(year2025.liChun);
  assert.notEqual(year2024.liChun.event.instantMs, year2025.liChun.event.instantMs);
  assert.equal(year2024.selectedYearPillar.name, "甲辰");
  assert.equal(year2025.selectedYearPillar.name, "乙巳");
  assert.equal(year2025.liChunTransition.before.name, "甲辰");
  assert.equal(year2025.liChunTransition.after.name, "乙巳");
});

test("year strip gets 365/366 same-date intervals from recurrence authority", () => {
  const ordinary = researchYearStripState({ year:2024, month:9, day:13 });
  const crossesLeapDay = researchYearStripState({ year:2023, month:9, day:13 });

  assert.equal(ordinary.elapsedDays, 365);
  assert.equal(crossesLeapDay.elapsedDays, 366);
  assert.deepEqual(ordinary.nextDate, { year:2025, month:9, day:13 });
  assert.deepEqual(crossesLeapDay.nextDate, { year:2024, month:9, day:13 });
});

test("year strip fails closed when exact civil Li Chun authority is out of range", () => {
  const state = researchYearStripState({ year:10000, month:9, day:13 });

  assert.equal(state.liChun, null);
  assert.equal(state.selectedLiChunRelation, "unknown");
  assert.equal(state.selectedBeforeLiChun, null);
  assert.equal(state.liChunTransition, null);
  assert.equal(state.selectedYearPillar, null);
  assert.equal(state.elapsedDays, 365);
});

test("year strip does not invent a next same-date when February 29 disappears", () => {
  const state = researchYearStripState({ year:2024, month:2, day:29 });
  assert.equal(state.nextDate, null);
  assert.equal(state.elapsedDays, null);
});
