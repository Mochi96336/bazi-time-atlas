import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const radial = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const classification = readFileSync(new URL("../classification-overlay.css", import.meta.url), "utf8");

test("graphite active sectors remain subordinate to the Selected Instant datum", () => {
  assert.match(radial, /data-classification-overlay="on"\]\) #hour-track \.cycle-sector\.is-active,[\s\S]*?#day-track \.cycle-sector\.is-active\s*\{[^}]*currentColor 20%/);
  assert.match(radial, /data-classification-overlay="on"\]\) #month-track \.cycle-sector\.is-active\s*\{[^}]*currentColor 26%/);
  assert.match(radial, /data-classification-overlay="on"\]\) #year-track \.cycle-sector\.is-active\s*\{[^}]*currentColor 30%/);

  assert.match(radial, /#cursor-layer \.cursor-line\s*\{[\s\S]*?opacity:\s*\.90;/);
  assert.match(radial, /#year-track \.active-cycle-label\s*\{[\s\S]*?fill:\s*#f2f3f2;/);
});

test("classification keeps independent categorical sector authority", () => {
  assert.match(
    classification,
    /#kinetic-instrument\[data-classification-overlay="on"\] \.cycle-sector\[data-stem-element="木"\][^\{]*\{[^}]*var\(--five-wood\) 34%/
  );
  assert.match(
    classification,
    /#kinetic-instrument\[data-classification-overlay="on"\] \.cycle-sector\.is-active\s*\{[^}]*stroke-width:\s*2\.2;[^}]*filter:\s*brightness\(1\.2\);/
  );
  assert.doesNotMatch(
    radial,
    /#(?:hour|day|month|year)-track \.cycle-sector\.is-active\s*\{\s*fill:\s*color-mix\(in srgb, currentColor (?:38|54|62)%/
  );
});
