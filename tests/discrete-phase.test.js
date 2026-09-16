import test from "node:test";
import assert from "node:assert/strict";

import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import {
  dayPhaseWindow,
  discretePhaseWindows,
  exactNextBoundaryGroups,
  hourPhaseWindow,
  monthPhaseWindow,
  phaseAngleWithinTooth,
  yearPhaseWindow
} from "../src/wheel/discrete-phase.js";
import { solarTermEventForCivilYear } from "../src/astronomy/solar-term-boundaries.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const SAMPLE = Date.parse("2027-03-15T13:20:09.000Z"); // UTC+8 = 21:20:09

test("hour phase uses real double-hour clock progress without moving the pillar identity", () => {
  const phase = hourPhaseWindow(SAMPLE);
  assert.equal(new Date(phase.startMs).toISOString(), "2027-03-15T13:00:00.000Z");
  assert.equal(new Date(phase.endMs).toISOString(), "2027-03-15T15:00:00.000Z");
  assert.equal(phase.endMs - phase.startMs, 2 * HOUR_MS);
  assert.equal(phase.source, "double-hour");
  assert.equal(phase.boundaryKind, "calendar-discrete");
  assert.equal(phase.referenceUtcOffsetHours, 8);
  assert.ok(Math.abs(phase.progress - 1209 / 7200) < 1e-12);
});

test("hour phase follows the selected fixed-offset local clock", () => {
  const phase = hourPhaseWindow(SAMPLE, {
    utcOffsetHours: 9,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  });
  assert.equal(new Date(phase.startMs).toISOString(), "2027-03-15T12:00:00.000Z");
  assert.equal(new Date(phase.endMs).toISOString(), "2027-03-15T14:00:00.000Z");
  assert.equal(phase.referenceUtcOffsetHours, 9);
});

test("day phase follows the Zi-initial 23:00 day-boundary convention", () => {
  const phase = dayPhaseWindow(SAMPLE);
  assert.equal(new Date(phase.startMs).toISOString(), "2027-03-14T15:00:00.000Z");
  assert.equal(new Date(phase.endMs).toISOString(), "2027-03-15T15:00:00.000Z");
  assert.equal(phase.endMs - phase.startMs, DAY_MS);
  assert.equal(phase.source, "zi-initial");
  assert.equal(phase.dayBoundary, DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY);
  assert.equal(phase.boundaryKind, "calendar-discrete");
  assert.ok(phase.progress > 0.93 && phase.progress < 0.94);
});

test("day phase can use civil midnight without changing the selected instant", () => {
  const instantMs = Date.parse("2027-03-15T15:30:00.000Z"); // UTC+8 = 23:30
  const ziInitial = dayPhaseWindow(instantMs);
  const civilMidnight = dayPhaseWindow(instantMs, {
    utcOffsetHours: 8,
    dayBoundary: DAY_BOUNDARY.CIVIL_MIDNIGHT
  });

  assert.equal(new Date(ziInitial.startMs).toISOString(), "2027-03-15T15:00:00.000Z");
  assert.equal(new Date(civilMidnight.startMs).toISOString(), "2027-03-14T16:00:00.000Z");
  assert.equal(new Date(civilMidnight.endMs).toISOString(), "2027-03-15T16:00:00.000Z");
  assert.equal(civilMidnight.source, "civil-midnight");
  assert.equal(civilMidnight.dayBoundary, DAY_BOUNDARY.CIVIL_MIDNIGHT);
});

test("month phase is bounded by exact jie instants", () => {
  const phase = monthPhaseWindow(SAMPLE);
  assert.ok(phase.startMs < SAMPLE && SAMPLE < phase.endMs);
  assert.ok(phase.endMs - phase.startMs > 25 * DAY_MS);
  assert.ok(phase.endMs - phase.startMs < 35 * DAY_MS);
  assert.equal(phase.source, "jie");
  assert.equal(phase.boundaryKind, "astronomical-discrete");
  assert.ok(phase.progress > 0 && phase.progress < 1);
});

test("year phase is bounded by consecutive exact Li Chun instants", () => {
  const phase = yearPhaseWindow(SAMPLE);
  assert.ok(phase.startMs < SAMPLE && SAMPLE < phase.endMs);
  assert.ok(phase.endMs - phase.startMs > 364 * DAY_MS);
  assert.ok(phase.endMs - phase.startMs < 367 * DAY_MS);
  assert.equal(phase.source, "li-chun");
  assert.equal(phase.boundaryKind, "astronomical-discrete");
  assert.ok(phase.progress > 0 && phase.progress < 1);
});

test("month and year phases reset at their actual astronomical boundaries", () => {
  const jingZhe = solarTermEventForCivilYear(2027, "驚蟄").instantMs;
  const beforeMonth = monthPhaseWindow(jingZhe - 1_000);
  const afterMonth = monthPhaseWindow(jingZhe);
  assert.ok(beforeMonth.progress > 0.9999);
  assert.equal(afterMonth.startMs, jingZhe);
  assert.equal(afterMonth.progress, 0);

  const liChun = solarTermEventForCivilYear(2027, "立春").instantMs;
  const beforeYear = yearPhaseWindow(liChun - 1_000);
  const afterYear = yearPhaseWindow(liChun);
  assert.ok(beforeYear.progress > 0.99999);
  assert.equal(afterYear.startMs, liChun);
  assert.equal(afterYear.progress, 0);
});

test("all four phase windows share one selected instant but preserve their own laws", () => {
  const phases = discretePhaseWindows(SAMPLE);
  assert.deepEqual(Object.keys(phases), ["hour", "year", "month", "day"]);
  for (const phase of Object.values(phases)) {
    assert.ok(phase.startMs <= SAMPLE && SAMPLE < phase.endMs);
    assert.ok(phase.progress >= 0 && phase.progress < 1);
  }
  assert.notEqual(phases.hour.endMs - phases.hour.startMs, phases.day.endMs - phases.day.startMs);
  assert.notEqual(phases.month.endMs - phases.month.startMs, phases.year.endMs - phases.year.startMs);
});

test("Zi-initial exposes an exact shared next boundary for Hour and Day", () => {
  const groups = exactNextBoundaryGroups(discretePhaseWindows(SAMPLE));
  const shared = groups.filter(group => group.shared);
  assert.equal(shared.length, 1);
  assert.deepEqual(shared[0].ringIds, ["hour", "day"]);
  assert.equal(shared[0].instantMs, Date.parse("2027-03-15T15:00:00.000Z"));
});

test("pre-Li-Chun Chou month exposes an exact shared Month and Year boundary", () => {
  const instantMs = Date.parse("2027-02-01T04:00:00.000Z"); // UTC+8 = 12:00
  const groups = exactNextBoundaryGroups(discretePhaseWindows(instantMs));
  const shared = groups.find(group => group.shared && group.ringIds.includes("year"));
  assert.ok(shared);
  assert.deepEqual(shared.ringIds, ["year", "month"]);
  assert.equal(shared.instantMs, solarTermEventForCivilYear(2027, "立春").instantMs);
});

test("exact boundary grouping has no near-event tolerance", () => {
  const groups = exactNextBoundaryGroups({
    hour: { endMs:1_000 },
    year: { endMs:2_000 },
    month: { endMs:2_001 },
    day: { endMs:1_000 }
  });
  assert.deepEqual(groups.map(group => [group.instantMs, group.ringIds, group.shared]), [
    [1_000, ["hour", "day"], true],
    [2_000, ["year"], false],
    [2_001, ["month"], false]
  ]);
});

test("phase marker sweeps only inside one six-degree active tooth", () => {
  assert.equal(phaseAngleWithinTooth(0, 0), 0.45);
  assert.equal(phaseAngleWithinTooth(0, 1), 5.55);
  assert.equal(phaseAngleWithinTooth(10, 0.5), 63);
  assert.equal(phaseAngleWithinTooth(-1, 0.5), null);
  assert.equal(phaseAngleWithinTooth(60, 0.5), null);
});
