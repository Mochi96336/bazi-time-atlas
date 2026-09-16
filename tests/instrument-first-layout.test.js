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

test("ordinary reading keeps long-form notes out of the main path", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.atlas-notes\s*\{\s*display:\s*none;/);
});

test("ordinary reading keeps only the immediate Now action in the wheel toolbar", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.toolbar-group\[role="group"\]\[aria-label="時間尺度"\],[\s\S]*?#classification-overlay-button,[\s\S]*?#play-button\s*\{\s*display:\s*none;/);
  const nowRule = css.match(/#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #now-button\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(nowRule);
  assert.doesNotMatch(nowRule, /display:\s*none/);
});

test("ordinary reading preserves exact datetime entry but removes the duplicate range and scale status", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.timeline-dock\s*\{[\s\S]*?grid-template-columns:\s*minmax\(190px, 230px\);[\s\S]*?opacity:\s*\.48;/);
  assert.match(css, /~ \.timeline-dock \.slider-wrap,[\s\S]*?~ \.timeline-dock \.timeline-status\s*\{\s*display:\s*none;/);
  assert.match(css, /#kinetic-instrument\[data-analysis-open="true"\] ~ \.timeline-dock\s*\{\s*opacity:\s*1;/);
  assert.match(css, /\.timeline-dock:focus-within\s*\{\s*opacity:\s*1;/);
});
