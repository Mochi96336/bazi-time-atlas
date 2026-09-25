import test from "node:test";
import assert from "node:assert/strict";
import {
  RESEARCH_GANZHI_DAY_ANCHOR,
  sexagenaryDayForGregorianDate,
  nominalSexagenaryYearForGregorianDate,
  researchGanzhiCycleComparison
} from "../src/recurrence/ganzhi-cycle-comparison.js";
import { resolveDayHourPillars, DAY_BOUNDARY } from "../src/calendar/tyme-adapter.js";
import { gregorianOrdinal } from "../src/recurrence/gregorian-cycle.js";
import { cycleItem } from "../src/sexagenary-data.js";

const mod60 = value => ((value % 60) + 60) % 60;

test("date-only day identity uses a concrete Tyme-validated modern anchor", () => {
  const date = { year:2026, month:9, day:13 };
  const expected = resolveDayHourPillars(
    { ...date, hour:12 }, { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  ).pillars.day.name;
  assert.equal(RESEARCH_GANZHI_DAY_ANCHOR.pillar, expected);
  assert.equal(sexagenaryDayForGregorianDate(date).name, expected);
});

test("day cycle follows real elapsed Gregorian days across leap days and year edges", () => {
  const dates = [
    {year:2023,month:12,day:31}, {year:2024,month:1,day:1},
    {year:2024,month:2,day:28}, {year:2024,month:2,day:29},
    {year:2024,month:3,day:1}, {year:2026,month:9,day:13},
    {year:2026,month:9,day:14}, {year:2026,month:11,day:11}
  ];
  for (const date of dates) {
    const item = sexagenaryDayForGregorianDate(date);
    assert.equal(item.name, resolveDayHourPillars(
      { ...date, hour:12 }, { dayBoundary:DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY }
    ).pillars.day.name, JSON.stringify(date));
  }
  for (const [earlier, later] of [
    [dates[0],dates[1]], [dates[2],dates[3]], [dates[3],dates[4]],
    [dates[5],dates[6]]
  ]) {
    assert.equal(gregorianOrdinal(later)-gregorianOrdinal(earlier), 1);
    assert.equal(mod60(sexagenaryDayForGregorianDate(later).index-
      sexagenaryDayForGregorianDate(earlier).index), 1);
  }
  const anchor = sexagenaryDayForGregorianDate(dates[5]);
  const plus60 = sexagenaryDayForGregorianDate({year:2026,month:11,day:12});
  assert.equal(plus60.index, anchor.index);
});

test("nominal year labels advance by Gregorian year without claiming pre-Li Chun identity", () => {
  assert.equal(nominalSexagenaryYearForGregorianDate({year:1984,month:2,day:1}).name,"甲子");
  assert.equal(nominalSexagenaryYearForGregorianDate({year:2024,month:2,day:1}).name,"甲辰");
  assert.equal(nominalSexagenaryYearForGregorianDate({year:2084,month:2,day:1}).name,"甲辰");
});

test("one comparison owns both absolute labels and relative phases", () => {
  for (const delta of [0, 1, 60, 400, 1200, 1980, 8000, 24000]) {
    const model = researchGanzhiCycleComparison({year:2026,month:9,day:13},delta);
    assert.ok(model.target);
    assert.equal(mod60(model.target.year.cycleIndex-model.base.year.cycleIndex),model.yearPhase);
    assert.equal(mod60(model.target.day.index-model.base.day.index),model.dayPhase);
    assert.equal(model.actualDaysElapsed % 60,model.dayPhase);
    assert.equal(model.target.day.name,cycleItem(model.base.day.index+model.actualDaysElapsed).name);
    assert.equal(model.yearPhaseClosed,delta%60===0);
    if(delta===24000) {
      assert.equal(model.yearPhase,0);
      assert.equal(model.dayPhase,0);
    }
  }
});

test("invalid target Gregorian date never fabricates a day pillar", () => {
  const model = researchGanzhiCycleComparison({year:2024,month:2,day:29},1);
  assert.equal(model.target,null);
  assert.equal(model.dayPhase,null);
  assert.equal(model.base.day.name,sexagenaryDayForGregorianDate({year:2024,month:2,day:29}).name);
  assert.throws(()=>sexagenaryDayForGregorianDate({year:2025,month:2,day:29}),RangeError);
});
