import test from "node:test";
import assert from "node:assert/strict";
import {
  RESEARCH_YEAR_STRIP_CONTRACT,
  researchYearStripState
} from "../src/research-year-strip-view.js";
import { fixedZoneTargetClock } from "../src/recurrence/fixed-zone-target-clock.js";

test("year strip no longer treats the legacy civil solar-term helper as its authority", () => {
  assert.equal(RESEARCH_YEAR_STRIP_CONTRACT.directLegacyCivilSolarTermAuthority, false);
  assert.equal(RESEARCH_YEAR_STRIP_CONTRACT.transitionIndependentFromEpochAvailability, true);
  assert.equal(RESEARCH_YEAR_STRIP_CONTRACT.defaultDisplayOffsetHoursFromUt1, 8);
});

test("modern year strip orders selected dates before and after the resolved Li Chun boundary", () => {
  const before = researchYearStripState({ year:2024, month:2, day:1 });
  const after = researchYearStripState({ year:2024, month:2, day:10 });

  assert.equal(before.liChunBoundary.status, "resolved");
  assert.equal(before.liChunProjection.status, "resolved");
  assert.equal(before.liChun.positionStatus, "resolved");
  assert.equal(before.displayOffset.hours, 8);
  assert.equal(before.displayOffset.source, "research-display-default");
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

test("date-only selection on the resolved modern Li Chun day remains year-pillar ambiguous", () => {
  const boundaryDay = researchYearStripState({ year:2024, month:2, day:4 });

  assert.deepEqual(boundaryDay.liChun.date, { year:2024, month:2, day:4 });
  assert.equal(boundaryDay.selectedCivilLiChunRelation, "boundary-day");
  assert.equal(boundaryDay.selectedLiChunRelation, "boundary-day");
  assert.equal(boundaryDay.liChunInstantResolution.status, "target-instant-unbound");
  assert.equal(boundaryDay.selectedBeforeLiChun, null);
  assert.equal(boundaryDay.selectedYearPillar, null);
  assert.equal(boundaryDay.liChunTransition.before.name, "癸卯");
  assert.equal(boundaryDay.liChunTransition.after.name, "甲辰");
});

test("bound fixed-zone target resolves the modern Li Chun boundary on the same explicit UT1 offset", () => {
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

  assert.equal(before.displayOffset.source, "selected-target-instant");
  assert.equal(before.displayOffset.hours, 8);
  assert.equal(before.liChunInstantResolution.status, "resolved");
  assert.equal(before.selectedLiChunRelation, "before");
  assert.equal(before.selectedYearPillar.name, "癸卯");
  assert.equal(after.liChunInstantResolution.status, "resolved");
  assert.equal(after.selectedLiChunRelation, "after");
  assert.equal(after.selectedYearPillar.name, "甲辰");
});

test("year 2426 now exposes the DE441 runtime gap instead of silently using legacy Tyme civil fields", () => {
  const state = researchYearStripState({ year:2426, month:9, day:13 });

  assert.equal(state.liChunBoundary.status, "source-covered-runtime-missing");
  assert.ok(state.liChunBoundary.sourceIds.includes("jpl-de441"));
  assert.equal(state.liChunProjection.status, "unavailable");
  assert.equal(state.liChun, null);
  assert.match(state.liChunUnavailableMessage, /DE441.*尚未發布/);
  assert.equal(state.selectedLiChunRelation, "unknown");
  assert.equal(state.selectedYearPillar, null);
  assert.equal(state.liChunTransition.before.name, "乙酉");
  assert.equal(state.liChunTransition.after.name, "丙戌");
});

test("year 4006 uses reviewed DE441 TT and renders only an estimated civil position", () => {
  const state = researchYearStripState({ year:4006, month:9, day:13 });

  assert.equal(state.liChunBoundary.status, "resolved");
  assert.equal(state.liChunBoundary.providerId, "jpl-de441-seasonal-events-v1");
  assert.equal(state.liChunBoundary.timeScale, "TT");
  assert.equal(state.liChunProjection.status, "estimated");
  assert.equal(state.liChunProjection.localClockResolved, false);
  assert.equal(state.liChun.positionStatus, "estimated");
  assert.ok(state.liChunProjection.uncertaintySeconds > 6000);
  assert.ok(state.liChun.positionMin < state.liChun.positionMax);
  assert.equal(state.selectedLiChunRelation, "after");
  assert.ok(state.selectedYearPillar);
});

test("year 10026 keeps the Ganzhi transition visible while the DE441 seasonal runtime is missing", () => {
  const state = researchYearStripState({ year:10026, month:9, day:13 });

  assert.equal(state.liChunBoundary.status, "source-covered-runtime-missing");
  assert.ok(state.liChunBoundary.sourceIds.includes("jpl-de441"));
  assert.equal(state.liChunProjection.status, "unavailable");
  assert.equal(state.liChun, null);
  assert.equal(state.selectedLiChunRelation, "unknown");
  assert.equal(state.selectedYearPillar, null);
  assert.ok(state.liChunTransition.before.name);
  assert.ok(state.liChunTransition.after.name);
  assert.match(state.liChunUnavailableMessage, /DE441.*尚未發布/);
});

test("year 26026 keeps the Ganzhi transition visible but reports an absolute seasonal source gap", () => {
  const state = researchYearStripState({ year:26026, month:9, day:13 });

  assert.equal(state.liChunBoundary.status, "absolute-source-unavailable");
  assert.equal(state.liChunBoundary.blocker, "ephemeris-source-coverage");
  assert.equal(state.liChunProjection.status, "unavailable");
  assert.equal(state.liChun, null);
  assert.equal(state.selectedLiChunRelation, "unknown");
  assert.equal(state.selectedYearPillar, null);
  assert.ok(state.liChunTransition.before.name);
  assert.ok(state.liChunTransition.after.name);
  assert.match(state.liChunUnavailableMessage, /absolute seasonal-epoch source/);
});

test("year strip recalculates the modern seasonal epoch and Ganzhi transition for each year", () => {
  const year2024 = researchYearStripState({ year:2024, month:6, day:1 });
  const year2025 = researchYearStripState({ year:2025, month:6, day:1 });

  assert.ok(Number.isFinite(year2024.liChunBoundary.ttJulianDay));
  assert.ok(Number.isFinite(year2025.liChunBoundary.ttJulianDay));
  assert.notEqual(year2024.liChunBoundary.ttJulianDay, year2025.liChunBoundary.ttJulianDay);
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

test("year strip does not invent a next same-date when February 29 disappears", () => {
  const state = researchYearStripState({ year:2024, month:2, day:29 });
  assert.equal(state.nextDate, null);
  assert.equal(state.elapsedDays, null);
});
