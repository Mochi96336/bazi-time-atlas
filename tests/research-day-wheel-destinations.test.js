import test from "node:test";
import assert from "node:assert/strict";
import { dayWheelDateDestinations } from "../src/recurrence/day-wheel-date-destinations.js";
import { sexagenaryDayForGregorianDate } from "../src/recurrence/ganzhi-cycle-comparison.js";
import { differenceInGregorianDays } from "../src/recurrence/gregorian-date-navigation.js";

const mod60 = n => (n % 60 + 60) % 60;

test("same Ganzhi index means a genuinely previous and next 60-day occurrence, never today", () => {
  const date={year:2024,month:2,day:10};
  const current=sexagenaryDayForGregorianDate(date);
  const result=dayWheelDateDestinations(date,current.index);
  assert.equal(result.currentName,current.name);
  assert.equal(result.selectedName,current.name);
  assert.equal(result.sameAsCurrent,true);
  assert.equal(result.previous.offsetDays,-60);
  assert.equal(result.next.offsetDays,60);
  assert.equal(differenceInGregorianDays(result.previous.date,date),60);
  assert.equal(differenceInGregorianDays(date,result.next.date),60);
  assert.equal(sexagenaryDayForGregorianDate(result.previous.date).name,current.name);
  assert.equal(sexagenaryDayForGregorianDate(result.next.date).name,current.name);
});

test("all 60 selections have mathematically nearest strict occurrences across leap February", () => {
  const dates=[
    {year:2024,month:2,day:28},
    {year:2024,month:2,day:29},
    {year:2023,month:12,day:31},
    {year:2026,month:9,day:13},
    {year:2400,month:3,day:1},
    {year:26026,month:9,day:13}
  ];
  for(const date of dates) {
    const current=sexagenaryDayForGregorianDate(date);
    for(let i=0;i<60;i++){
      const got=dayWheelDateDestinations(date,i);
      const forward=mod60(i-current.index);
      const expectedNext=forward===0?60:forward;
      const expectedPrior=forward===0?-60:forward-60;
      assert.equal(got.next.offsetDays,expectedNext);
      assert.equal(got.previous.offsetDays,expectedPrior);
      assert.ok(expectedPrior<=-1 && expectedPrior>=-60);
      assert.ok(expectedNext>=1 && expectedNext<=60);
      assert.equal(differenceInGregorianDays(date,got.next.date),expectedNext);
      assert.equal(differenceInGregorianDays(date,got.previous.date),expectedPrior);
      assert.equal(sexagenaryDayForGregorianDate(got.next.date).index,i);
      assert.equal(sexagenaryDayForGregorianDate(got.previous.date).index,i);
      assert.ok(Object.isFrozen(got));
    }
  }
});

test("calendar bounds disable only the unavailable direction without wrapping the era", () => {
  const first={year:1,month:1,day:1};
  const f=dayWheelDateDestinations(first,sexagenaryDayForGregorianDate(first).index);
  assert.equal(f.previous.date,null);
  assert.equal(f.previous.offsetDays,-60);
  assert.ok(f.next.date);
  const last={year:10000000,month:12,day:31};
  const l=dayWheelDateDestinations(last,sexagenaryDayForGregorianDate(last).index);
  assert.equal(l.next.date,null);
  assert.equal(l.next.offsetDays,60);
  assert.ok(l.previous.date);
});

test("invalid wheel indices and impossible civil dates fail closed", () => {
  const date={year:2026,month:9,day:13};
  for(const index of [-1,60,61,1.2,NaN,Infinity,"1",null]) {
    assert.throws(()=>dayWheelDateDestinations(date,index),RangeError);
  }
  assert.throws(()=>dayWheelDateDestinations({year:2025,month:2,day:29},0),RangeError);
});
