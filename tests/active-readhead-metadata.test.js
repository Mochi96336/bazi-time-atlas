import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const renderer = readFileSync(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8");

function bodyBetween(start, end) {
  const startIndex = renderer.indexOf(start);
  const endIndex = renderer.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return renderer.slice(startIndex, endIndex);
}

test("cycle read-head keeps coordinate updates outside stable metadata gates", () => {
  const body = bodyBetween("function updateActiveCycleLabel", "function updateActiveAnnualLabel");
  assert.match(body, /const indexChanged = previousIndex !== activeIndex;/);
  assert.match(body, /if \(indexChanged\) \{\s*node\.setAttribute\("data-cycle-index", String\(activeIndex\)\);\s*node\.setAttribute\("data-cycle-label", label\);\s*\}\s*node\.setAttribute\("data-cycle-coordinate", coordinate\.toFixed\(6\)\);\s*if \(indexChanged\) \{\s*node\.setAttribute\("visibility", "visible"\);\s*node\.textContent = label;\s*staticLabels\?\.get\(activeIndex\)\?\.classList\.add\("is-active-shadowed"\);\s*lastActiveCycleIndex\.set\(id, activeIndex\);\s*\}/s);
});

test("annual read-head keeps coordinate updates outside stable metadata gates", () => {
  const body = bodyBetween("function updateActiveAnnualLabel", "function renderSolarRing");
  assert.match(body, /const indexChanged = previousIndex !== activeIndex;/);
  assert.match(body, /if \(indexChanged\) \{\s*node\.setAttribute\("data-annual-index", String\(activeIndex\)\);\s*node\.setAttribute\("data-annual-label", label\);\s*\}\s*node\.setAttribute\("data-annual-coordinate", coordinate\.toFixed\(6\)\);\s*if \(indexChanged\) \{\s*node\.setAttribute\("visibility", "visible"\);\s*node\.textContent = label;\s*staticLabels\[activeIndex\]\?\.setAttribute\("visibility", "hidden"\);\s*lastActiveAnnualIndex\.set\(kind, activeIndex\);\s*\}/s);
});
