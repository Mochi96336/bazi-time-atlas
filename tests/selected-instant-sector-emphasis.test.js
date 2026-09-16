import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hierarchy = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");

test("Ganzhi active sectors stay subordinate to the Selected Instant read-head", () => {
  assert.match(
    hierarchy,
    /#hour-track \.cycle-sector\.is-active,[\s\S]*?#year-track \.cycle-sector\.is-active\s*\{\s*stroke:\s*none;\s*\}/
  );

  assert.match(hierarchy, /#hour-track \.cycle-sector\.is-active\s*\{\s*fill:\s*color-mix\(in srgb, currentColor 24%, transparent\);\s*\}/);
  assert.match(hierarchy, /#day-track \.cycle-sector\.is-active\s*\{\s*fill:\s*color-mix\(in srgb, currentColor 28%, transparent\);\s*\}/);
  assert.match(hierarchy, /#month-track \.cycle-sector\.is-active\s*\{\s*fill:\s*color-mix\(in srgb, currentColor 38%, transparent\);\s*\}/);
  assert.match(hierarchy, /#year-track \.cycle-sector\.is-active\s*\{\s*fill:\s*color-mix\(in srgb, currentColor 48%, transparent\);\s*\}/);

  assert.doesNotMatch(hierarchy, /#month-track \.cycle-sector\.is-active\s*\{[^}]*currentColor 58%/s);
  assert.doesNotMatch(hierarchy, /#year-track \.cycle-sector\.is-active\s*\{[^}]*currentColor 66%/s);
  assert.doesNotMatch(
    hierarchy,
    /#hour-track \.cycle-sector\.is-active,[\s\S]*?#year-track \.cycle-sector\.is-active\s*\{[^}]*var\(--cursor\)/s
  );
});
