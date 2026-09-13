import test from "node:test";
import assert from "node:assert/strict";

import { apparentSolarLongitude } from "../src/astronomy/solar-longitude.js";
import {
  jieBoundaryContext,
  solarTermNamedEventsBetween
} from "../src/astronomy/solar-term-boundaries.js";
import { shortestAngleDelta } from "../src/wheel/polar-geometry.js";
import {
  LINKED_SCRUB_CONSTANTS,
  applyLinkedRingDrag,
  consumeDiscreteDrag,
  solveLinkedLongitudeDrag,
  stepLinkedDiscreteInstant
} from "../src/interaction/linked-ring-scrub.js";

const DAY_MS = 86_400_000;
const UTC_OFFSET_HOURS = 8;

function fieldsFromInstant(ms) {
  const shifted = new Date(ms + UTC_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

function longitudeAtMs(ms) {
  return apparentSolarLongitude(fieldsFromInstant(ms), UTC_OFFSET_HOURS);
}

test("discrete linked drag consumes six-degree teeth without losing remainder", () => {
  assert.deepEqual(consumeDiscreteDrag(0, 5.9), { steps:0, remainderDegrees:5.9 });
  assert.deepEqual(consumeDiscreteDrag(5.9, 0.2), { steps:1, remainderDegrees:0.10000000000000053 });
  assert.deepEqual(consumeDiscreteDrag(0, -6.1), { steps:-1, remainderDegrees:-0.09999999999999964 });
  const multi = consumeDiscreteDrag(1.5, 17);
  assert.equal(multi.steps, 3);
  assert.ok(Math.abs(multi.remainderDegrees - 0.5) < 1e-12);
});

test("day gear maps clockwise ring drag to one earlier civil day", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const result = applyLinkedRingDrag({ ringId:"day", instantMs:start, deltaDegrees:6, remainderDegrees:0 });
  assert.equal(result.appliedSteps, 1);
  assert.equal(result.instantMs, start - DAY_MS);
  assert.equal(result.remainderDegrees, 0);

  const reverse = applyLinkedRingDrag({ ringId:"day", instantMs:start, deltaDegrees:-6, remainderDegrees:0 });
  assert.equal(reverse.appliedSteps, -1);
  assert.equal(reverse.instantMs, start + DAY_MS);
});

test("month gear steps by exact Jie boundaries instead of fixed thirty-day arithmetic", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const context = jieBoundaryContext(start);
  assert.ok(context.previous && context.next);

  const forward = stepLinkedDiscreteInstant("month", start, 1);
  assert.equal(forward, context.next.instantMs + LINKED_SCRUB_CONSTANTS.boundaryEntryEpsilonMs);

  const previousContext = jieBoundaryContext(context.previous.instantMs - 1);
  assert.ok(previousContext.previous);
  const backward = stepLinkedDiscreteInstant("month", start, -1);
  assert.equal(backward, previousContext.previous.instantMs + LINKED_SCRUB_CONSTANTS.boundaryEntryEpsilonMs);

  assert.notEqual(Math.round((forward - start) / DAY_MS), 30, "month stepping must not be a fixed +30d shortcut");
});

test("year gear steps between LiChun boundaries rather than Gregorian New Year", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const events = solarTermNamedEventsBetween(start - 800 * DAY_MS, start + 800 * DAY_MS, ["立春"]);
  const currentIndex = events.findLastIndex(event => event.instantMs <= start);
  assert.ok(currentIndex >= 1 && currentIndex + 1 < events.length);

  const forward = stepLinkedDiscreteInstant("year", start, 1);
  const backward = stepLinkedDiscreteInstant("year", start, -1);
  assert.equal(forward, events[currentIndex + 1].instantMs + LINKED_SCRUB_CONSTANTS.boundaryEntryEpsilonMs);
  assert.equal(backward, events[currentIndex - 1].instantMs + LINKED_SCRUB_CONSTANTS.boundaryEntryEpsilonMs);

  const forwardFields = fieldsFromInstant(forward);
  assert.ok(forwardFields.month === 2 && forwardFields.day <= 5, "forward year step should enter the next LiChun interval");
});

test("solar and zodiac linked drag solve the underlying apparent solar longitude", () => {
  const start = Date.parse("2027-03-15T13:20:09.000Z");
  const startLongitude = longitudeAtMs(start);
  const delta = 12.5;
  const target = ((startLongitude - delta) % 360 + 360) % 360;

  const solved = solveLinkedLongitudeDrag({ instantMs:start, dragDeltaDegrees:delta, longitudeAtMs });
  const solvedLongitude = longitudeAtMs(solved);
  assert.ok(Math.abs(shortestAngleDelta(solvedLongitude, target)) < 0.001, `${solvedLongitude} should solve target ${target}`);
  assert.ok(solved < start - 10 * DAY_MS && solved > start - 15 * DAY_MS, "12.5° clockwise should move roughly twelve days backward");

  for (const ringId of ["solar", "zodiac"]) {
    const result = applyLinkedRingDrag({ ringId, instantMs:start, deltaDegrees:delta, longitudeAtMs });
    assert.ok(Math.abs(shortestAngleDelta(longitudeAtMs(result.instantMs), target)) < 0.001);
    assert.equal(result.remainderDegrees, 0);
    assert.equal(result.appliedSteps, 0);
  }
});
