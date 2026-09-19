import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analysis = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");
const findTime = readFileSync(new URL("../src/inverse-time-search-view.js", import.meta.url), "utf8");

test("closing Tools preserves user observation settings instead of silently resetting them", () => {
  assert.doesNotMatch(analysis, /resetAnalysisLenses/);
  assert.doesNotMatch(analysis, /reset:\s*true/);
  assert.doesNotMatch(analysis, /reference\.value = "world"/);
  assert.doesNotMatch(analysis, /classification.*click\(\)/s);
  assert.match(analysis, /activate\(closeControl, \(\) => setAnalysisOpen\(false\)\)/);
  assert.match(findTime, /收起工具；目前設定會保留/);
});

test("Tools close dismisses transient tasks without resetting persistent lenses", () => {
  assert.match(
    analysis,
    /if \(!nextOpen && wasOpen\)[\s\S]*instrument\.dispatchEvent\(new CustomEvent\("atlas-tools-closing"/
  );
  assert.match(findTime, /instrument\.addEventListener\("atlas-tools-closing", \(\) => exitMode\(\)\)/);
});

test("Tools Escape is the final back-stack layer only", () => {
  assert.match(analysis, /if \(event\.defaultPrevented\) return;/);
  assert.match(analysis, /data(?:set)?\.inverseTimeSearch|instrument\.dataset\.inverseTimeSearch === "active"/);
  assert.match(analysis, /instrument\.dataset\.ganzhiInspectorOpen === "true"/);
  assert.match(analysis, /event\.preventDefault\(\);[\s\S]*setAnalysisOpen\(false\)/);
});
