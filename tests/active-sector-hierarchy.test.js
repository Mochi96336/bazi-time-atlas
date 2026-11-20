import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cssSource } from "./helpers/css-source.js";

const radial = cssSource("radial-hierarchy.css");
const classification = cssSource("classification-overlay.css");

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
    /#kinetic-instrument\[data-classification-overlay="on"\] \.cycle-sector\[data-stem-element="木"\][^\{]*\{[^}]*--stem-color:\s*var\(--five-wood\)/
  );
  assert.match(
    classification,
    /#kinetic-instrument\[data-classification-overlay="on"\] \.cycle-sector\[data-stem-element\]\.is-active\s*\{[^}]*stroke:\s*var\(--branch-color\);[^}]*stroke-width:\s*2\.2;/
  );
  assert.doesNotMatch(
    radial,
    /#(?:hour|day|month|year)-track \.cycle-sector\.is-active\s*\{\s*fill:\s*color-mix\(in srgb, currentColor (?:38|54|62)%/
  );
});
