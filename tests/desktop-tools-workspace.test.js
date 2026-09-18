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

test("desktop Tools uses edge assists instead of growing a bottom workspace", () => {
  assert.match(css, /~ \.timeline-dock \{[\s\S]*position: fixed;[\s\S]*left: 18px;/);
  assert.match(css, /\.atlas-solar-time-analysis \{[\s\S]*position: fixed;[\s\S]*left: 0;[\s\S]*linear-gradient\(to right,/);
  assert.match(css, /\.atlas-visible-ten-gods \{[\s\S]*position: absolute;[\s\S]*right: 0;[\s\S]*linear-gradient\(to left,/);
  assert.match(css, /~ \.state-strip,[\s\S]*~ \.atlas-notes,[\s\S]*~ \.sources-panel[\s\S]*display: none !important;/);
});

test("edge workspace is desktop-only", () => {
  assert.doesNotMatch(css, /@media \(max-width: 480px\)/);
});
