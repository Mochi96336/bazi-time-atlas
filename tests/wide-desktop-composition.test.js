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

test("wide Analysis readability pass strengthens chrome and fast-ring context without changing geometry", () => {
  assert.match(
    polish,
    /\.instrument-toolbar \.control-button,[\s\S]*?min-height:\s*32px;[\s\S]*?color:\s*#989d9d;[\s\S]*?font-size:\s*11px;/
  );
  assert.match(polish, /\.ring-legend\s*\{[\s\S]*?top:\s*46px;[\s\S]*?max-width:\s*1040px;[\s\S]*?gap:\s*10px 18px;/);
  assert.match(polish, /\.reference-frame-control select\s*\{[\s\S]*?min-height:\s*26px;[\s\S]*?font-size:\s*10px;/);
  assert.match(polish, /\.ring-legend-row span\s*\{[\s\S]*?color:\s*#999e9e;[\s\S]*?font-size:\s*10px;/);
  assert.match(polish, /\.analysis-close\s*\{[\s\S]*?top:\s*46px;[\s\S]*?font-size:\s*10px;/);
  assert.match(polish, /data-scale-window="year"\] #day-track\s*\{\s*--scale-context-opacity:\s*\.72;/s);
  assert.match(polish, /data-scale-window="year"\] #hour-track\s*\{\s*--scale-context-opacity:\s*\.68;/s);
  assert.match(polish, /#hour-track \.cycle-label:not\(\.active-cycle-label\)\s*\{[\s\S]*?fill:\s*rgba\(196,202,201,\.46\);[\s\S]*?font-size:\s*9px;/);
  assert.match(polish, /#day-track \.cycle-label:not\(\.active-cycle-label\)\s*\{[\s\S]*?fill:\s*rgba\(207,212,210,\.52\);[\s\S]*?font-size:\s*9\.5px;/);
  assert.doesNotMatch(polish, /(?:width|height|viewBox|transform):\s*[^;]*(?:wheel|track)/i);
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
