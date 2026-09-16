import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const scaleCss = readFileSync(new URL("../scale-emphasis.css", import.meta.url), "utf8");
const analysisCss = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");

test("ordinary observation-window lenses do not grow a duplicate visible heading", () => {
  assert.doesNotMatch(
    scaleCss,
    /\.instrument-toolbar\s*>\s*\.toolbar-group:first-child::before\s*\{[\s\S]*?content:\s*"觀察時間窗";/
  );
});

test("mobile Analysis compacts its legitimate actions without changing ownership", () => {
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:last-child\s*\{[\s\S]*?gap:\s*3px;/
  );
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:last-child \.control-button\s*\{[\s\S]*?padding-inline:\s*5px;[\s\S]*?font-size:\s*8px;/
  );
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] #play-button\s*\{[\s\S]*?min-width:\s*42px;/
  );
});
