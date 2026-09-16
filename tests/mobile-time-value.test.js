import test from "node:test";
import assert from "node:assert/strict";

import {
  formatMobileAtlasInput,
  parseMobileAtlasInput
} from "../src/mobile-time-value.js";

test("mobile exact time round-trips UTC+8 through second precision", () => {
  const instantMs = Date.parse("2026-09-15T20:14:37.000Z");
  const value = formatMobileAtlasInput(instantMs);
  assert.equal(value, "2026-09-16T04:14:37");
  assert.equal(parseMobileAtlasInput(value), instantMs);
});

test("deep-time year 4006 stays representable in the mobile exact input", () => {
  const value = "4006-03-05T10:22:45";
  const instantMs = parseMobileAtlasInput(value);
  assert.ok(Number.isFinite(instantMs));
  assert.equal(formatMobileAtlasInput(instantMs), value);
});

test("invalid calendar dates and minute-only values fail closed", () => {
  assert.equal(parseMobileAtlasInput("2026-02-30T12:00:00"), null);
  assert.equal(parseMobileAtlasInput("2026-09-16T04:14"), null);
  assert.equal(parseMobileAtlasInput("2026-09-16T24:00:00"), null);
});
