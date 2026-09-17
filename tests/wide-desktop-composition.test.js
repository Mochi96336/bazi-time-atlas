import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const polish = readFileSync(new URL("../analysis-first-screen-polish.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const fixture = readFileSync(new URL("../scripts/fixtures/wide-desktop-2047.html", import.meta.url), "utf8");
const browserGate = readFileSync(new URL("../scripts/check-wide-desktop-composition.mjs", import.meta.url), "utf8");
const visualCapture = readFileSync(new URL("../scripts/visual-check-wide-desktop.mjs", import.meta.url), "utf8");

test("wide desktop budgets the whole first screen instead of clipping the read-head", () => {
  assert.match(polish, /height:\s*max\(720px,\s*calc\(100dvh - 92px\)\)/);
  assert.match(polish, /@media \(min-width: 1800px\) and \(min-aspect-ratio: 17\/9\)/);
  assert.match(polish, /height:\s*clamp\(760px,\s*calc\(100dvh - 92px\),\s*44vw\)/);
  assert.match(polish, /\.instrument-readout\s*\{\s*bottom:\s*26px;/s);
});

test("wide Analysis rails have explicit readable type floors without adding new controls", () => {
  assert.match(polish, /@media \(min-width: 1600px\)/);
  assert.match(polish, /\.instrument-toolbar \.control-button,[\s\S]*?font-size:\s*10px;/);
  assert.match(polish, /\.ring-legend-row span\s*\{\s*font-size:\s*9px;/s);
  assert.match(polish, /\.atlas-visible-ten-gods-cell strong\s*\{\s*font-size:\s*10\.5px;/s);
  assert.match(polish, /\.analysis-close\s*\{[\s\S]*?font-size:\s*9px;/);
  assert.doesNotMatch(polish, /content:\s*["'][^"']*(?:tool|mode|preset|range|播放|區間)[^"']*["']/i);
});

test("Visual gate owns a real 2047x1038 browser probe and PNG evidence", () => {
  assert.match(fixture, /width:\s*2047px/);
  assert.match(fixture, /height:\s*1038px/);
  assert.match(fixture, /data-ready="false"/);
  assert.match(browserGate, /width !== 2047 \|\| height !== 1038/);
  assert.match(browserGate, /instrumentShare < 0\.80 \|\| instrumentShare > 0\.90/);
  assert.match(browserGate, /readoutBottomGap < 40/);
  assert.match(browserGate, /scrollWidth > width \+ 1/);
  assert.match(visualCapture, /annual-wide-2047x1038\.png/);
  assert.match(visualCapture, /annual-tools-wide-2047x1038\.png/);
  assert.match(packageJson.scripts["visual:check"], /check-wide-desktop-composition\.mjs/);
  assert.match(packageJson.scripts["visual:check"], /visual-check-wide-desktop\.mjs/);
});
