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

test("desktop keeps complete Day and Hour identities while compact cameras may thin presentation", () => {
  const compact = hierarchy.match(/@media \(max-width:\s*920px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(compact, "fast-ring thinning must be owned by the compact camera breakpoint");
  assert.match(
    compact[1],
    /#hour-track \.cycle-label:nth-of-type\(2n\),\s*#day-track \.cycle-label:nth-of-type\(2n\)\s*\{\s*display:\s*none;/s
  );

  const beforeCompact = hierarchy.slice(0, hierarchy.indexOf(compact[0]));
  assert.doesNotMatch(
    beforeCompact,
    /#hour-track \.cycle-label:nth-of-type\(2n\),\s*#day-track \.cycle-label:nth-of-type\(2n\)\s*\{\s*display:\s*none;/s,
    "desktop must not globally hide alternating Day / Hour identities"
  );
  assert.doesNotMatch(hierarchy, /#(?:month|year)-track \.cycle-label:nth-of-type/);
  assert.match(hierarchy, /#year-track \.cycle-label\.major/);
  assert.match(hierarchy, /#month-track \.cycle-label\.major/);
});
