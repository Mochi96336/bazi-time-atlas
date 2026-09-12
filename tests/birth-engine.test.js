import test from "node:test";
import assert from "node:assert/strict";
import { JulianDay, SolarTerm } from "tyme4ts";
import {
  DAY_BOUNDARY,
  SOLAR_TERM_REFERENCE_UTC_OFFSET,
  resolveBirthPillars
} from "../src/calendar/tyme-adapter.js";

function names(result) {
  return Object.values(result.pillars).map(pillar => pillar.name);
}

function toInput(time) {
  return {
    year: time.getYear(),
    month: time.getMonth(),
    day: time.getDay(),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond()
  };
}

function sameInstantAtOffset(timeAtUtc8, utcOffsetHours) {
  const shifted = timeAtUtc8.getJulianDay().getDay() +
    (utcOffsetHours - SOLAR_TERM_REFERENCE_UTC_OFFSET) / 24;
  return JulianDay.fromJulianDay(shifted).getSolarTime();
}

test("matches upstream exact-time EightChar vector", () => {
  const result = resolveBirthPillars({
    year: 2005,
    month: 12,
    day: 23,
    hour: 8,
    minute: 37,
    second: 0
  });
  assert.deepEqual(names(result), ["乙酉", "戊子", "辛巳", "壬辰"]);
});

test("default convention advances the day pillar at 23:00 Zi hour", () => {
  const result = resolveBirthPillars({
    year: 1988,
    month: 2,
    day: 15,
    hour: 23,
    minute: 30,
    second: 0
  });
  assert.deepEqual(names(result), ["戊辰", "甲寅", "辛丑", "戊子"]);
  assert.equal(result.convention.dayBoundary, DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY);
});

test("civil-midnight convention keeps 23:30 on the current sexagenary day", () => {
  const result = resolveBirthPillars(
    { year: 1988, month: 2, day: 15, hour: 23, minute: 30, second: 0 },
    { dayBoundary: DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );
  assert.deepEqual(names(result), ["戊辰", "甲寅", "庚子", "丙子"]);
});

test("switching convention does not leak Tyme's global provider state", () => {
  resolveBirthPillars(
    { year: 1988, month: 2, day: 15, hour: 23, minute: 30, second: 0 },
    { dayBoundary: DAY_BOUNDARY.CIVIL_MIDNIGHT }
  );
  const result = resolveBirthPillars({
    year: 1988,
    month: 2,
    day: 15,
    hour: 23,
    minute: 30,
    second: 0
  });
  assert.deepEqual(names(result), ["戊辰", "甲寅", "辛丑", "戊子"]);
});

test("year pillar flips across the exact Li Chun instant, not at civil midnight", () => {
  const liChun = SolarTerm.fromName(2024, "立春").getJulianDay().getSolarTime();
  const beforeResult = resolveBirthPillars(toInput(liChun.next(-1)));
  const afterResult = resolveBirthPillars(toInput(liChun.next(1)));

  assert.equal(beforeResult.pillars.year.name, "癸卯");
  assert.equal(afterResult.pillars.year.name, "甲辰");
});

test("month pillar flips across a Jie instant while year/day remain independent", () => {
  const jingZhe = SolarTerm.fromName(2024, "惊蛰").getJulianDay().getSolarTime();
  const beforeResult = resolveBirthPillars(toInput(jingZhe.next(-1)));
  const afterResult = resolveBirthPillars(toInput(jingZhe.next(1)));

  assert.equal(beforeResult.pillars.year.name, afterResult.pillars.year.name);
  assert.notEqual(beforeResult.pillars.month.name, afterResult.pillars.month.name);
  assert.equal(beforeResult.pillars.day.name, afterResult.pillars.day.name);
});

test("Li Chun year boundary is the same physical instant in different UTC offsets", () => {
  const liChunUtc8 = SolarTerm.fromName(2024, "立春").getJulianDay().getSolarTime();

  for (const deltaSeconds of [-1, 1]) {
    const utc8Time = liChunUtc8.next(deltaSeconds);
    const utcTime = sameInstantAtOffset(utc8Time, 0);
    const tokyoTime = sameInstantAtOffset(utc8Time, 9);

    const utc8Result = resolveBirthPillars(toInput(utc8Time), { utcOffsetHours: 8 });
    const utcResult = resolveBirthPillars(toInput(utcTime), { utcOffsetHours: 0 });
    const tokyoResult = resolveBirthPillars(toInput(tokyoTime), { utcOffsetHours: 9 });

    assert.equal(utcResult.pillars.year.name, utc8Result.pillars.year.name);
    assert.equal(utcResult.pillars.month.name, utc8Result.pillars.month.name);
    assert.equal(tokyoResult.pillars.year.name, utc8Result.pillars.year.name);
    assert.equal(tokyoResult.pillars.month.name, utc8Result.pillars.month.name);
  }
});

test("year/month follow the instant while day/hour stay on the birthplace-local clock", () => {
  const taipeiClock = { year: 2005, month: 12, day: 23, hour: 0, minute: 30, second: 0 };
  const taipeiSolar = (await import("tyme4ts")).SolarTime.fromYmdHms(
    taipeiClock.year,
    taipeiClock.month,
    taipeiClock.day,
    taipeiClock.hour,
    taipeiClock.minute,
    taipeiClock.second
  );
  const utcClock = toInput(sameInstantAtOffset(taipeiSolar, 0));

  const taipei = resolveBirthPillars(taipeiClock, { utcOffsetHours: 8 });
  const utc = resolveBirthPillars(utcClock, { utcOffsetHours: 0 });

  assert.equal(utc.pillars.year.name, taipei.pillars.year.name);
  assert.equal(utc.pillars.month.name, taipei.pillars.month.name);
  assert.notEqual(utc.pillars.day.name, taipei.pillars.day.name);
  assert.notEqual(utc.pillars.hour.name, taipei.pillars.hour.name);
});

test("adapter records explicit local civil time and UTC offset", () => {
  const result = resolveBirthPillars(
    { year: 2024, month: 2, day: 9, hour: 13 },
    { utcOffsetHours: 5.5 }
  );
  assert.equal(result.convention.timeBasis, "birthplace-local-civil-time");
  assert.equal(result.convention.utcOffsetHours, 5.5);
  assert.equal(result.convention.solarTermReferenceUtcOffset, 8);
  assert.equal(result.convention.yearBoundary, "exact-li-chun");
  assert.equal(result.convention.monthBoundary, "exact-jie");
});

test("UTC offset is bounded to civil-time-zone range", () => {
  const input = { year: 2024, month: 2, day: 9, hour: 13 };
  assert.throws(() => resolveBirthPillars(input, { utcOffsetHours: 15 }), /utcOffsetHours/);
  assert.throws(() => resolveBirthPillars(input, { utcOffsetHours: Number.NaN }), /utcOffsetHours/);
});
