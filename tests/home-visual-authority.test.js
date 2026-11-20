import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cssSource } from "./helpers/css-source.js";

const atlas = cssSource("kinetic-atlas.css");
const analysis = cssSource("ux-analysis.css");
const tools = cssSource("desktop-tools-workspace.css");
const inverse = cssSource("inverse-time-search.css");
const mobile = cssSource("mobile-time.css");
const classification = cssSource("classification-overlay.css");

test("Home Art H0 gives page and edge surfaces one reference-field authority", () => {
  assert.match(atlas, /--field:\s*#0a0d13;/);
  assert.match(atlas, /--field-raised:\s*#0e121a;/);
  assert.match(atlas, /--bg:\s*var\(--field\);/);
  assert.match(atlas, /html \{ background: var\(--field\); \}/);
  assert.match(atlas, /linear-gradient\(180deg, #0e141d 0%, var\(--field\) 68%, #080a10 100%\)/);
  for (const css of [tools, inverse]) {
    assert.doesNotMatch(css, /rgba\(9,10,11,/);
    assert.match(css, /color-mix\(in srgb, var\(--field\)/);
  }
  assert.doesNotMatch(mobile, /#111512/);
  assert.match(mobile, /#mobile-instant-input[\s\S]*?border-bottom:\s*1px solid var\(--hairline\);[\s\S]*?background:\s*transparent;/);
  assert.match(classification, /color-mix\(in srgb, var\(--field\) 96%, transparent\)/);
});

test("fixed identities have a readability authority distinct from ring material bodies", () => {
  for (const role of ["hour", "day", "month", "year", "solar"]) {
    assert.match(atlas, new RegExp(`--identity-${role}:\\s*color-mix\\(in srgb, var\\(--${role}\\) `));
    assert.match(analysis, new RegExp(`\\.ring-${role} span \\{ color: var\\(--identity-${role}, var\\(--${role},`));
  }
});

test("Classification owns Zodiac outline structure independently from resting material color", () => {
  assert.match(classification, /--classification-zodiac-outline:\s*#8f999d;/);
  assert.match(classification, /data-classification-overlay="on"\] \.zodiac-sector \{[\s\S]*?stroke:\s*var\(--classification-zodiac-outline\);/);
  assert.doesNotMatch(classification, /data-classification-overlay="on"\] \.zodiac-sector \{[\s\S]*?stroke:[^;]*var\(--zodiac\)/);
});
