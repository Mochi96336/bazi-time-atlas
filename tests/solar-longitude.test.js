import test from "node:test";
import assert from "node:assert/strict";
import { SolarTerm } from "../vendor/tyme4ts-1.5.2.mjs";
import {
  apparentSolarLongitude,
  shortestAngularError
} from "../src/astronomy/solar-longitude.js";

function timeInput(time) {
  return {
    year: time.getYear(),
    month: time.getMonth(),
    day: time.getDay(),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond()
  };
}

for (const year of [2005, 2024]) {
  test(`apparent solar longitude returns all 24 solar-term nodes in ${year}`, () => {
    for (let index = 0; index < 24; index += 1) {
      const term = SolarTerm.fromIndex(year, index);
      const time = term.getJulianDay().getSolarTime();
      const expected = (270 + index * 15) % 360;
      const actual = apparentSolarLongitude(timeInput(time), 8);
      const error = shortestAngularError(actual, expected);

      assert.ok(
        error < 0.001,
        `${term.getName()} ${time.toString()}: expected ${expected}°, got ${actual}° (error ${error}°)`
      );
    }
  });
}

test("solar longitude requires an explicit valid UTC offset", () => {
  const input = { year: 2024, month: 3, day: 20, hour: 11, minute: 6, second: 0 };
  assert.throws(() => apparentSolarLongitude(input, 15), /utcOffsetHours/);
  assert.throws(() => apparentSolarLongitude(input, Number.NaN), /utcOffsetHours/);
});
