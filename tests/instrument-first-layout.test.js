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

test("desktop wheel owns the viewport instead of a capped document column", () => {
  assert.match(css, /\.kinetic-shell\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?padding:\s*12px 0 22px;/);
  assert.doesNotMatch(css, /\.kinetic-shell\s*\{[^}]*width:\s*min\(1760px,\s*100%\)/s);
  assert.match(css, /\.instrument-shell\s*\{[\s\S]*?height:\s*max\(720px,\s*calc\(100dvh - 52px\)\);[\s\S]*?container-type:\s*size;/);
  assert.match(css, /\.kinetic-topbar\s*\{[^}]*padding-inline:\s*clamp\(14px,\s*2vw,\s*32px\);/s);
});

test("wide desktop ring identities follow camera height instead of old width percentages", () => {
  assert.match(css, /@media \(min-width: 821px\)/);
});

test("mobile reading view removes hero/card chrome without stealing shell scroll ownership", () => {
  const mobile = css.match(/@media \(max-width: 480px\) \{([\s\S]*?)\n\}/);
  assert.ok(mobile);
  assert.doesNotMatch(mobile[1], /\.kinetic-shell\s*\{/);
  assert.doesNotMatch(mobile[1], /grid-template-rows/);
  assert.match(mobile[1], /\.atlas-intro\s*\{\s*display:\s*none;/);
});

test("mobile ordinary reading flattens exact-time chrome without requiring DOM adjacency", () => {
  assert.doesNotMatch(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \+ \.mobile-time-dock/);
});

test("mobile ordinary idle exact-time rail removes duplicate metadata but preserves feedback states", () => {
  assert.match(css, /#mobile-time-status\[data-state="idle"\][\s\S]*?display:\s*none;/);
});

test("ordinary reading keeps long-form notes out of the main path", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.atlas-notes\s*\{\s*display:\s*none;/);
});

test("ordinary reading hides observation-window presets and analysis transport chrome", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.scale-button,[\s\S]*?#classification-overlay-button,[\s\S]*?#play-button\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(css, /#kinetic-instrument\[data-analysis-open="true"\] \.scale-button\s*\{[^}]*display:\s*none;/s);
  assert.doesNotMatch(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #now-button\s*\{[^}]*display:\s*none;/s);
});

test("ordinary time navigation leaves Now as the only toolbar shortcut", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.instrument-toolbar\s*\{[\s\S]*?justify-content:\s*flex-start;/);
});

test("ordinary reading retires the duplicate Selected Instant caption", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #cursor-layer \.cursor-note\s*\{\s*display:\s*none;/);
});

test("ordinary reading preserves exact datetime entry but removes duplicate range and diagnostics", () => {
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.timeline-dock/);
});
