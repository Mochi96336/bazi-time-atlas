import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hierarchy = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const atlas = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
const classification = readFileSync(new URL("../classification-overlay.css", import.meta.url), "utf8");

test("resting wheel color encodes semantic families instead of five unrelated categories", () => {
  assert.match(hierarchy, /--hour:\s*#6f8983;/);
  assert.match(hierarchy, /--day:\s*#78928b;/);
  assert.match(hierarchy, /--month:\s*#859e96;/);
  assert.match(hierarchy, /--year:\s*#96aaa2;/);
  assert.match(hierarchy, /--solar:\s*#c6a36f;/);
  assert.match(hierarchy, /--zodiac:\s*#9089a7;/);

  for (const ring of ["hour", "day", "month", "year"]) {
    assert.match(hierarchy, new RegExp(`#${ring}-track \\.${ring}-sector \\{ fill: color-mix\\(in srgb, var\\(--${ring}\\)`));
  }
});

test("annual coordinate colors are token-owned and do not reintroduce literal legacy orange or violet", () => {
  assert.match(hierarchy, /#solar-track \.term-sector \{[\s\S]*?var\(--solar\)/);
  assert.match(hierarchy, /#zodiac-track \.zodiac-sector \{[\s\S]*?var\(--zodiac\)/);
  assert.match(hierarchy, /#solar-track \.term-label[\s\S]*?var\(--solar\)/);
  assert.match(hierarchy, /#zodiac-track \.zodiac-label[\s\S]*?var\(--zodiac\)/);
  assert.doesNotMatch(hierarchy, /rgba\(213,163,109/);
  assert.doesNotMatch(hierarchy, /rgba\(153,139,180/);
});

test("year hierarchy no longer borrows the warm Solar or Selected-Instant channel", () => {
  assert.doesNotMatch(hierarchy, /#fff2c9/);
  assert.doesNotMatch(hierarchy, /rgba\(244,236,207/);
  assert.match(hierarchy, /#year-track \.active-cycle-label \{[\s\S]*?fill:\s*#f0f6f2;/);
  assert.match(hierarchy, /#year-track \.ring-tick\.major \{ stroke: rgba\(231,239,234,.52\);/);
  assert.match(atlas, /--cursor:\s*#f4e6b7;/);
});

test("categorical multicolor remains opt-in analysis rather than resting clock identity", () => {
  assert.match(classification, /data-classification-overlay="on"\] \.cycle-sector\[data-stem-element=/);
  assert.match(classification, /data-classification-overlay="on"\] \.zodiac-sector\[data-zodiac-element=/);
  assert.match(classification, /--five-wood:/);
  assert.match(classification, /--five-fire:/);
  assert.match(classification, /--five-earth:/);
  assert.match(classification, /--five-metal:/);
  assert.match(classification, /--five-water:/);
});
