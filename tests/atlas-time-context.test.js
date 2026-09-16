import test from "node:test";
import assert from "node:assert/strict";

import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  atlasTimeContextFromSearch,
  writeAtlasTimeContextSearch
} from "../src/wheel/atlas-time-context.js";

test("missing temporal context query stays on minimal production defaults", () => {
  assert.equal(atlasTimeContextFromSearch("?instant=2026-09-16T00%3A00%3A00.000Z"), DEFAULT_ATLAS_TIME_CONTEXT);
});

test("non-default fixed offset and day boundary round-trip from query state", () => {
  const context = atlasTimeContextFromSearch("?utc=-3.5&dayBoundary=civil-midnight&keep=1");
  assert.deepEqual(context, {
    utcOffsetHours: -3.5,
    dayBoundary: DAY_BOUNDARY.CIVIL_MIDNIGHT
  });

  const params = new URLSearchParams("keep=1");
  writeAtlasTimeContextSearch(params, context);
  assert.equal(params.get("utc"), "-3.5");
  assert.equal(params.get("dayBoundary"), DAY_BOUNDARY.CIVIL_MIDNIGHT);
  assert.equal(params.get("keep"), "1");
});

test("canonical writer omits default context and clears stale custom keys", () => {
  const params = new URLSearchParams("utc=9&dayBoundary=civil-midnight&keep=1");
  writeAtlasTimeContextSearch(params, DEFAULT_ATLAS_TIME_CONTEXT);
  assert.equal(params.has("utc"), false);
  assert.equal(params.has("dayBoundary"), false);
  assert.equal(params.get("keep"), "1");
});

test("writer emits only the fields that differ from Atlas defaults", () => {
  const offsetOnly = new URLSearchParams();
  writeAtlasTimeContextSearch(offsetOnly, {
    utcOffsetHours: 9,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  });
  assert.equal(offsetOnly.toString(), "utc=9");

  const boundaryOnly = new URLSearchParams();
  writeAtlasTimeContextSearch(boundaryOnly, {
    utcOffsetHours: 8,
    dayBoundary: DAY_BOUNDARY.CIVIL_MIDNIGHT
  });
  assert.equal(boundaryOnly.toString(), "dayBoundary=civil-midnight");
});

test("malformed explicit query context fails closed as one unit", () => {
  assert.equal(atlasTimeContextFromSearch("?utc=99&dayBoundary=civil-midnight"), DEFAULT_ATLAS_TIME_CONTEXT);
  assert.equal(atlasTimeContextFromSearch("?utc=&dayBoundary=civil-midnight"), DEFAULT_ATLAS_TIME_CONTEXT);
  assert.equal(atlasTimeContextFromSearch("?utc=9&dayBoundary=unknown"), DEFAULT_ATLAS_TIME_CONTEXT);
});

test("writer rejects invalid temporal context instead of serializing partial state", () => {
  assert.throws(
    () => writeAtlasTimeContextSearch(new URLSearchParams(), { utcOffsetHours: 99 }),
    /utcOffsetHours/
  );
  assert.throws(
    () => writeAtlasTimeContextSearch(new URLSearchParams(), { dayBoundary: "unknown" }),
    /dayBoundary/
  );
});
