import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RESEARCH_YEAR_STRIP_CONTRACT,
  researchYearStripState
} from "../src/research-year-strip-view.js";
import { fixedZoneTargetClock } from "../src/recurrence/fixed-zone-target-clock.js";
import {
  TARGET_INSTANT_BASIS,
  targetInstantBinding
} from "../src/recurrence/target-instant-binding.js";

test("year strip no longer treats the legacy civil solar-term helper as its authority", async () => {
  assert.equal(RESEARCH_YEAR_STRIP_CONTRACT.directLegacyCivilSolarTermAuthority, false);
  assert.equal(RESEARCH_YEAR_STRIP_CONTRACT.transitionIndependentFromEpochAvailability, true);
  assert.equal(RESEARCH_YEAR_STRIP_CONTRACT.defaultDisplayOffsetHoursFromUt1, 8);
  assert.deepEqual(
    RESEARCH_YEAR_STRIP_CONTRACT.selectedYearMembershipStatuses,
    ["exact", "model-estimated", "unresolved"]
  );
  assert.equal(RESEARCH_YEAR_STRIP_CONTRACT.oneSigmaIntervalIsHardDecisionBound, false);

  const source = await readFile(new URL("../src/research-year-strip-view.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /solarTermEventForCivilYear/);
  assert.match(source, /resolveResearchSeasonalBoundary/);
  assert.match(source, /projectSeasonalBoundaryToCivil/);
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
  assert.equal(before.selectedYearMembership.status, "model-estimated");
  assert.equal(after.selectedYearMembership.status, "model-estimated");
  assert.equal(before.selectedYearMembership.reason, "seasonal-boundary-model");
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
  assert.equal(boundaryDay.selectedYearMembership.status, "unresolved");
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
  assert.equal(before.selectedYearMembership.status, "model-estimated");
  assert.equal(after.liChunInstantResolution.status, "resolved");
  assert.equal(after.selectedLiChunRelation, "after");
  assert.equal(after.selectedYearPillar.name, "甲辰");
  assert.equal(after.selectedYearMembership.status, "model-estimated");
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
  assert.equal(state.selectedYearMembership.status, "unresolved");
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
  assert.equal(state.selectedYearMembership.status, "model-estimated");
  assert.equal(state.selectedYearMembership.reason, "earth-rotation-model");
});

test("year 4006 TT target resolves Li Chun membership directly on the DE441 TT epoch", () => {
  const probe = researchYearStripState({ year:4006, month:9, day:13 });
  const boundaryDate = {
    year:4006,
    month:probe.liChunProjection.localClock.month,
    day:probe.liChunProjection.localClock.day
  };
  const epsilonDays = 1 / 86400;
  const beforeTarget = targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.TT_JULIAN_DAY,
    julianDay:probe.liChunBoundary.ttJulianDay - epsilonDays
  });
  const afterTarget = targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.TT_JULIAN_DAY,
    julianDay:probe.liChunBoundary.ttJulianDay + epsilonDays
  });

  const before = researchYearStripState(boundaryDate, { targetInstant:beforeTarget });
  const after = researchYearStripState(boundaryDate, { targetInstant:afterTarget });

  assert.equal(before.liChunBoundary.providerId, "jpl-de441-seasonal-events-v1");
  assert.equal(before.liChunProjection.status, "estimated");
  assert.equal(before.selectedCivilLiChunRelation, "boundary-uncertain");
  assert.equal(before.liChunInstantResolution.status, "resolved");
  assert.equal(before.liChunInstantResolution.targetBasis, "tt-julian-day");
  assert.equal(before.selectedLiChunRelation, "before");
  assert.equal(before.selectedYearPillar.name, before.liChunTransition.before.name);
  assert.equal(before.selectedYearMembership.status, "exact");
  assert.equal(before.selectedYearMembership.reason, "authoritative-same-scale-comparison");

  assert.equal(after.selectedCivilLiChunRelation, "boundary-uncertain");
  assert.equal(after.liChunInstantResolution.status, "resolved");
  assert.equal(after.selectedLiChunRelation, "after");
  assert.equal(after.selectedYearPillar.name, after.liChunTransition.after.name);
  assert.equal(after.selectedYearMembership.status, "exact");
});

test("year 4006 UT1 target stays unresolved inside the Earth-rotation uncertainty interval", () => {
  const probe = researchYearStripState({ year:4006, month:9, day:13 });
  const boundaryDate = {
    year:4006,
    month:probe.liChunProjection.localClock.month,
    day:probe.liChunProjection.localClock.day
  };
  const centerTarget = targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.UT1_JULIAN_DAY,
    julianDay:probe.liChunProjection.ut1JulianDay
  });

  const center = researchYearStripState(boundaryDate, { targetInstant:centerTarget });

  assert.equal(center.selectedCivilLiChunRelation, "boundary-uncertain");
  assert.equal(center.liChunInstantResolution.status, "earth-rotation-uncertain");
  assert.equal(center.liChunInstantResolution.targetBasis, "ut1-julian-day");
  assert.equal(center.selectedLiChunRelation, "boundary-uncertain");
  assert.equal(center.selectedBeforeLiChun, null);
  assert.equal(center.selectedYearPillar, null);
  assert.equal(center.selectedYearMembership.status, "unresolved");
});

test("year 4006 UT1 targets outside the one-sigma interval remain model-estimated, not exact", () => {
  const probe = researchYearStripState({ year:4006, month:9, day:13 });
  const boundaryDate = {
    year:4006,
    month:probe.liChunProjection.localClock.month,
    day:probe.liChunProjection.localClock.day
  };
  const offsetDays = probe.displayOffset.hours / 24;
  const guardDays = 1 / 24;
  const beforeTarget = targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.UT1_JULIAN_DAY,
    julianDay:probe.liChunProjection.oneSigmaLocalJulianDayMin - offsetDays - guardDays
  });
  const afterTarget = targetInstantBinding({
    basis:TARGET_INSTANT_BASIS.UT1_JULIAN_DAY,
    julianDay:probe.liChunProjection.oneSigmaLocalJulianDayMax - offsetDays + guardDays
  });

  const before = researchYearStripState(boundaryDate, { targetInstant:beforeTarget });
  const after = researchYearStripState(boundaryDate, { targetInstant:afterTarget });

  assert.equal(before.liChunInstantResolution.status, "model-estimated");
  assert.equal(before.selectedLiChunRelation, "before");
  assert.equal(before.selectedYearPillar.name, before.liChunTransition.before.name);
  assert.equal(before.selectedYearMembership.status, "model-estimated");
  assert.equal(before.selectedYearMembership.reason, "earth-rotation-model");

  assert.equal(after.liChunInstantResolution.status, "model-estimated");
  assert.equal(after.selectedLiChunRelation, "after");
  assert.equal(after.selectedYearPillar.name, after.liChunTransition.after.name);
  assert.equal(after.selectedYearMembership.status, "model-estimated");
});

test("year 10026 consumes pinned DE441-derived TT evidence without promoting it to production truth", () => {
  const state = researchYearStripState({ year:10026, month:9, day:13 });

  assert.equal(state.liChunBoundary.status, "resolved-research-evidence");
  assert.equal(state.liChunBoundary.authorityClass, "source-derived-research-evidence");
  assert.equal(state.liChunBoundary.productionAuthorityGranted, false);
  assert.equal(state.liChunBoundary.independentTargetYearTruth, false);
  assert.equal(state.liChunBoundary.ttJulianDay, 5383013.532143416);
  assert.equal(state.liChunProjection.status, "estimated");
  assert.equal(state.liChunProjection.localClockResolved, false);
  assert.ok(state.liChunProjection.uncertaintySeconds > 60_000);
  assert.equal(state.liChun.positionStatus, "estimated");
  assert.ok(state.liChun.positionMin < state.liChun.positionMax);
  assert.equal(state.selectedLiChunRelation, "after");
  assert.ok(state.selectedYearPillar);
  assert.equal(state.selectedYearMembership.status, "model-estimated");
  assert.equal(state.selectedYearMembership.reason, "research-source-derived-boundary");
  assert.ok(state.liChunTransition.before.name);
  assert.ok(state.liChunTransition.after.name);
  assert.equal(state.liChunUnavailableMessage, null);
});

test("year 26026 keeps the Ganzhi transition visible but reports an absolute seasonal source gap", () => {
  const state = researchYearStripState({ year:26026, month:9, day:13 });

  assert.equal(state.liChunBoundary.status, "absolute-source-unavailable");
  assert.equal(state.liChunBoundary.blocker, "ephemeris-source-coverage");
  assert.equal(state.liChunProjection.status, "unavailable");
  assert.equal(state.liChun, null);
  assert.equal(state.selectedLiChunRelation, "unknown");
  assert.equal(state.selectedYearPillar, null);
  assert.equal(state.selectedYearMembership.status, "unresolved");
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
