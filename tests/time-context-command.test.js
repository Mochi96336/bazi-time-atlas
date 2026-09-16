import test from "node:test";
import assert from "node:assert/strict";

import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import {
  TIME_CONTEXT_COMMAND,
  timeContextFromCommandDetail
} from "../src/interaction/time-context-command.js";

test("time-context command keeps one canonical event name", () => {
  assert.equal(TIME_CONTEXT_COMMAND, "atlas:set-time-context");
});

test("time-context command accepts only complete valid context", () => {
  assert.deepEqual(timeContextFromCommandDetail({
    timeContext:{ utcOffsetHours:9, dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
  }), {
    utcOffsetHours:9,
    dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT
  });

  assert.equal(timeContextFromCommandDetail({ timeContext:{ utcOffsetHours:9 } }), null);
  assert.equal(timeContextFromCommandDetail({ timeContext:{ dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT } }), null);
  assert.equal(timeContextFromCommandDetail({ timeContext:{ utcOffsetHours:"9", dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT } }), null);
  assert.equal(timeContextFromCommandDetail({ timeContext:{ utcOffsetHours:99, dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT } }), null);
  assert.equal(timeContextFromCommandDetail({ timeContext:{ utcOffsetHours:9, dayBoundary:"unknown" } }), null);
  assert.equal(timeContextFromCommandDetail(null), null);
});
