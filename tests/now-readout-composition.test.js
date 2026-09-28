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

test("mobile keeps time and Now in the control row and moves Zodiac below", () => {
  const actions = page.match(/<div class="mobile-time-actions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(actions);
  assert.match(actions, /id="mobile-time-apply"[\s\S]*id="mobile-now-button"/);
  assert.doesNotMatch(actions, /mobile-zodiac-readout/);
  assert.ok(page.indexOf('id="mobile-zodiac-readout"') > page.indexOf('class="mobile-time-actions"'));
  assert.match(css, /#mobile-zodiac-readout:not\(\[hidden\]\)\s*\{[\s\S]*?grid-column:1 \/ -1;[\s\S]*?justify-self:end;/);
});
