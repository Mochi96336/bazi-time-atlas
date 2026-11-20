import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cssSource } from "./helpers/css-source.js";

const css = cssSource("analysis-first-screen-polish.css");
const analysisMode = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");

test("desktop Analysis installs the final polish after visible-ten-gods ownership", () => {
  const visible = analysisMode.indexOf("installAtlasVisibleTenGods(instrument);");
  const polish = analysisMode.indexOf("installAnalysisFirstScreenPolishStyles();");
  assert.ok(visible >= 0 && polish > visible, "polish stylesheet must be installed after the visible-ten-gods stylesheet");
  assert.match(analysisMode, /stylesheet\.href = "\.\/analysis-first-screen-polish\.css";/);
  assert.match(analysisMode, /stylesheet\.dataset\.analysisFirstScreenPolish = "1";/);
});

test("visible-stems evidence is a compact recessed desktop rail rather than another card", () => {
  assert.match(css, /@media \(min-width: 821px\)/);
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.atlas-visible-ten-gods\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*72px;[\s\S]*?border:\s*0;[\s\S]*?border-top:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*var\(--m2-recessed-rail-gradient\);[\s\S]*?box-shadow:\s*var\(--m2-recessed-rail-shadow\);[\s\S]*?backdrop-filter:\s*none;/
  );
  assert.match(
    css,
    /\.atlas-visible-ten-gods-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(58px,\s*1fr\)\);[\s\S]*?border:\s*0;/
  );
  assert.match(css, /\.atlas-visible-ten-gods-head small\s*\{\s*display:\s*none;/);
  assert.match(
    css,
    /\.atlas-visible-ten-gods-cell:not\(:first-child\)\s*\{[\s\S]*?border-left:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?box-shadow:\s*inset 1px 0 0 var\(--m2-etched-light-soft\);/
  );
  assert.doesNotMatch(
    css,
    /\.atlas-visible-ten-gods-cell\s*\{[^}]*border-left:\s*1px solid rgba\(236,239,239,\.065\);/s
  );
  assert.doesNotMatch(css, /\.atlas-visible-ten-gods\s*\{[^}]*box-shadow:\s*0\s+\d/s);
  assert.doesNotMatch(css, /\.atlas-visible-ten-gods\s*\{[^}]*display:\s*none;/s);
});


test("second-pass polish remains desktop-only", () => {
  assert.doesNotMatch(css, /@media \(max-width:/);
});
