import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analysisCss = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");
const legendCss = readFileSync(new URL("../mobile-legend.css", import.meta.url), "utf8");

test("mobile Tools retires dashboard-era presets, transport and layer toggles", () => {
  assert.match(
    analysisCss,
    /@media \(max-width: 480px\)[\s\S]*?#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar > \.toolbar-group:first-child,[\s\S]*?#play-button\s*\{\s*display:\s*none\s*!important;/
  );
  assert.match(
    legendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend-row\[data-ring-toggle\]\s*\{\s*display:\s*none\s*!important;/
  );
});

test("mobile Tools keeps one quiet primary action rail and one observation rail", () => {
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*flex-end;/
  );
  assert.match(
    legendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend\s*\{[\s\S]*?top:\s*48px;[\s\S]*?right:\s*64px;[\s\S]*?display:\s*block;/
  );
  assert.match(
    legendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.analysis-close\s*\{[\s\S]*?top:\s*48px;[\s\S]*?left:\s*auto;[\s\S]*?right:\s*9px;/
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
