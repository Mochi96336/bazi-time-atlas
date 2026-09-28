import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analysisCss = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");
const legendCss = readFileSync(new URL("../mobile-legend.css", import.meta.url), "utf8");
const navigationCss = readFileSync(new URL("../navigation-workspace.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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

test("mobile Tools uses a native stable header slot, not a wheel capsule", () => {
  assert.ok(html.includes('class="topbar-tool-slot"'));
  assert.ok(html.includes('id="analysis-toggle" class="analysis-toggle" type="button"'));
  assert.ok(navigationCss.includes(".kinetic-topbar .topbar-tool-slot"));
  assert.ok(navigationCss.includes("flex-basis:55px"));
});

test("mobile Now belongs to the exact-time dock, not the navigation header", () => {
  assert.ok(html.includes('id="mobile-now-button"'));
  assert.ok(html.indexOf('id="mobile-now-button"') > html.indexOf('id="mobile-instant-input"'));
  assert.ok(navigationCss.includes(".mobile-time-dock .mobile-time-actions #mobile-now-button"));
  assert.ok(navigationCss.includes("min-height:42px"));
});

test("mobile contextual Tools stay in one secondary rail", () => {
  assert.ok(navigationCss.includes('.instrument-toolbar {'));
  assert.ok(navigationCss.includes('display:none !important;'));
  assert.match(
    legendCss,
    /\.ring-legend-row\[data-ring-toggle\],[\s\S]*?\.reference-frame-control\s*\{\s*display:\s*none\s*!important;/
  );
  assert.ok(navigationCss.includes(".topbar-tool-slot .analysis-close"));
});

test("mobile Tools keeps one Selected Instant caption and a full-size header action", () => {
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] #cursor-layer \.cursor-note\s*\{\s*display:\s*none;/
  );
  assert.ok(navigationCss.includes(".topbar-tool-slot .analysis-toggle"));
  assert.ok(navigationCss.includes("min-height:42px"));
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
