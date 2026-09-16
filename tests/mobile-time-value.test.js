import test from "node:test";
import assert from "node:assert/strict";

import {
  MOBILE_ATLAS_INPUT_DISPLAY_FORMAT,
  formatMobileAtlasInput,
  parseMobileAtlasInput
} from "../src/mobile-time-value.js";

test("mobile exact time has one deterministic visible format", () => {
  assert.equal(MOBILE_ATLAS_INPUT_DISPLAY_FORMAT, "YYYY-MM-DD HH:mm:ss");
  const instantMs = Date.parse("2026-09-15T20:14:37.000Z");
  const value = formatMobileAtlasInput(instantMs);
  assert.equal(value, "2026-09-16 04:14:37");
  assert.equal(parseMobileAtlasInput(value), instantMs);
});

test("mobile exact time can round-trip a non-default fixed offset", () => {
  const instantMs = Date.parse("2026-09-15T20:14:37.000Z");
  const timeContext = { utcOffsetHours: 5.5 };
  const value = formatMobileAtlasInput(instantMs, timeContext);
  assert.equal(value, "2026-09-16 01:44:37");
  assert.equal(parseMobileAtlasInput(value, timeContext), instantMs);
});

test("legacy datetime-local T separator remains accepted during migration", () => {
  const instantMs = Date.parse("2026-09-15T20:14:37.000Z");
  assert.equal(parseMobileAtlasInput("2026-09-16T04:14:37"), instantMs);
});

test("deep-time year 4006 stays representable in the mobile exact input", () => {
  const value = "4006-03-05 10:22:45";
  const instantMs = parseMobileAtlasInput(value);
  assert.ok(Number.isFinite(instantMs));
  assert.equal(formatMobileAtlasInput(instantMs), value);
});

test("invalid calendar dates and minute-only values fail closed", () => {
  assert.equal(parseMobileAtlasInput("2026-02-30 12:00:00"), null);
  assert.equal(parseMobileAtlasInput("2026-09-16 04:14"), null);
  assert.equal(parseMobileAtlasInput("2026-09-16 24:00:00"), null);
});
