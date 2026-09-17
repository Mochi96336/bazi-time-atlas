import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../analysis-first-screen-polish.css", import.meta.url), "utf8");
const analysisMode = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");
const classificationCss = readFileSync(new URL("../classification-overlay.css", import.meta.url), "utf8");

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
  assert.doesNotMatch(css, /\.atlas-visible-ten-gods\s*\{[^}]*box-shadow:\s*0\s+\d/s);
  assert.doesNotMatch(css, /\.atlas-visible-ten-gods\s*\{[^}]*display:\s*none;/s);
});

test("classification evidence is recessed instead of floating as a dashboard card", () => {
  assert.match(classificationCss, /\.classification-keys i\s*\{/,
    "contract must target the real classification key nodes");
  assert.match(classificationCss, /\.classification-current\s*\{/,
    "contract must target the real classification summary");
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\]\[data-classification-overlay="on"\] \.classification-overlay-legend\s*\{[\s\S]*?top:\s*72px;[\s\S]*?border:\s*0;[\s\S]*?border-left:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*var\(--m2-recessed-rail-gradient\);[\s\S]*?backdrop-filter:\s*none;[\s\S]*?box-shadow:\s*var\(--m2-recessed-side-shadow\);/
  );
  assert.match(
    css,
    /\.classification-keys i\s*\{[\s\S]*?min-width:\s*15px;[\s\S]*?width:\s*15px;[\s\S]*?height:\s*15px;[\s\S]*?border-radius:\s*2px;/
  );
  assert.match(css, /\.classification-current\s*\{[\s\S]*?font-size:\s*6\.5px;/);
  assert.match(css, /\.classification-warning\s*\{[\s\S]*?font-size:\s*6px;/);
  assert.doesNotMatch(css, /\.classification-overlay-legend\s*\{[^}]*display:\s*none;/s);
});

test("second-pass polish remains desktop-only", () => {
  assert.doesNotMatch(css, /@media \(max-width:/);
});
