import test from "node:test";
import assert from "node:assert/strict";
import { researchYearStripState } from "../src/research-year-strip-view.js";

test("year strip orders a base date before and after the exact Li Chun boundary", () => {
  const before = researchYearStripState({ year:2024, month:2, day:1 });
  const after = researchYearStripState({ year:2024, month:2, day:10 });

  assert.ok(before.liChun, "2024 Li Chun should be available from the exact solar-term authority");
  assert.ok(after.liChun, "2024 Li Chun should be available from the exact solar-term authority");
  assert.equal(before.baseBeforeLiChun, true);
  assert.equal(after.baseBeforeLiChun, false);
  assert.ok(before.basePosition < before.liChun.position);
  assert.ok(after.basePosition > after.liChun.position);
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
  assert.equal(state.baseBeforeLiChun, null);
  assert.equal(state.elapsedDays, 365);
});

test("year strip does not invent a next same-date when February 29 disappears", () => {
  const state = researchYearStripState({ year:2024, month:2, day:29 });
  assert.equal(state.nextDate, null);
  assert.equal(state.elapsedDays, null);
});
