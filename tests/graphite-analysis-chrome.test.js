import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");

test("analysis chrome stays neutral under Graphite M2", () => {
  for (const legacy of [
    "#8f9992",
    "rgba(15,19,16,.54)",
    "#c5d3ca",
    "rgba(199,217,205,.18)",
    "rgba(199,217,205,.055)",
    "rgba(238,242,237,.24)",
    "#0b0f0c",
    "rgba(199,217,205,.22)",
    "rgba(199,217,205,.035)",
    "#9eaaa2"
  ]) {
    assert.doesNotMatch(css, new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.match(css, /\.analysis-toggle,[\s\S]*?color:\s*#909596;[\s\S]*?background:\s*rgba\(15,17,18,\.54\);/);
  assert.match(css, /\.analysis-close \{[\s\S]*?color:\s*#c8cccb;[\s\S]*?rgba\(200,204,203,\.18\);/);
  assert.match(css, /data-analysis-open="true"\] \{[\s\S]*?border-color:\s*rgba\(200,204,203,\.22\);/);
});

test("direct ring identity fallbacks mirror the production M2 semantic tokens", () => {
  assert.match(css, /var\(--year, #93999b\)/);
  assert.match(css, /var\(--month, #777e81\)/);
  assert.match(css, /var\(--solar, #bc9257\)/);
  assert.match(css, /var\(--day, #62696c\)/);
  assert.match(css, /var\(--hour, #52585b\)/);
  assert.match(css, /text-shadow:\s*0 0 3px #090a0b/);
});
