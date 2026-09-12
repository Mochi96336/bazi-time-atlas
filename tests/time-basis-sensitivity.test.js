import test from "node:test";
import assert from "node:assert/strict";

import {
  DAY_HOUR_TIME_BASIS,
  compareDayHourTimeBases
} from "../src/calendar/time-basis-sensitivity.js";
import { DAY_BOUNDARY } from "../src/calendar/tyme-adapter.js";

function byId(result, id) {
  return result.rows.find(row => row.id === id);
}

test("ordinary birth time keeps Day and Hour pillars stable across all three clock bases", () => {
  const result = compareDayHourTimeBases(
    { year: 2005, month: 12, day: 23, hour: 8, minute: 37, second: 0 },
    {
      longitudeDegrees: 121.5,
      utcOffsetHours: 8,
      dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    }
  );

  assert.equal(result.anyChange, false);
  assert.equal(result.fixedPillars.year.name, "乙酉");
  assert.equal(result.fixedPillars.month.name, "戊子");
  assert.deepEqual(
    result.rows.map(row => [row.id, row.day.name, row.hour.name]),
    [
      [DAY_HOUR_TIME_BASIS.CIVIL, "辛巳", "壬辰"],
      [DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR, "辛巳", "壬辰"],
      [DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR, "辛巳", "壬辰"]
    ]
  );
});

test("solar correction can cross Zi-initial and change both Day and Hour pillars", () => {
  const result = compareDayHourTimeBases(
    { year: 2005, month: 12, day: 23, hour: 22, minute: 55, second: 0 },
    {
      longitudeDegrees: 121.5,
      utcOffsetHours: 8,
      dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    }
  );

  const civil = byId(result, DAY_HOUR_TIME_BASIS.CIVIL);
  const mean = byId(result, DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR);
  const apparent = byId(result, DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR);

  assert.equal(civil.clock.hour, 22);
  assert.equal(civil.day.name, "辛巳");
  assert.equal(civil.hour.branch, "亥");

  assert.equal(mean.clock.hour, 23);
  assert.equal(mean.day.name, "壬午");
  assert.equal(mean.hour.name, "庚子");
  assert.equal(mean.changedFromCivil.day, true);
  assert.equal(mean.changedFromCivil.hour, true);

  assert.equal(apparent.clock.hour, 23);
  assert.equal(apparent.day.name, "壬午");
  assert.equal(apparent.hour.name, "庚子");
  assert.equal(apparent.changedFromCivil.day, true);
  assert.equal(apparent.changedFromCivil.hour, true);
  assert.equal(result.anyDayChange, true);
  assert.equal(result.anyHourChange, true);
});

test("with midnight day boundary the same correction can change Hour without changing Day", () => {
  const result = compareDayHourTimeBases(
    { year: 2005, month: 12, day: 23, hour: 22, minute: 55, second: 0 },
    {
      longitudeDegrees: 121.5,
      utcOffsetHours: 8,
      dayBoundary: DAY_BOUNDARY.CIVIL_MIDNIGHT
    }
  );

  const civil = byId(result, DAY_HOUR_TIME_BASIS.CIVIL);
  const mean = byId(result, DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR);
  const apparent = byId(result, DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR);

  assert.equal(civil.day.name, "辛巳");
  assert.equal(mean.day.name, "辛巳");
  assert.equal(apparent.day.name, "辛巳");
  assert.equal(mean.hour.name, "戊子");
  assert.equal(apparent.hour.name, "戊子");
  assert.equal(result.anyDayChange, false);
  assert.equal(result.anyHourChange, true);
});

test("Year and Month stay anchored to the physical instant instead of corrected clock labels", () => {
  const result = compareDayHourTimeBases(
    { year: 2024, month: 2, day: 4, hour: 15, minute: 30, second: 0 },
    {
      longitudeDegrees: 180,
      utcOffsetHours: -12,
      dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    }
  );

  assert.ok(result.fixedPillars.year.name.length === 2);
  assert.ok(result.fixedPillars.month.name.length === 2);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].id, DAY_HOUR_TIME_BASIS.CIVIL);
});
