import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const capture = readFileSync(new URL("../scripts/visual-check-scale-windows.mjs", import.meta.url), "utf8");
const fixture = readFileSync(new URL("../scripts/fixtures/scale-window.html", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("visual evidence covers every time-window focus at desktop and true mobile size", () => {
  assert.match(capture, /\{ key:"48h", value:"day" \}/);
  assert.match(capture, /\{ key:"year", value:"year" \}/);
  assert.match(capture, /\{ key:"60y", value:"cycle" \}/);
  assert.match(capture, /\{ key:"1440x900", width:1440, height:900 \}/);
  assert.match(capture, /\{ key:"390x844", width:390, height:844 \}/);
  assert.match(capture, /mobile-390\.html/);
  assert.match(capture, /annual-scale-\$\{scale\.key\}-\$\{viewport\.key\}\.png/);
});

test("scale-window fixture compares all modes at one immutable Selected Instant", () => {
  assert.match(fixture, /2024-06-15T04:00:00\.000Z/);
  assert.match(fixture, /new Set\(\["day", "year", "cycle"\]\)/);
  assert.match(fixture, /\.scale-button\[data-scale=/);
  assert.match(fixture, /button\.click\(\)/);
  assert.match(fixture, /instrument\.dataset\.scaleWindow !== scale/);
  assert.match(fixture, /selectedMs !== Date\.parse\(FIXED_INSTANT\)/);
});

test("normal visual check always emits the scale-window evidence set", () => {
  assert.match(pkg.scripts["visual:check"], /visual-check\.mjs/);
  assert.match(pkg.scripts["visual:check"], /visual-check-scale-windows\.mjs/);
});
