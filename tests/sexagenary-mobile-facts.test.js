import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, js, css] = await Promise.all([
  readFile(new URL("../sexagenary.html", import.meta.url), "utf8"),
  readFile(new URL("../src/sexagenary.js", import.meta.url), "utf8"),
  readFile(new URL("../sexagenary-refine.css", import.meta.url), "utf8")
]);

test("mobile facts keep only the stem and branch metadata missing from the wheel", () => {
  assert.match(html, /id="cycle-mobile-facts"/);
  assert.match(html, /id="mobile-stem-name"/);
  assert.match(html, /id="mobile-stem-meta"/);
  assert.match(html, /id="mobile-branch-name"/);
  assert.match(html, /id="mobile-branch-meta"/);
  assert.doesNotMatch(html, /id="mobile-cycle-title"/);
  assert.doesNotMatch(html, /id="mobile-cycle-ordinal"/);
});

test("selection updates the compact mobile facts from the same cycle item as desktop", () => {
  assert.match(js, /#mobile-stem-name/);
  assert.match(js, /#mobile-stem-meta/);
  assert.match(js, /#mobile-branch-name/);
  assert.match(js, /#mobile-branch-meta/);
  assert.match(js, /item\.stem\.yinYang/);
  assert.match(js, /item\.branch\.yinYang/);
  assert.match(js, /item\.stemIndex \+ 1/);
  assert.match(js, /item\.branchIndex \+ 1/);
});

test("facts are mobile-only instead of duplicating the desktop inspector", () => {
  assert.match(css, /\.cycle-mobile-facts\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.cycle-mobile-facts\s*\{[\s\S]*display:\s*grid/);
});
