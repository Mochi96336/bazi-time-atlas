import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renderer = readFileSync(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8");
const hierarchy = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const atlas = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
const classification = readFileSync(new URL("../classification-overlay.css", import.meta.url), "utf8");

test("wheel sectors tile their coordinates without artificial angular gutters", () => {
  assert.match(renderer, /const start = index \* 6;\s*\n\s*const end = \(index \+ 1\) \* 6;/);
  assert.match(renderer, /RADII\.solarTermOuter,\s*\n\s*term\.longitude,\s*\n\s*term\.longitude \+ 15/s);
  assert.match(renderer, /model\.outerRadius,\s*\n\s*sign\.start,\s*\n\s*sign\.end/s);

  assert.doesNotMatch(renderer, /index \* 6 \+ \.18/);
  assert.doesNotMatch(renderer, /\(index \+ 1\) \* 6 - \.18/);
  assert.doesNotMatch(renderer, /term\.longitude \+ \.15/);
  assert.doesNotMatch(renderer, /term\.longitude \+ 15 - \.15/);
  assert.doesNotMatch(renderer, /sign\.start \+ \.15/);
  assert.doesNotMatch(renderer, /sign\.end - \.15/);
});

test("sixty-step structure uses short minor ticks and longer five-step anchors", () => {
  assert.match(renderer, /const tickLength = index % 5 === 0 \? 14 : 5;/);
  assert.match(renderer, /model\.outerRadius - tickLength/);

  for (const ring of ["hour", "day", "month", "year"]) {
    assert.match(hierarchy, new RegExp(`#${ring}-track \\.ring-tick \\{ stroke: rgba\\(`));
    assert.match(hierarchy, new RegExp(`#${ring}-track \\.ring-tick\\.major \\{ stroke: rgba\\(`));
  }
});

test("resting surfaces are borderless while active and classification evidence retain borders", () => {
  assert.match(hierarchy, /\.cycle-sector:not\(\.is-active\) \{ stroke: none; \}/);
  assert.match(hierarchy, /#solar-track \.term-sector \{[\s\S]*?stroke: none;/);
  assert.match(hierarchy, /#zodiac-track \.zodiac-sector \{[\s\S]*?stroke: none;/);
  assert.match(hierarchy, /#solar-track \.term-sector\.is-active \{[\s\S]*?stroke: rgba\(/);
  assert.match(hierarchy, /#zodiac-track \.zodiac-sector\.is-active \{[\s\S]*?stroke: rgba\(/);

  // The base stylesheet still owns a singular active Ganzhi outline.
  assert.match(atlas, /\.cycle-sector\.is-active \{[^}]*stroke: rgba\(/s);

  // Dense categorical borders remain opt-in instead of becoming resting grid ink.
  assert.match(classification, /data-classification-overlay="on"\] \.cycle-sector\[data-branch-element=/);
  assert.match(classification, /data-classification-overlay="on"\] \.zodiac-sector\[data-zodiac-modality=/);
});

test("solar hover does not resurrect every annual sector border", () => {
  const hoverRule = hierarchy.match(/#kinetic-wheel\[data-hover-ring="solar"\][\s\S]*?\{([^}]*)\}/)?.[1] ?? "";
  assert.match(hoverRule, /filter:\s*brightness\(1\.16\);/);
  assert.doesNotMatch(hoverRule, /stroke\s*:/);
});
