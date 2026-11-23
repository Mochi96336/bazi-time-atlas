import test from "node:test";
import assert from "node:assert/strict";
import { DAY_BOUNDARY, resolveBirthPillars } from "../src/calendar/tyme-adapter.js";
import { fastDayHourPillars, fastYearMonthPillars, julianDayNumber } from "../src/calendar/fast-pillars.js";
import { apparentSolarLongitude } from "../src/astronomy/solar-longitude.js";

const HOUR_MS = 3_600_000;
const BOUNDARIES = [DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY, DAY_BOUNDARY.CIVIL_MIDNIGHT];

function fieldsAt(ms) {
  const date = new Date(ms);
  return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds()
  };
}

function exact(fields, dayBoundary, utcOffsetHours = 8) {
  return resolveBirthPillars(fields, { dayBoundary, utcOffsetHours, cache:false }).pillars;
}

test("Julian Day Numbers follow Tyme's Julian/Gregorian switch", () => {
  assert.equal(julianDayNumber(2000, 1, 1), 2451545);
  assert.equal(julianDayNumber(1582, 10, 15), 2299161);
  assert.equal(julianDayNumber(1582, 10, 4), 2299160);
  assert.equal(julianDayNumber(-4712, 1, 1), 0);
});

test("day and hour arithmetic equals Tyme for every hour across one span", () => {
  const start = Date.UTC(2024, 0, 30);
  for (let ms = start; ms < start + 4 * 24 * HOUR_MS; ms += HOUR_MS) {
    const fields = fieldsAt(ms);
    for (const dayBoundary of BOUNDARIES) {
      const want = exact(fields, dayBoundary);
      assert.deepEqual(fastDayHourPillars(fields, dayBoundary), { day:want.day, hour:want.hour },
        `${JSON.stringify(fields)} ${dayBoundary}`);
    }
  }
});

test("day and hour arithmetic equals Tyme across millennia and the 1582 reform", () => {
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const cases = [];
  for (let i = 0; i < 300; i += 1) {
    cases.push({
      year: 1 + Math.floor(random() * 3999),
      month: 1 + Math.floor(random() * 12),
      day: 1 + Math.floor(random() * 28),
      hour: [0, 1, 11, 22, 23][i % 5], minute: 30, second: 0
    });
  }
  for (const [year, month, day] of [[1582, 10, 4], [1582, 10, 15], [1600, 2, 29], [1900, 3, 1]]) {
    for (const hour of [0, 23]) cases.push({ year, month, day, hour, minute:0, second:0 });
  }
  for (const fields of cases) {
    for (const dayBoundary of BOUNDARIES) {
      const want = exact(fields, dayBoundary);
      assert.deepEqual(fastDayHourPillars(fields, dayBoundary), { day:want.day, hour:want.hour },
        `${JSON.stringify(fields)} ${dayBoundary}`);
    }
  }
});

test("year and month estimate equals Tyme away from Jie boundaries", () => {
  let disagreements = 0;
  let checked = 0;
  const start = Date.UTC(2023, 0, 1);
  for (let ms = start; ms < start + 3 * 366 * 24 * HOUR_MS; ms += 5 * HOUR_MS + 17 * 60_000) {
    const fields = fieldsAt(ms); // read as a UTC+8 clock
    const longitude = apparentSolarLongitude(fields, 8);
    const fast = fastYearMonthPillars(fields, longitude);
    const want = exact(fields, DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY);
    checked += 1;
    if (fast.year.name !== want.year.name || fast.month.name !== want.month.name) {
      disagreements += 1;
      // Only the instants hugging a Jie may differ: within 0.01° ≈ 15 min.
      const offset = (((longitude - 315) % 30) + 30) % 30;
      assert.ok(Math.min(offset, 30 - offset) < 0.01,
        `${JSON.stringify(fields)} λ=${longitude} fast=${fast.year.name}/${fast.month.name} tyme=${want.year.name}/${want.month.name}`);
    }
  }
  assert.ok(checked > 4000 && disagreements <= 2, `disagreements ${disagreements}/${checked}`);
});
