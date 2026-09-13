import test from "node:test";
import assert from "node:assert/strict";
import { resolveBirthPillars } from "../src/calendar/tyme-adapter.js";
import {
  SEXAGENARY_YEAR_ANCHOR,
  sexagenaryYearPillarForLiChunYear
} from "../src/calendar/sexagenary-year.js";

test("1984 Li Chun year label is the Jia-Zi anchor", () => {
  assert.equal(SEXAGENARY_YEAR_ANCHOR.gregorianYear, 1984);
  assert.equal(sexagenaryYearPillarForLiChunYear(1984).name, "甲子");
});

test("proleptic helper reproduces modern and deep-time 60-year phases", () => {
  assert.equal(sexagenaryYearPillarForLiChunYear(2026).name, "丙午");
  assert.equal(sexagenaryYearPillarForLiChunYear(2027).name, "丁未");
  assert.equal(sexagenaryYearPillarForLiChunYear(26026).name, "丙午");
  assert.equal(sexagenaryYearPillarForLiChunYear(794026).name, "丙午");
});

test("helper agrees with Tyme for an ordinary post-Li-Chun modern instant", () => {
  const tyme = resolveBirthPillars({ year:2026, month:6, day:1, hour:12 }, { utcOffsetHours:8 });
  assert.equal(tyme.pillars.year.name, sexagenaryYearPillarForLiChunYear(2026).name);
});

test("active year label changes across Li Chun while January remains on the prior label", () => {
  const january = resolveBirthPillars({ year:2027, month:1, day:15, hour:12 }, { utcOffsetHours:8 });
  const february = resolveBirthPillars({ year:2027, month:2, day:10, hour:12 }, { utcOffsetHours:8 });
  assert.equal(january.pillars.year.name, sexagenaryYearPillarForLiChunYear(2026).name);
  assert.equal(february.pillars.year.name, sexagenaryYearPillarForLiChunYear(2027).name);
});
