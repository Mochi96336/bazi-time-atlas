import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8");

test("active read-head glyphs start at the exact datum anchor instead of straddling it", () => {
  const rule = css.match(/\.active-cycle-label\s*\{([^}]*)\}/s);
  assert.ok(rule, "shared active read-head rule must exist");
  assert.match(rule[1], /text-anchor:\s*start;/);
  assert.doesNotMatch(rule[1], /text-anchor:\s*middle;/);
});

test("annual read-heads keep using the shared clearance rule", () => {
  assert.match(renderer, /class:\s*`active-annual-label active-cycle-label active-annual-\$\{kind\}`/);
});
