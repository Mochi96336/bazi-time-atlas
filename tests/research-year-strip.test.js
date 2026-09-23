import test from "node:test";
import assert from "node:assert/strict";
import { researchYearStripState } from "../src/research-year-strip-view.js";

test("year strip orders the selected date before and after the exact Li Chun boundary", () => {
  const before = researchYearStripState({ year:2024, month:2, day:1 });
  const after = researchYearStripState({ year:2024, month:2, day:10 });

  assert.ok(before.liChun, "2024 Li Chun should be available from the exact solar-term authority");
  assert.ok(after.liChun, "2024 Li Chun should be available from the exact solar-term authority");
  assert.equal(before.selectedBeforeLiChun, true);
  assert.equal(after.selectedBeforeLiChun, false);
  assert.equal(before.selectedYearPillar.name, "癸卯");
  assert.equal(after.selectedYearPillar.name, "甲辰");
  assert.equal(before.liChunTransition.before.name, "癸卯");
  assert.equal(before.liChunTransition.after.name, "甲辰");
  assert.ok(before.selectedPosition < before.liChun.position);
  assert.ok(after.selectedPosition > after.liChun.position);
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
