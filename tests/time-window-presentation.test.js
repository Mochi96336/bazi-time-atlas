import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const scaleCss = readFileSync(new URL("../scale-emphasis.css", import.meta.url), "utf8");
const analysisCss = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");

test("observation-window semantics have one visible toolbar label", () => {
  assert.match(scaleCss, /\.instrument-toolbar\s*>\s*\.toolbar-group:first-child::before\s*\{[\s\S]*?content:\s*"觀察時間窗";/);
  assert.match(scaleCss, /\.instrument-toolbar\s*>\s*\.toolbar-group:first-child::after\s*\{[\s\S]*?width:\s*1px;/);
});

test("mobile time-window controls stay on one row without changing their labels", () => {
  assert.match(scaleCss, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.instrument-toolbar \.control-button,[\s\S]*?\.instrument-toolbar \.scale-button\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(scaleCss, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.instrument-toolbar \.scale-button\s*\{[\s\S]*?padding-inline:\s*6px;/);
});

test("mobile Analysis compacts five actions horizontally rather than wrapping them", () => {
  assert.match(analysisCss, /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:last-child\s*\{[\s\S]*?gap:\s*3px;/);
  assert.match(analysisCss, /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:last-child \.control-button\s*\{[\s\S]*?padding-inline:\s*5px;[\s\S]*?font-size:\s*8px;/);
  assert.match(analysisCss, /#kinetic-instrument\[data-analysis-open="true"\] #play-button\s*\{[\s\S]*?min-width:\s*42px;/);
});
