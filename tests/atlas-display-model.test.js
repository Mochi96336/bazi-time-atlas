import test from "node:test";
import assert from "node:assert/strict";

import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import {
  ATLAS_SEXAGENARY_NAMES,
  ATLAS_UTC_OFFSET_HOURS,
  atlasInputValueFromFields,
  civilFieldsFromInstant,
  formatAtlasCivil,
  instantFromAtlasLocalInput,
  parseAtlasSearch,
  resolveAtlasDisplayState,
  solarLongitudeAtInstant
} from "../src/wheel/atlas-display-model.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  normalizeAtlasTimeContext
} from "../src/wheel/atlas-time-context.js";

test("atlas civil-time helpers preserve second-level UTC+8 controller semantics", () => {
  assert.equal(ATLAS_UTC_OFFSET_HOURS, 8);
  assert.deepEqual(DEFAULT_ATLAS_TIME_CONTEXT, {
    utcOffsetHours: 8,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  });
  const instantMs = Date.UTC(2026, 8, 14, 4, 34, 37);
  const fields = civilFieldsFromInstant(instantMs);
  assert.deepEqual(fields, {
    year: 2026,
    month: 9,
    day: 14,
    hour: 12,
    minute: 34,
    second: 37
  });
  assert.equal(atlasInputValueFromFields(fields), "2026-09-14T12:34:37");
  assert.equal(formatAtlasCivil(fields), "2026-09-14 · 12:34:37");
  assert.equal(instantFromAtlasLocalInput(atlasInputValueFromFields(fields)), instantMs);
  assert.equal(
    instantFromAtlasLocalInput("2026-09-14T12:34"),
    Date.UTC(2026, 8, 14, 4, 34, 0)
  );
  assert.equal(instantFromAtlasLocalInput("not-a-date"), null);
});

test("atlas local-clock helpers accept an explicit fixed-offset context without moving the instant", () => {
  const timeContext = {
    utcOffsetHours: 9,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  };
  const instantMs = Date.parse("2026-09-16T15:30:00.000Z");
  const fields = civilFieldsFromInstant(instantMs, timeContext);
  assert.deepEqual(fields, {
    year: 2026,
    month: 9,
    day: 17,
    hour: 0,
    minute: 30,
    second: 0
  });
  assert.equal(
    instantFromAtlasLocalInput("2026-09-17T00:30:00", timeContext),
    instantMs
  );
});

test("atlas time context fails closed on invalid offset and day-boundary values", () => {
  assert.throws(() => normalizeAtlasTimeContext({ utcOffsetHours: 15 }), /utcOffsetHours/);
  assert.throws(() => normalizeAtlasTimeContext({ dayBoundary: "sunset" }), /dayBoundary/);
  assert.throws(() => normalizeAtlasTimeContext(null), /object/);
});

test("instant deep links take precedence over legacy longitude projection", () => {
  const parsed = parseAtlasSearch("?instant=2027-03-15T13%3A20%3A09.000Z&lambda=271.25&yearStem=%E4%B9%99");
  assert.equal(parsed.instantMs, Date.parse("2027-03-15T13:20:09.000Z"));
  assert.equal(parsed.legacyProjection, null);
});

test("legacy atlas search derives month branch and five-tigers month pillar from longitude", () => {
  const parsed = parseAtlasSearch("?lambda=271.25&yearStem=%E4%B9%99");
  assert.equal(parsed.instantMs, null);
  assert.deepEqual(parsed.legacyProjection, {
    longitude: 271.25,
    monthBranch: "子",
    yearStem: "乙",
    monthPillar: "戊子"
  });
});

test("month-only legacy links resolve to the midpoint of the requested BaZi month", () => {
  const parsed = parseAtlasSearch("?month=%E5%AF%85");
  assert.equal(parsed.instantMs, null);
  assert.deepEqual(parsed.legacyProjection, {
    longitude: 330,
    monthBranch: "寅",
    yearStem: null,
    monthPillar: null
  });
  assert.deepEqual(parseAtlasSearch("?unrelated=1"), {
    instantMs: null,
    legacyProjection: null
  });
});

test("display model applies legacy projection without changing the physical instant", () => {
  const selectedMs = Date.UTC(2026, 8, 14, 4, 0, 0);
  const legacyProjection = parseAtlasSearch("?lambda=271.25&yearStem=%E4%B9%99").legacyProjection;
  const display = resolveAtlasDisplayState({ selectedMs, legacyProjection });

  assert.equal(display.fields.hour, 12);
  assert.equal(display.longitude, 271.25);
  assert.equal(display.actualLongitude, solarLongitudeAtInstant(selectedMs));
  assert.equal(display.monthBranch, "子");
  assert.equal(display.monthName, "戊子");
  assert.equal(display.phases.month, null);
  assert.equal(display.activeTerm.name, "冬至");
  assert.equal(display.activeZodiac.name, "摩羯");
  assert.equal(ATLAS_SEXAGENARY_NAMES[display.monthIndex], "戊子");
  assert.ok(display.hourIndex >= 0);
  assert.ok(display.dayIndex >= 0);
  assert.ok(display.yearIndex >= 0);
});

test("physical display state keeps solar longitude and discrete phases intact", () => {
  const selectedMs = Date.UTC(2026, 8, 14, 4, 0, 0);
  const display = resolveAtlasDisplayState({ selectedMs });
  assert.equal(display.timeContext, DEFAULT_ATLAS_TIME_CONTEXT);
  assert.equal(display.longitude, display.actualLongitude);
  assert.equal(display.actualLongitude, solarLongitudeAtInstant(selectedMs));
  assert.ok(display.phases.hour);
  assert.ok(display.phases.day);
  assert.ok(display.phases.month);
  assert.ok(display.phases.year);
  assert.equal(ATLAS_SEXAGENARY_NAMES.length, 60);
});

test("changing day-boundary convention preserves the instant, year, month and Sun", () => {
  const selectedMs = Date.parse("2026-09-16T15:30:00.000Z"); // UTC+8 = 23:30
  const ziInitial = resolveAtlasDisplayState({ selectedMs });
  const civilMidnight = resolveAtlasDisplayState({
    selectedMs,
    timeContext: {
      utcOffsetHours: 8,
      dayBoundary: DAY_BOUNDARY.CIVIL_MIDNIGHT
    }
  });

  assert.deepEqual(civilMidnight.fields, ziInitial.fields);
  assert.equal(civilMidnight.yearName, ziInitial.yearName);
  assert.equal(civilMidnight.monthName, ziInitial.monthName);
  assert.equal(civilMidnight.actualLongitude, ziInitial.actualLongitude);
  assert.equal(civilMidnight.activeTerm.name, ziInitial.activeTerm.name);
  assert.notEqual(civilMidnight.pillars.day.name, ziInitial.pillars.day.name);
  assert.notEqual(civilMidnight.phases.day.startMs, ziInitial.phases.day.startMs);
  assert.equal(civilMidnight.phases.day.dayBoundary, DAY_BOUNDARY.CIVIL_MIDNIGHT);
});

test("changing fixed offset changes the civil representation but not the physical Sun", () => {
  const selectedMs = Date.parse("2026-09-16T15:30:00.000Z");
  const utc8 = resolveAtlasDisplayState({ selectedMs });
  const utc9 = resolveAtlasDisplayState({
    selectedMs,
    timeContext: {
      utcOffsetHours: 9,
      dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    }
  });

  assert.equal(utc8.fields.day, 16);
  assert.equal(utc8.fields.hour, 23);
  assert.equal(utc9.fields.day, 17);
  assert.equal(utc9.fields.hour, 0);
  assert.equal(utc9.yearName, utc8.yearName);
  assert.equal(utc9.monthName, utc8.monthName);
  assert.ok(Math.abs(utc9.actualLongitude - utc8.actualLongitude) < 1e-9);
});
