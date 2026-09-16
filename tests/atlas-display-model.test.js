import test from "node:test";
import assert from "node:assert/strict";

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

test("atlas civil-time helpers preserve second-level UTC+8 controller semantics", () => {
  assert.equal(ATLAS_UTC_OFFSET_HOURS, 8);
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
  assert.equal(display.longitude, display.actualLongitude);
  assert.equal(display.actualLongitude, solarLongitudeAtInstant(selectedMs));
  assert.ok(display.phases.hour);
  assert.ok(display.phases.day);
  assert.ok(display.phases.month);
  assert.ok(display.phases.year);
  assert.equal(ATLAS_SEXAGENARY_NAMES.length, 60);
});