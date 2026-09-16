import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [renderer, hierarchy] = await Promise.all([
  readFile(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8"),
  readFile(new URL("../radial-hierarchy.css", import.meta.url), "utf8")
]);

test("renderer creates a static label for every sexagenary state", () => {
  assert.match(renderer, /const isMajor = index % 5 === 0;/);
  assert.match(
    renderer,
    /class: `cycle-label \$\{isMajor \? "major-cycle-label" : "minor-cycle-label"\}`/
  );
  assert.match(renderer, /staticLabels\.set\(index, text\);/);
  assert.doesNotMatch(renderer, /if \(index % 5 === 0\) \{[\s\S]*?class: "cycle-label"/);
});

test("minor labels remain visible instead of being removed by cadence selectors", () => {
  assert.doesNotMatch(hierarchy, /cycle-label:nth-of-type\([^)]*\)\s*\{\s*display:\s*none/);
  for (const ring of ["hour", "day", "month", "year"]) {
    assert.match(
      hierarchy,
      new RegExp(`#${ring}-track \\.minor-cycle-label \\{[\\s\\S]*?fill:`),
      `${ring} must give minor labels a visible ink role`
    );
  }
});

test("active read-head still suppresses the matching static label", () => {
  assert.match(hierarchy, /\.cycle-label\.is-active-shadowed\s*\{\s*visibility:\s*hidden;/);
  assert.match(renderer, /staticLabels\?\.get\(activeIndex\)\?\.classList\.add\("is-active-shadowed"\);/);
});
