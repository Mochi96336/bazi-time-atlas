import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../navigation-workspace.css", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/selected-instant-editor.js", import.meta.url), "utf8");

test("desktop Selected Instant owns the center and Now stays in normal flow", () => {
  assert.match(page, /class="selected-instant-line"\s*>\s*<div id="instant-readout">—<\/div>\s*<button id="now-button"/);
  assert.match(css, /\.selected-instant-line\s*\{\s*display:grid;[\s\S]*?grid-template-columns:72px max-content 72px;[\s\S]*?justify-content:center;/);
  assert.match(css, /\.selected-instant-line::before\s*\{[\s\S]*?grid-column:1;[\s\S]*?width:72px;/);
  assert.match(css, /#instant-readout\s*\{[\s\S]*?grid-column:2;/);
  assert.match(css, /#now-button\.readout-now\s*\{[\s\S]*?grid-column:3;[\s\S]*?position:static;[\s\S]*?transform:none;/);
  assert.doesNotMatch(css, /left:calc\(100% \+/);
  assert.doesNotMatch(css, /position:absolute;[\s\S]{0,220}#now-button/);
});

test("editor hides Now without changing the symmetric grid geometry", () => {
  assert.match(editor, /readout\.closest\("\.selected-instant-line"\) \?\? readout/);
  assert.match(css, /data-instant-editor-open="true"\] \.selected-instant-line #now-button\.readout-now\s*\{\s*visibility:hidden;/);
  assert.match(css, /grid-template-columns:72px max-content 72px/);
});

test("mobile has one real time/action row and no duplicate Zodiac or visual status row", () => {
  const dock = page.match(/<section id="mobile-time-dock"[\s\S]*?<\/section>/)?.[0];
  assert.ok(dock);
  assert.match(dock, /id="mobile-instant-input"[\s\S]*?class="mobile-time-actions"[\s\S]*?id="mobile-time-apply"[\s\S]*?id="mobile-now-button"/);
  assert.match(dock, /id="mobile-time-status" role="status" aria-live="polite"/);
  assert.doesNotMatch(dock, /mobile-time-heading|mobile-zodiac-readout/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,1fr\) 48px !important/);
  assert.match(css, /data-dirty="true"\] \.mobile-time-actions #mobile-now-button\s*\{[\s\S]*?display: none;/);
});
