import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../navigation-workspace.css", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/selected-instant-editor.js", import.meta.url), "utf8");

test("desktop Now shares a visual line while Selected Instant stays centered", () => {
  assert.match(page, /class="selected-instant-line"\s*>\s*<div id="instant-readout">—<\/div>\s*<button id="now-button"/);
  assert.match(css, /\.selected-instant-line\s*\{\s*position:relative;[\s\S]*?width:max-content;[\s\S]*?margin:0 auto;/);
  assert.match(css, /\.selected-instant-line #now-button\.readout-now\s*\{\s*position:absolute;[\s\S]*?left:calc\(100% \+ 10px\);[\s\S]*?transform:translateY\(-50%\);/);
  assert.match(css, /\.instrument-readout\s*\{[\s\S]*?padding-bottom:28px;/);
});

test("opening inline editor does not split the timestamp and Now action", () => {
  assert.match(editor, /readout\.closest\("\.selected-instant-line"\) \?\? readout/);
  assert.match(css, /data-instant-editor-open="true"\] \.selected-instant-line #now-button\.readout-now\s*\{\s*visibility:hidden;/);
  assert.match(css, /@media \(min-width:481px\) and \(max-width:820px\)/);
});

test("mobile Now is adjacent to its time input and precedes Zodiac context", () => {
  const mobile = page.match(/<div class="mobile-time-actions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(mobile);
  const apply = mobile.indexOf('id="mobile-time-apply"');
  const now = mobile.indexOf('id="mobile-now-button"');
  const zodiac = mobile.indexOf('id="mobile-zodiac-readout"');
  assert.ok(apply >= 0 && apply < now && now < zodiac);
});
