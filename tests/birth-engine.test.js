import test from "node:test";
import assert from "node:assert/strict";
import { SolarTerm } from "tyme4ts";
import { DAY_BOUNDARY, resolveBirthPillars } from "../src/calendar/tyme-adapter.js";

function names(result) {
  return Object.values(result.pillars).map(pillar => pillar.name);
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
  const before = liChun.next(-1);
  const after = liChun.next(1);

  const beforeResult = resolveBirthPillars({
    year: before.getYear(),
    month: before.getMonth(),
    day: before.getDay(),
    hour: before.getHour(),
    minute: before.getMinute(),
    second: before.getSecond()
  });
  const afterResult = resolveBirthPillars({
    year: after.getYear(),
    month: after.getMonth(),
    day: after.getDay(),
    hour: after.getHour(),
    minute: after.getMinute(),
    second: after.getSecond()
  });

  assert.equal(beforeResult.pillars.year.name, "癸卯");
  assert.equal(afterResult.pillars.year.name, "甲辰");
});

test("month pillar flips across a Jie instant while year/day remain independent", () => {
  const jingZhe = SolarTerm.fromName(2024, "惊蛰").getJulianDay().getSolarTime();
  const before = jingZhe.next(-1);
  const after = jingZhe.next(1);

  const toInput = time => ({
    year: time.getYear(),
    month: time.getMonth(),
    day: time.getDay(),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond()
  });
  const beforeResult = resolveBirthPillars(toInput(before));
  const afterResult = resolveBirthPillars(toInput(after));

  assert.equal(beforeResult.pillars.year.name, afterResult.pillars.year.name);
  assert.notEqual(beforeResult.pillars.month.name, afterResult.pillars.month.name);
  assert.equal(beforeResult.pillars.day.name, afterResult.pillars.day.name);
});

test("adapter records that it accepts local civil time rather than JS Date/UTC", () => {
  const result = resolveBirthPillars({ year: 2024, month: 2, day: 9, hour: 13 });
  assert.equal(result.convention.timeBasis, "local-civil-time");
  assert.equal(result.convention.yearBoundary, "exact-li-chun");
  assert.equal(result.convention.monthBoundary, "exact-jie");
});
