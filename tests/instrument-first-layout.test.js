import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");

test("instrument-first reset is loaded last among homepage styles", () => {
  const reset = html.indexOf('href="./instrument-first.css"');
  const inspector = html.indexOf('href="./ganzhi-inspector.css"');
  assert.ok(reset > inspector && inspector >= 0);
});

test("desktop reading view removes narrative and elevated card chrome", () => {
  assert.match(css, /@media \(min-width: 481px\)/);
  assert.match(css, /\.atlas-intro\s*\{\s*display:\s*none;/);
  assert.match(css, /\.instrument-shell\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
});

test("mobile reading view removes hero/card chrome without stealing shell scroll ownership", () => {
  const mobile = css.match(/@media \(max-width: 480px\) \{([\s\S]*?)\n\}/);
  assert.ok(mobile, "mobile instrument-first override must exist");
  assert.doesNotMatch(mobile[1], /\.kinetic-shell\s*\{/);
  assert.doesNotMatch(mobile[1], /grid-template-rows/);
  assert.match(mobile[1], /\.atlas-intro\s*\{\s*display:\s*none;/);
  assert.match(mobile[1], /\.instrument-shell\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
});

test("ordinary reading keeps long-form notes out of the main path", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.atlas-notes\s*\{\s*display:\s*none;/);
});

test("ordinary reading keeps quiet observation-window lenses but hides analysis transport chrome", () => {
  assert.doesNotMatch(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.toolbar-group\[role="group"\]\[aria-label="時間尺度"\][\s\S]*?display:\s*none;/
  );
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #classification-overlay-button,[\s\S]*?#play-button\s*\{\s*display:\s*none;/
  );
  assert.match(css, /\.scale-button\[data-scale="day"\]::after\s*\{\s*content:\s*"日內";/s);
  assert.match(css, /\.scale-button\[data-scale="year"\]::after\s*\{\s*content:\s*"年度";/s);
  assert.match(css, /\.scale-button\[data-scale="cycle"\]::after\s*\{\s*content:\s*"六十年";/s);
  assert.match(css, /\.scale-button\.active\s*\{[^}]*background:\s*transparent;/s);
  assert.doesNotMatch(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #now-button\s*\{[^}]*display:\s*none;/s
  );
});

test("ordinary reading preserves exact datetime entry but removes duplicate range and diagnostics", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.timeline-dock\s*\{[\s\S]*?grid-template-columns:\s*minmax\(190px, 230px\);[\s\S]*?opacity:\s*\.52;/);
  assert.match(css, /~ \.timeline-dock \.slider-wrap,[\s\S]*?~ \.timeline-dock \.timeline-status\s*\{\s*display:\s*none;/);
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.readout-meta,[\s\S]*?\.boundary-meta\s*\{\s*display:\s*none;/);
  assert.match(css, /#kinetic-instrument\[data-analysis-open="true"\] ~ \.timeline-dock\s*\{\s*opacity:\s*1;/);
  assert.match(css, /\.timeline-dock:focus-within\s*\{\s*opacity:\s*1;/);
});
