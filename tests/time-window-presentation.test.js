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

test("mobile Tools removes observation-window and transport chrome from the product rail", () => {
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:first-child,[\s\S]*?#play-button\s*\{\s*display:\s*none\s*!important;/
  );
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:last-child\s*\{[\s\S]*?margin:\s*0 0 0 auto;[\s\S]*?gap:\s*4px;/
  );
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:last-child \.control-button\s*\{[\s\S]*?min-height:\s*42px;[\s\S]*?font-size:\s*10px;/
  );
});
