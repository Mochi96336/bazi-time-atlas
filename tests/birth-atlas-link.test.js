import test from "node:test";
import assert from "node:assert/strict";

import { birthAtlasLink } from "../src/birth-atlas-link.js";
import { DAY_BOUNDARY } from "../src/calendar/day-boundary.js";

const input = Object.freeze({
  year: 2026,
  month: 9,
  day: 14,
  hour: 7,
  minute: 43,
  second: 42
});

function parsed(value) {
  assert.ok(value, "expected Atlas URL");
  return new URL(value);
}

test("Birth pillar link preserves the exact instant and omits default Atlas context", () => {
  const url = parsed(birthAtlasLink({
    birthHref: "https://example.test/project/birth.html?tenGod=1",
    input,
    utcOffsetHours: 8,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    inspect: "year"
  }));

  assert.equal(url.origin, "https://example.test");
  assert.equal(url.pathname, "/project/");
  assert.equal(url.searchParams.get("instant"), "2026-09-13T23:43:42.000Z");
  assert.equal(url.searchParams.get("inspect"), "year");
  assert.equal(url.searchParams.has("utc"), false);
  assert.equal(url.searchParams.has("dayBoundary"), false);
  assert.equal(url.searchParams.has("lambda"), false);
  assert.equal(url.searchParams.has("month"), false);
  assert.equal(url.searchParams.has("yearStem"), false);
});

test("Birth pillar link carries non-default offset and day-boundary context", () => {
  const url = parsed(birthAtlasLink({
    birthHref: "https://example.test/project/birth.html",
    input,
    utcOffsetHours: 9,
    dayBoundary: DAY_BOUNDARY.CIVIL_MIDNIGHT,
    inspect: "hour"
  }));

  assert.equal(url.searchParams.get("instant"), "2026-09-13T22:43:42.000Z");
  assert.equal(url.searchParams.get("utc"), "9");
  assert.equal(url.searchParams.get("dayBoundary"), DAY_BOUNDARY.CIVIL_MIDNIGHT);
  assert.equal(url.searchParams.get("inspect"), "hour");
});

test("Birth Atlas projection link targets the same exact instant without inspector state", () => {
  const url = parsed(birthAtlasLink({
    birthHref: "https://example.test/project/birth.html",
    input,
    utcOffsetHours: 8,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  }));

  assert.equal(url.searchParams.get("instant"), "2026-09-13T23:43:42.000Z");
  assert.equal(url.searchParams.has("inspect"), false);
});

test("Birth Atlas link rejects non-pillar inspector states", () => {
  assert.throws(() => birthAtlasLink({
    birthHref: "https://example.test/project/birth.html",
    input,
    utcOffsetHours: 8,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    inspect: "solar"
  }), /unsupported Atlas pillar inspector/);
});

test("Birth Atlas link fails closed for an invalid Birth URL", () => {
  assert.equal(birthAtlasLink({
    birthHref: "not a url",
    input,
    utcOffsetHours: 8,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY,
    inspect: "day"
  }), null);
});
