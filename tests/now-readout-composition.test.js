import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../navigation-workspace.css", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/selected-instant-editor.js", import.meta.url), "utf8");

test("desktop Now occupies a symmetric grid column, not absolute positioning", () => {
  assert.match(page, /class="selected-instant-line"[\\s\\S]*?class="selected-instant-balance"[\\s\\S]*?id="instant-readout"[\\s\\S]*?id="now-button"/);
  const readhead = css.split("/* Now/read-head F2:")[1];
  assert.ok(readhead, "the final structural layout must be present");
  assert.match(readhead, /grid-template-columns:60px minmax\\(0,max-content\\) 60px;/);
  assert.match(readhead, /\\.selected-instant-line \\.selected-instant-balance/);
  assert.match(readhead, /\\.selected-instant-line #instant-readout/);
  assert.match(readhead, /\\.selected-instant-line #now-button\\.readout-now \\{[\\s\\S]*?position:static;/);
  assert.doesNotMatch(readhead, /position:absolute/);
  assert.doesNotMatch(readhead, /left:calc\\(100%/);
  assert.doesNotMatch(page, /aria-hidden="true">↺/);
});

test("editing preserves the centered read-head and reserved Now column", () => {
  assert.match(editor, /readout\\.closest\\("\\.selected-instant-line"\\) \\?\\? readout/);
  assert.match(css, /data-instant-editor-open="true"\\] \\.selected-instant-line #now-button\\.readout-now\\s*\\{[\\s\\S]*?visibility:hidden;/);
  assert.match(css, /@media \\(min-width:481px\\) and \\(max-width:820px\\)/);
});

test("mobile time and Now are real controls; Zodiac is a separate data row", () => {
  const mobileActions = page.match(/<div class="mobile-time-actions">([\\s\\S]*?)<\\/div>/)?.[1];
  assert.ok(mobileActions);
  assert.match(mobileActions, /id="mobile-time-apply"/);
  assert.match(mobileActions, /id="mobile-now-button"/);
  assert.doesNotMatch(mobileActions, /mobile-zodiac-readout/);
  assert.match(page, /class="mobile-time-context">[\\s\\S]*?id="mobile-zodiac-readout"/);
  assert.match(css, /\\.mobile-time-dock \\.mobile-time-context \\{[\\s\\S]*?grid-column:1 \\/ -1;/);
  assert.match(css, /\\.mobile-time-context:has\\(#mobile-zodiac-readout\\[hidden\\]\\)/);
});
