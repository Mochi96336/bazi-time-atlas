import test from "node:test";
import assert from "node:assert/strict";
import { SolarTerm } from "../vendor/tyme4ts-1.5.2.mjs";
import { DAY_BOUNDARY, resolveBirthPillars } from "../src/calendar/tyme-adapter.js";

const HOUR_MS = 3_600_000;
const BOUNDARIES = [DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY, DAY_BOUNDARY.CIVIL_MIDNIGHT];

function fieldsAt(ms) {
  const date = new Date(ms);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds()
  };
}

// `ms` is read as a wall clock in `utcOffsetHours`, the way the atlas passes
// birthplace-local fields.
function assertSame(ms, utcOffsetHours, dayBoundary) {
  const input = fieldsAt(ms);
  const options = { utcOffsetHours, dayBoundary };
  const cached = resolveBirthPillars(input, options);
  const exact = resolveBirthPillars(input, { ...options, cache:false });
  assert.deepEqual(cached.pillars, exact.pillars,
    `${JSON.stringify(input)} UTC${utcOffsetHours} ${dayBoundary}`);
}

function jieClockMs(year, index) {
  const time = SolarTerm.fromIndex(year, index).getJulianDay().getSolarTime();
  return Date.UTC(time.getYear(), time.getMonth() - 1, time.getDay(),
    time.getHour(), time.getMinute(), time.getSecond());
}

test("cached pillars equal Tyme's direct result one second around every Jie", () => {
  for (const year of [1900, 1987, 2024, 2025]) {
    for (let index = 1; index < 24; index += 2) {
      // UTC+8 is Tyme's solar-term clock, so these are exact boundary seconds.
      const boundaryMs = jieClockMs(year, index);
      for (const deltaS of [-2, -1, 0, 1, 2]) {
        for (const dayBoundary of BOUNDARIES) assertSame(boundaryMs + deltaS * 1000, 8, dayBoundary);
      }
    }
  }
});

test("cached pillars equal Tyme across a drag-like sweep in several zones", () => {
  const startMs = Date.UTC(2023, 10, 1);
  for (const utcOffsetHours of [8, 0, -5, 9.5]) {
    for (const dayBoundary of BOUNDARIES) {
      // 7h13m steps walk through every hour branch, 23:00 and month edges.
      for (let ms = startMs; ms < startMs + 200 * 24 * HOUR_MS; ms += 7 * HOUR_MS + 13 * 60_000) {
        assertSame(ms, utcOffsetHours, dayBoundary);
      }
    }
  }
});

test("cached pillars equal Tyme at scattered instants across centuries", () => {
  let seed = 20261123;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const lo = Date.UTC(1600, 0, 1);
  const hi = Date.UTC(2400, 0, 1);
  for (let i = 0; i < 400; i += 1) {
    const ms = lo + Math.floor(random() * (hi - lo) / 1000) * 1000;
    assertSame(ms, [8, 0, -5, 9.5][i % 4], BOUNDARIES[i % 2]);
  }
});

test("cached results are independent copies", () => {
  const input = { year:2024, month:5, day:6, hour:10, minute:0, second:0 };
  const first = resolveBirthPillars(input);
  first.pillars.year.name = "mutated";
  first.pillars.day.name = "mutated";
  const second = resolveBirthPillars(input);
  assert.notEqual(second.pillars.year.name, "mutated");
  assert.notEqual(second.pillars.day.name, "mutated");
});
