import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analysisCss = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");
const legendCss = readFileSync(new URL("../mobile-legend.css", import.meta.url), "utf8");
const instrumentCss = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");

test("mobile Tools retires dashboard-era presets, transport and layer toggles", () => {
  assert.match(
    analysisCss,
    /@media \(max-width: 480px\)[\s\S]*?#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:first-child,[\s\S]*?#play-button\s*\{\s*display:\s*none\s*!important;/
  );
  assert.match(
    legendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend-row\[data-ring-toggle\],[\s\S]*?#kinetic-instrument\[data-analysis-open="true"\] \.reference-frame-control\s*\{\s*display:\s*none\s*!important;/
  );
});

test("ordinary mobile Tools entry is readable and shares the first action row", () => {
  assert.match(
    analysisCss,
    /@media \(max-width: 480px\)[\s\S]*?\.analysis-toggle,[\s\S]*?\.analysis-close\s*\{[\s\S]*?top:\s*10px;[\s\S]*?min-height:\s*32px;[\s\S]*?font-size:\s*9px;/
  );
});

test("ordinary mobile Now matches the Tools entry action row", () => {
  assert.match(
    instrumentCss,
    /@media \(max-width: 480px\)[\s\S]*?#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #now-button\s*\{[\s\S]*?min-height:\s*32px;[\s\S]*?font-size:\s*9px;[\s\S]*?line-height:\s*1;/
  );
});

test("mobile Tools keeps one primary row after retiring the reference-frame rail", () => {
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*flex-end;/
  );
  assert.match(
    legendCss,
    /\.ring-legend-row\[data-ring-toggle\],[\s\S]*?\.reference-frame-control\s*\{\s*display:\s*none\s*!important;/
  );
  assert.match(
    legendCss,
    /\.instrument-toolbar\s*\{\s*right:\s*56px;/
  );
  assert.match(
    legendCss,
    /\.analysis-close\s*\{[\s\S]*?top:\s*10px;[\s\S]*?right:\s*9px;[\s\S]*?min-height:\s*42px;/
  );
  assert.match(
    analysisCss,
    /\.toolbar-group:last-child \.control-button\s*\{[\s\S]*?min-height:\s*42px;[\s\S]*?font-size:\s*10px;/
  );
});

test("mobile Tools has one Selected Instant caption owner and larger invisible touch affordance", () => {
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] #cursor-layer \.cursor-note\s*\{\s*display:\s*none;/
  );
  assert.match(
    analysisCss,
    /\.analysis-toggle::before,[\s\S]*?\.analysis-close::before\s*\{[\s\S]*?inset:\s*-8px -6px;/
  );
});


test("mobile Tools exposes Solar Time as a first-row action instead of an automatic panel", () => {
  assert.match(
    analysisCss,
    /#solar-time-tool-button\[aria-pressed="true"\],[\s\S]*?#inverse-time-search-button\[aria-pressed="true"\][\s\S]*?box-shadow:\s*inset 0 -1px/
  );
  assert.match(
    analysisCss,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #solar-time-tool-button,[\s\S]*?display:\s*none\s*!important/
  );
});
