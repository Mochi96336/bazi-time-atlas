import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const birthSource = readFileSync(new URL("../src/birth.js", import.meta.url), "utf8");
const adapterSource = readFileSync(new URL("../src/birth-atlas-cross-view.js", import.meta.url), "utf8");

test("Birth renderer does not emit legacy cross-view URLs", () => {
  assert.doesNotMatch(birthSource, /sexagenary\.html\?ganzhi=/);
  assert.doesNotMatch(birthSource, /annualProjectionLink\.href\s*=/);
  assert.doesNotMatch(birthSource, /summaryCells\[[^\]]+\]\.dataset\.href\s*=/);
  assert.doesNotMatch(birthSource, /[?&]lambda=/);
  assert.doesNotMatch(birthSource, /[?&]yearStem=/);
});

test("Birth Atlas adapter remains the sole cross-view URL writer", () => {
  assert.match(adapterSource, /import\s+\{\s*birthAtlasLink\s*\}/);
  assert.match(adapterSource, /birthAtlasLink\(\{\s*\.\.\.common,\s*inspect:\s*key\s*\}\)/);
  assert.match(adapterSource, /cell\.dataset\.href\s*=\s*href/);
  assert.match(adapterSource, /atlasHref\s*=\s*birthAtlasLink\(common\)/);
  assert.match(adapterSource, /annualLink\.href\s*=\s*atlasHref/);
});
