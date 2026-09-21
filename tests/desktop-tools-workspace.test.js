import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../desktop-tools-workspace.css", import.meta.url), "utf8");
const analysis = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");

test("desktop Tools installs the edge-workspace layer last", () => {
  assert.match(analysis, /function installDesktopToolsWorkspaceStyles\(\)/);
  assert.match(analysis, /stylesheet\.href = "\.\/desktop-tools-workspace\.css"/);
  assert.match(
    analysis,
    /installAnalysisToolsRailStyles\(\);[\s\S]*installDesktopToolsWorkspaceStyles\(\);/
  );
});

test("desktop Tools removes transport and layer chrome from the product surface", () => {
  assert.match(css, /@media \(min-width: 821px\)/);
  assert.match(css, /\.instrument-toolbar > \.toolbar-group:first-child,[\s\S]*#play-button[\s\S]*display: none !important;/);
  assert.match(css, /\.ring-legend-row\[data-ring-toggle\][\s\S]*display: none !important;/);
});

test("desktop Tools converges global chrome to one focused top row", () => {
  assert.match(css, /body:has\(#kinetic-instrument\[data-analysis-open="true"\]\) \.kinetic-topbar[\s\S]*justify-content: flex-start;[\s\S]*padding-right: 280px;[\s\S]*border-bottom:/);
  assert.match(css, /body:has\(#kinetic-instrument\[data-analysis-open="true"\]\) \.kinetic-topbar \.site-nav[\s\S]*display: flex;[\s\S]*margin: 0;/);
  assert.match(css, /\.instrument-toolbar \{[\s\S]*position: fixed;[\s\S]*top: 12px;[\s\S]*right: 18px;[\s\S]*padding: 0 62px 0 0;[\s\S]*border: 0;/);
  assert.match(css, /\.analysis-close \{[\s\S]*position: fixed;[\s\S]*top: 12px;[\s\S]*right: 18px;[\s\S]*min-height: 32px;/);
});

test("desktop Tools retires reference/layer chrome and keeps edge tools off document flow", () => {
  assert.match(css, /\.ring-legend \{\s*display: none !important;/);
  assert.match(css, /~ \.timeline-dock \{[\s\S]*display: none !important;/);
  assert.match(css, /\.atlas-solar-time-analysis \{[\s\S]*top: 84px;[\s\S]*width: 340px;/);
  assert.match(css, /data-classification-overlay="on"\] \.classification-overlay-legend \{[\s\S]*top: 84px;/);
});

test("desktop Solar Time stays compact until a real longitude binds it", () => {
  assert.match(css, /\.atlas-solar-time-analysis\[data-longitude-bound="false"\] \{[\s\S]*bottom: auto;[\s\S]*max-height: none;[\s\S]*padding-bottom: 10px;/);
  assert.match(css, /data-longitude-bound="false"\] \.atlas-solar-analysis-head > div > small[\s\S]*display: none;/);
  assert.match(css, /data-longitude-bound="false"\] \.atlas-solar-analysis-empty[\s\S]*max-width: 260px;[\s\S]*font-size: 9px;/);
});

test("desktop Solar Time separates result from secondary calculation detail", () => {
  assert.match(css, /\.atlas-solar-verdict \{[\s\S]*padding-top: 2px;/);
  assert.match(css, /\.atlas-solar-calculation-head \{[\s\S]*margin-top: 5px;[\s\S]*border-top: 1px solid var\(--m2-etched-dark-soft\);/);
  assert.match(css, /\.atlas-solar-corrections \{[\s\S]*border-top: 0;[\s\S]*box-shadow: none;/);
});

test("desktop Classification replaces Solar Time on the left instead of colliding with the right inspector", () => {
  assert.match(css, /data-classification-overlay="on"\] ~ \.atlas-solar-time-analysis[\s\S]*display: none !important;/);
  assert.match(css, /data-classification-overlay="on"\] \.classification-overlay-legend \{[\s\S]*position: fixed;[\s\S]*top: 84px;[\s\S]*right: auto;[\s\S]*left: 0;[\s\S]*width: 340px;[\s\S]*linear-gradient\(to right,/);
  assert.doesNotMatch(css, /data-classification-overlay="on"\] \.classification-overlay-legend \{[^}]*right:\s*0;/s);
});

test("desktop Classification keeps a 9px information floor without widening its rail", () => {
  assert.match(css, /data-classification-overlay="on"\] \.classification-row header span \{[\s\S]*font-size: 10px;/);
  assert.match(css, /data-classification-overlay="on"\] \.classification-row header small,[\s\S]*\.classification-warning \{[\s\S]*font-size: 9px;/);
  assert.match(css, /data-classification-overlay="on"\] \.classification-keys i \{[\s\S]*min-width: 20px;[\s\S]*width: 20px;[\s\S]*height: 20px;[\s\S]*font-size: 9px;/);
  assert.match(css, /data-classification-overlay="on"\] \.classification-overlay-legend \{[\s\S]*width: 340px;/);
});

test("desktop Four Pillars summary uses the full right rail instead of a squeezed legacy grid column", () => {
  assert.match(css, /\.atlas-visible-ten-gods \{[\s\S]*width: clamp\(320px, 22vw, 370px\);[\s\S]*display: block;[\s\S]*pointer-events: auto;/);
  assert.match(css, /\.atlas-visible-ten-gods-grid \{[\s\S]*width: 100%;[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.atlas-visible-ten-gods-cell \{[\s\S]*min-height: 42px;[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/);
});

test("desktop Four Pillars evidence keeps a 9px information floor", () => {
  assert.match(css, /\.atlas-visible-ten-gods-head strong \{[\s\S]*font-size: 10px;/);
  assert.match(css, /\.atlas-visible-ten-gods-master \{[\s\S]*font-size: 10px;/);
  assert.match(css, /\.atlas-visible-ten-gods-cell span \{[\s\S]*font-size: 9px;/);
  assert.match(css, /\.atlas-visible-ten-gods-cell small \{[\s\S]*font-size: 9px;/);
  assert.match(css, /#ganzhi-inspector\[data-mode="pillar"\] \.ganzhi-inspector-pillar-switch span,[\s\S]*?font-size: 9px;/);
  assert.match(css, /#ganzhi-inspector\[data-mode="pillar"\] \.ganzhi-structure-pillar small,[\s\S]*?font-size: 9px;/);
});

test("desktop Tools uses edge assists instead of growing a bottom workspace", () => {
  assert.match(css, /~ \.timeline-dock \{[\s\S]*display: none !important;/);
  assert.match(css, /\.atlas-solar-time-analysis \{[\s\S]*position: fixed;[\s\S]*left: 0;[\s\S]*linear-gradient\(to right,/);
  assert.match(css, /\.atlas-visible-ten-gods \{[\s\S]*position: absolute;[\s\S]*right: 0;[\s\S]*linear-gradient\(to left,/);
  assert.match(css, /~ \.state-strip,[\s\S]*~ \.atlas-notes,[\s\S]*~ \.sources-panel[\s\S]*display: none !important;/);
});

test("edge workspace is desktop-only", () => {
  assert.doesNotMatch(css, /@media \(max-width: 480px\)/);
});
