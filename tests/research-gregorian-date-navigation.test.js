import test from "node:test";
import assert from "node:assert/strict";
import { gregorianOrdinal } from "../src/recurrence/gregorian-cycle.js";
import {
  gregorianDateFromOrdinal,
  shiftGregorianDate,
  differenceInGregorianDays
} from "../src/recurrence/gregorian-date-navigation.js";

const samples = [
  {year:1,month:1,day:1},
  {year:1,month:12,day:31},
  {year:4,month:2,day:29},
  {year:100,month:3,day:1},
  {year:400,month:12,day:31},
  {year:401,month:1,day:1},
  {year:1900,month:3,day:1},
  {year:2000,month:2,day:29},
  {year:2023,month:12,day:31},
  {year:2024,month:2,day:29},
  {year:2026,month:9,day:13},
  {year:26026,month:9,day:13},
  {year:9999999,month:12,day:31},
  {year:10000000,month:12,day:31}
];

test("Gregorian ordinal inverse round-trips year 1, 400-year edges, leap days and deep time", () => {
  for (const date of samples) {
    const roundTrip = gregorianDateFromOrdinal(gregorianOrdinal(date));
    assert.deepEqual(roundTrip,date,JSON.stringify(date));
    assert.ok(Object.isFrozen(roundTrip));
  }
});

test("Gregorian ordinal inverse round-trips every day around the century/era boundary", () => {
  for (const date of [
    {year:100,month:2,day:25},
    {year:400,month:12,day:25},
    {year:1900,month:2,day:25},
    {year:2000,month:2,day:25},
    {year:2400,month:2,day:25}
  ]) {
    const first = gregorianOrdinal(date);
    for (let n = 0; n < 12; n++) {
      const candidate = gregorianDateFromOrdinal(first + n);
      assert.equal(gregorianOrdinal(candidate),first + n);
    }
  }
});

test("signed day shifts are inverse across leap days and year changes", () => {
  const cases = [
    [{year:2024,month:2,day:28},1,{year:2024,month:2,day:29}],
    [{year:2024,month:2,day:28},2,{year:2024,month:3,day:1}],
    [{year:2023,month:12,day:31},1,{year:2024,month:1,day:1}],
    [{year:2024,month:1,day:1},-1,{year:2023,month:12,day:31}],
    [{year:1900,month:2,day:28},1,{year:1900,month:3,day:1}],
    [{year:2000,month:2,day:28},1,{year:2000,month:2,day:29}],
    [{year:2026,month:9,day:13},60,{year:2026,month:11,day:12}]
  ];
  for (const [start,offset,expected] of cases) {
    assert.deepEqual(shiftGregorianDate(start,offset),expected);
    assert.deepEqual(shiftGregorianDate(expected,-offset),start);
    assert.equal(differenceInGregorianDays(start,expected),offset);
    assert.equal(differenceInGregorianDays(expected,start),-offset);
  }
});

test("400-year and 24,000-year shifts use the same integer Gregorian recurrence", () => {
  const base = {year:2026,month:9,day:13};
  for (const years of [400,1200,8000,24000]) {
    const target = {year:base.year+years,month:base.month,day:base.day};
    const days = differenceInGregorianDays(base,target);
    assert.equal(days,years/400 * 146097);
    assert.deepEqual(shiftGregorianDate(base,days),target);
    assert.deepEqual(shiftGregorianDate(target,-days),base);
  }
});

test("free-date navigation rejects invalid and out-of-range dates without overflow", () => {
  const first = {year:1,month:1,day:1};
  const last = {year:10000000,month:12,day:31};
  assert.equal(gregorianDateFromOrdinal(0).year,1);
  assert.deepEqual(gregorianDateFromOrdinal(gregorianOrdinal(last)),last);
  for (const offset of [-1,-5000]) assert.throws(()=>shiftGregorianDate(first,offset),RangeError);
  for (const offset of [1,5000]) assert.throws(()=>shiftGregorianDate(last,offset),RangeError);
  assert.throws(()=>gregorianDateFromOrdinal(-1),RangeError);
  assert.throws(()=>gregorianDateFromOrdinal(gregorianOrdinal(last)+1),RangeError);
  assert.throws(()=>gregorianDateFromOrdinal(1.5),RangeError);
  assert.throws(()=>shiftGregorianDate(first,Number.MAX_SAFE_INTEGER),RangeError);
  assert.throws(()=>shiftGregorianDate(first,1.25),RangeError);
  assert.throws(()=>shiftGregorianDate({year:2025,month:2,day:29},1),RangeError);
  assert.throws(()=>differenceInGregorianDays(first,{year:0,month:12,day:31}),RangeError);
});
