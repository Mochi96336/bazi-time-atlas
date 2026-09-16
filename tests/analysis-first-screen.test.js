import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../analysis-first-screen.css", import.meta.url), "utf8");
const analysisMode = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");

test("analysis mode installs the dedicated first-screen presentation layer", () => {
  assert.match(analysisMode, /stylesheet\.href = "\.\/analysis-first-screen\.css";/);
  assert.match(analysisMode, /stylesheet\.dataset\.analysisFirstScreen = "1";/);
  assert.match(analysisMode, /installAnalysisFirstScreenStyles\(\);/);
});

test("desktop Analysis controls are flattened into instrument chrome", () => {
  assert.match(css, /@media \(min-width: 821px\)/);
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.control-button,[\s\S]*?\.scale-button\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/
  );
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.scale-button\.active,[\s\S]*?#play-button\[aria-pressed="true"\]\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*inset 0 -1px/
  );
});

test("desktop Analysis layer controls become one flat secondary rail", () => {
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend\s*\{[\s\S]*?top:\s*45px;[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;/
  );
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend-row\[data-ring-toggle\]\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/
  );
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend-row strong\s*\{\s*display:\s*none;/
  );
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.reference-frame-control select\s*\{[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;/
  );
});

test("Analysis has one Selected Instant owner instead of a duplicate cursor caption", () => {
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] #cursor-layer \.cursor-note\s*\{\s*display:\s*none;/
  );
});

test("desktop Analysis timeline remains a quiet scrub rail", () => {
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] ~ \.timeline-dock\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-top:\s*1px solid rgba\(236,239,239,\.08\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?opacity:\s*\.64;/
  );
  assert.match(
    css,
    /~ \.timeline-dock \.instant-field input\s*\{[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/
  );
});

test("desktop Analysis state summary is inline instead of five dashboard cards", () => {
  assert.match(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] ~ \.state-strip\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*center;[\s\S]*?flex-wrap:\s*wrap;/
  );
  assert.match(
    css,
    /~ \.state-strip \.state-cell\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?border-top:\s*0;[\s\S]*?background:\s*transparent;/
  );
  assert.match(css, /~ \.state-strip \.state-cell small\s*\{\s*display:\s*none;/);
});

test("the de-dashboard pass leaves mobile ownership untouched", () => {
  assert.doesNotMatch(css, /@media \(max-width:\s*480px\)/);
  assert.doesNotMatch(css, /@media \(max-width:\s*820px\)/);
});
