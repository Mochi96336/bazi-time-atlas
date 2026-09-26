import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const radial = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const scale = readFileSync(new URL("../scale-emphasis.css", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8");

test("selected Zodiac datum uses an ink floor rather than inheriting muted context", () => {
  assert.match(radial, /#zodiac-track \.zodiac-label\s*\{[^}]*var\(--zodiac\) 57%, var\(--muted\)[^}]*font-size:\s*10\.5px;/s);
  assert.match(radial, /#kinetic-instrument:not\(\[data-classification-overlay="on"\]\) #zodiac-track \.active-cycle-label\s*\{[^}]*var\(--zodiac\) 42%, var\(--ink\)[^}]*font-size:\s*11\.25px;[^}]*font-weight:\s*780;/s);
  assert.match(renderer, /class:\s*"zodiac-label active-cycle-label active-annual-label"/);
});

test("Zodiac still recedes as derived annual context, not an extra luminous primary ring", () => {
  assert.match(radial, /#zodiac-track \.zodiac-sector\s*\{[^}]*var\(--zodiac\) 4\.5%, transparent\)/s);
  assert.match(radial, /#zodiac-track \.zodiac-sector\.is-active\s*\{[^}]*var\(--zodiac\) 12%, transparent\)/s);
  assert.match(scale, /#zodiac-track \.zodiac-label:not\(\.active-cycle-label\)[\s\S]*?opacity:\s*var\(--scale-context-opacity\);/);
  assert.match(scale, /#zodiac-track \.active-cycle-label\s*\{[^}]*opacity:\s*1;/);
  const selected = radial.match(/#kinetic-instrument:not\(\[data-classification-overlay="on"\]\) #zodiac-track \.active-cycle-label\s*\{([^}]*)\}/)?.[1];
  assert.ok(selected);
  assert.doesNotMatch(selected, /filter|shadow|glow|background|stroke:/i);
});
