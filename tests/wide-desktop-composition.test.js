import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const polish = readFileSync(new URL("../analysis-first-screen-polish.css", import.meta.url), "utf8");
const toolsRail = readFileSync(new URL("../analysis-tools-rail.css", import.meta.url), "utf8");
const analysisMode = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const fixture = readFileSync(new URL("../scripts/fixtures/wide-desktop-2047.html", import.meta.url), "utf8");
const browserGate = readFileSync(new URL("../scripts/check-wide-desktop-composition.mjs", import.meta.url), "utf8");
const visualCapture = readFileSync(new URL("../scripts/visual-check-wide-desktop.mjs", import.meta.url), "utf8");

test("wide Analysis fills the desktop viewport without leaking geometry into ordinary reading", () => {
  assert.match(
    polish,
    /@media \(min-width: 821px\) \{[\s\S]*?#kinetic-instrument\[data-analysis-open="true"\]\s*\{\s*height:\s*max\(720px,\s*calc\(100dvh - 52px\)\);/
  );
  assert.match(polish, /@media \(min-width: 1800px\) and \(min-aspect-ratio: 17\/9\)/);
  assert.doesNotMatch(polish, /44vw|100dvh - 92px/);
  assert.match(
    polish,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-readout\s*\{\s*bottom:\s*26px;/
  );
  assert.doesNotMatch(polish, /(?:^|\n)\s*\.instrument-shell\s*\{/);
  assert.doesNotMatch(polish, /(?:^|\n)\s*\.instrument-readout\s*\{/);
});

test("wide Analysis rails have explicit readable type floors without adding new controls", () => {
  assert.match(polish, /@media \(min-width: 1600px\)/);
  assert.match(polish, /\.instrument-toolbar \.control-button,[\s\S]*?font-size:\s*10px;/);
  assert.match(polish, /\.ring-legend-row span\s*\{\s*font-size:\s*9px;/s);
  assert.match(polish, /\.atlas-visible-ten-gods-cell strong\s*\{\s*font-size:\s*10\.5px;/s);
  assert.match(polish, /\.analysis-close\s*\{[\s\S]*?font-size:\s*9px;/);
  assert.doesNotMatch(polish, /content:\s*["'][^"']*(?:tool|mode|preset|range|播放|區間)[^"']*["']/i);
});

test("wide Analysis readability pass strengthens chrome and fast-ring context without changing geometry", () => {
  assert.match(
    polish,
    /\.instrument-toolbar \.control-button,[\s\S]*?min-height:\s*32px;[\s\S]*?color:\s*#989d9d;[\s\S]*?font-size:\s*11px;/
  );
  assert.match(polish, /\.ring-legend\s*\{[\s\S]*?top:\s*46px;[\s\S]*?max-width:\s*1040px;[\s\S]*?gap:\s*10px 18px;/);
  assert.match(polish, /\.reference-frame-control select\s*\{[\s\S]*?min-height:\s*26px;[\s\S]*?font-size:\s*10px;/);
  assert.match(polish, /\.ring-legend-row span\s*\{[\s\S]*?color:\s*#999e9e;[\s\S]*?font-size:\s*10px;/);
  assert.match(polish, /\.analysis-close\s*\{[\s\S]*?top:\s*46px;[\s\S]*?font-size:\s*10px;/);
  assert.match(polish, /data-scale-window="year"\] #day-track\s*\{\s*--scale-context-opacity:\s*\.72;/s);
  assert.match(polish, /data-scale-window="year"\] #hour-track\s*\{\s*--scale-context-opacity:\s*\.68;/s);
  assert.match(polish, /#hour-track \.cycle-label:not\(\.active-cycle-label\)\s*\{[\s\S]*?fill:\s*rgba\(196,202,201,\.46\);[\s\S]*?font-size:\s*9px;/);
  assert.match(polish, /#day-track \.cycle-label:not\(\.active-cycle-label\)\s*\{[\s\S]*?fill:\s*rgba\(207,212,210,\.52\);[\s\S]*?font-size:\s*9\.5px;/);
  assert.doesNotMatch(polish, /(?:width|height|viewBox|transform):\s*[^;]*(?:wheel|track)/i);
});

test("wide Tools rows share one instrument header frame", () => {
  assert.match(analysisMode, /installAnalysisFirstScreenPolishStyles\(\);[\s\S]*?installAnalysisToolsRailStyles\(\);/);
  assert.match(toolsRail, /^@import "\.\/graphite-m2-material\.css";/);
  assert.match(toolsRail, /@media \(min-width: 1600px\)/);
  assert.match(
    toolsRail,
    /\.instrument-toolbar,[\s\S]*?\.ring-legend\s*\{[\s\S]*?left:\s*clamp\(18px, 2vw, 32px\);[\s\S]*?right:\s*clamp\(18px, 2vw, 32px\);[\s\S]*?max-width:\s*none;/
  );
  assert.match(
    toolsRail,
    /\.instrument-toolbar\s*\{[\s\S]*?min-height:\s*36px;[\s\S]*?border-bottom:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?box-shadow:\s*0 1px 0 var\(--m2-etched-light-soft\);/
  );
  assert.match(
    toolsRail,
    /\.ring-legend\s*\{[\s\S]*?top:\s*48px;[\s\S]*?padding:\s*0 64px 4px 0;[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?border-bottom:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?box-shadow:\s*0 1px 0 var\(--m2-etched-light-soft\);/
  );
  assert.match(
    toolsRail,
    /\.analysis-close\s*\{[\s\S]*?top:\s*50px;[\s\S]*?right:\s*clamp\(18px, 2vw, 32px\);[\s\S]*?border-left:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?box-shadow:\s*inset 1px 0 0 var\(--m2-etched-light-soft\);/
  );
  assert.doesNotMatch(toolsRail, /border-(?:bottom|left):\s*1px solid rgba\(/);
  assert.doesNotMatch(toolsRail, /(?:background|border-radius):\s*[^;]+;/);
  assert.doesNotMatch(toolsRail, /(?:viewBox|#kinetic-wheel|#(?:year|month|day|hour|solar)-track)/);
});

test("Visual gate owns a real 2047x1038 browser probe and PNG evidence", () => {
  assert.match(fixture, /width:\s*2047px/);
  assert.match(fixture, /height:\s*1038px/);
  assert.match(fixture, /data-ready="false"/);
  assert.match(fixture, /const retry = attemptsLeft =>/);
  assert.match(fixture, /if \(callback\(\) \|\| attemptsLeft <= 0\) return;/);
  assert.match(fixture, /setTimeout\(\(\) => retry\(attemptsLeft - 1\), 250\)/);
  assert.match(fixture, /setTimeout\(\(\) => retry\(12\), 700\)/);
  assert.match(fixture, /return true;/);
  assert.match(browserGate, /--virtual-time-budget=6000/);
  assert.match(fixture, /topbarTop:\s*round\(topbarRect\.top\)/);
  assert.match(fixture, /siteNavDisplay:\s*display\(win, siteNav\)/);
  assert.match(fixture, /siteNavRight:\s*round\(siteNavRect\.right\)/);
  assert.match(fixture, /timelineDisplay:\s*display\(win, timeline\)/);
  assert.match(fixture, /solarRight:\s*round\(solarRect\.right\)/);
  assert.match(fixture, /evidenceLeft:\s*round\(evidenceRect\.left\)/);
  assert.match(fixture, /evidenceGridWidth:\s*round\(evidenceGridRect\.width\)/);
  assert.match(fixture, /evidenceInfoMinFont:\s*round\(Math\.min\(\.\.\.evidenceInfoFonts\)\)/);
  assert.match(fixture, /closeRight:\s*round\(closeRect\.right\)/);
  assert.match(fixture, /scaleVisible:\s*String\(renderedVisibleCount\(win, scaleButtons\)\)/);
  assert.match(fixture, /ringToggleVisible:\s*String\(renderedVisibleCount\(win, ringToggles\)\)/);
  assert.match(fixture, /scrollHeight:\s*String\(Math\.max\(doc\.documentElement\.scrollHeight, doc\.body\.scrollHeight\)\)/);
  assert.match(fixture, /hourVisibleLabels:\s*String\(displayVisibleCount\(win, hourLabels\)\)/);
  assert.match(fixture, /dayVisibleLabels:\s*String\(displayVisibleCount\(win, dayLabels\)\)/);
  assert.match(browserGate, /width !== 2047 \|\| height !== 1038/);
  assert.match(browserGate, /instrumentShare < 0\.92 \|\| instrumentShare > 0\.97/);
  assert.match(browserGate, /readoutBottomGap < 24/);
  assert.match(browserGate, /scrollWidth > width \+ 1/);
  assert.match(browserGate, /scrollHeight > height \+ 90/);
  assert.match(browserGate, /data-site-nav-display/);
  assert.match(browserGate, /siteNavRight > toolbarLeft - 24/);
  assert.match(browserGate, /toolbarBottom > topbarBottom \+ 2/);
  assert.match(browserGate, /legendBottom > solarTop \+ 1/);
  assert.match(browserGate, /data-timeline-display/);
  assert.match(browserGate, /solarRight > 390/);
  assert.match(browserGate, /evidenceLeft < width - 430/);
  assert.match(browserGate, /evidenceGridWidth < 240/);
  assert.match(browserGate, /referenceFont < 9/);
  assert.match(browserGate, /evidenceInfoMinFont < 9/);
  assert.match(browserGate, /Math\.abs\(closeTop - toolbarTop\) > 2/);
  assert.match(browserGate, /scaleVisible !== 0/);
  assert.match(browserGate, /ringToggleVisible !== 0/);
  assert.match(browserGate, /hourVisibleLabels !== 60 \|\| dayVisibleLabels !== 60/);
  assert.match(visualCapture, /annual-wide-2047x1038\.png/);
  assert.match(visualCapture, /annual-tools-wide-2047x1038\.png/);
  assert.match(visualCapture, /annual-tools-inspector-wide-2047x1038\.png/);
  assert.match(packageJson.scripts["visual:check"], /check-wide-desktop-composition\.mjs/);
  assert.match(packageJson.scripts["visual:check"], /visual-check-wide-desktop\.mjs/);
});
