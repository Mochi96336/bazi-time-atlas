import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../navigation-workspace.css", import.meta.url), "utf8");
const wheel = readFileSync(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/selected-instant-editor.js", import.meta.url), "utf8");
const design = css.slice(css.indexOf("/* Readout F2:"));
assert.ok(design.length > 2500, "the single final F2 layout layer must exist");

test("desktop time is the actual center column of a balanced grid", () => {
  assert.match(html, /class="selected-instant-line"\s*>\s*<div id="instant-readout">—<\/div>\s*<button id="now-button"/);
  assert.match(design, /\.selected-instant-line\s*\{[^}]*display:grid;[^}]*grid-template-columns:minmax\(48px,1fr\) minmax\(0,max-content\) minmax\(48px,1fr\);/);
  assert.match(design, /#instant-readout\s*\{[^}]*grid-column:2;[^}]*justify-self:center;/);
  assert.match(design, /#now-button\.readout-now\s*\{[^}]*position:static;[^}]*grid-column:3;/);
  assert.doesNotMatch(design, /#now-button\.readout-now\s*\{[^}]*position:absolute;/);
});

test("time basis is subordinate but remains inside the same authoritative readout", () => {
  assert.match(wheel, /civil\.textContent = formatAtlasCivil\(fields\)/);
  assert.match(wheel, /zone\.textContent = ` · \$\{offsetLabel\}`/);
  assert.match(wheel, /instantReadout\.replaceChildren\(civil, zone\)/);
  assert.match(design, /\.instrument-readout \.readout-zone\s*\{[^}]*display:block;[^}]*font-size:10px;/);
});

test("edit reserves the Now cell; Find Time removes it without retargeting time editing", () => {
  assert.match(editor, /readout\.closest\("\.selected-instant-line"\) \?\? readout/);
  assert.match(design, /data-instant-editor-open="true"\] \.selected-instant-line #now-button\.readout-now\s*\{[^}]*visibility:hidden;/);
  assert.match(design, /data-inverse-time-search="active"\][\s\S]*?#now-button\.readout-now\s*\{[^}]*display:none;/);
  assert.doesNotMatch(design, /\.now-label\s*\{\s*display:none;/);
});

test("mobile semantics separate derived Zodiac from the input/Now control row", () => {
  const heading = html.match(/<div class="mobile-time-heading">([\s\S]*?)<\/div>/)?.[1];
  const actions = html.match(/<div class="mobile-time-actions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(heading?.includes('id="mobile-zodiac-readout"'));
  assert.ok(actions?.includes('id="mobile-now-button"'));
  assert.ok(!actions?.includes('mobile-zodiac-readout'));
  assert.match(design, /\.mobile-time-dock \.mobile-time-heading\s*\{[^}]*grid-row:1;/);
  assert.match(design, /\.mobile-time-dock \.mobile-time-field\s*\{[^}]*grid-row:2;/);
  assert.match(design, /\.mobile-time-dock \.mobile-time-actions\s*\{[^}]*grid-row:2;/);
});

test("browser gate measures the real time center, rail ownership, mobile hitbox and long-year case", () => {
  const browser = readFileSync(new URL("../scripts/check-now-readout-layout.mjs", import.meta.url), "utf8");
  const fixture = readFileSync(new URL("../scripts/fixtures/now-readout-layout.html", import.meta.url), "utf8");
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts["visual:check"], /check-now-readout-layout\.mjs/);
  assert.match(browser, /--dump-dom/);
  assert.match(browser, /civil-center-error/);
  assert.match(browser, /now-position/);
  assert.match(browser, /mobile-caption-above/);
  assert.match(browser, /mobile-input-width/);
  assert.match(browser, /long:true/);
  assert.match(browser, /edit:true/);
  assert.match(fixture, /getBoundingClientRect/);
  assert.match(fixture, /readout\.click\(\)/);
});
