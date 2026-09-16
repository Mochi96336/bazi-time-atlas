import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renderer = readFileSync(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8");
const hierarchy = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");

test("every sexagenary sector owns a static identity label", () => {
  assert.match(renderer, /sexagenary\.forEach\(\(label, index\) => \{[\s\S]*?const text = el\("text", \{[\s\S]*?data-cycle-index[\s\S]*?staticLabels\.set\(index, text\);/);
  assert.doesNotMatch(renderer, /if \(index % 5 === 0\) \{[\s\S]*?class:\s*"cycle-label"/);
  assert.match(renderer, /class:\s*`cycle-label\$\{index % 5 === 0 \? " major" : ""\}`/);
});

test("label thinning follows radial information capacity instead of renderer sampling", () => {
  assert.match(hierarchy, /#hour-track \.cycle-label:nth-of-type\(2n\),\s*#day-track \.cycle-label:nth-of-type\(2n\)\s*\{\s*display:\s*none;/s);
  assert.doesNotMatch(hierarchy, /#(?:month|year)-track \.cycle-label:nth-of-type/);
  assert.match(hierarchy, /#year-track \.cycle-label\.major/);
  assert.match(hierarchy, /#month-track \.cycle-label\.major/);
});
