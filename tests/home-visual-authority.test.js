import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const atlas = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
const analysis = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");
const tools = readFileSync(new URL("../desktop-tools-workspace.css", import.meta.url), "utf8");
const inverse = readFileSync(new URL("../inverse-time-search.css", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../mobile-time.css", import.meta.url), "utf8");
const classification = readFileSync(new URL("../classification-overlay.css", import.meta.url), "utf8");

test("Home Art H0 gives page and edge surfaces one reference-field authority", () => {
  assert.match(atlas, /--field:\s*#090a0b;/);
  assert.match(atlas, /--field-raised:\s*#0e1011;/);
  assert.match(atlas, /--bg:\s*var\(--field\);/);
  assert.match(atlas, /html \{ background: var\(--field\); \}/);
  assert.match(atlas, /linear-gradient\(180deg, #0d0f10 0%, var\(--field\) 68%, #070809 100%\)/);
  for (const css of [tools, inverse]) {
    assert.doesNotMatch(css, /rgba\(9,10,11,/);
    assert.match(css, /color-mix\(in srgb, var\(--field\)/);
  }
  assert.doesNotMatch(mobile, /#111512/);
  assert.match(mobile, /#mobile-instant-input[\s\S]*?background:\s*var\(--field-raised\);/);
  assert.match(classification, /background:\s*color-mix\(in srgb, var\(--field\) 84%, transparent\);/);
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
