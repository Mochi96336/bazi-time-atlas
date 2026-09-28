import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../navigation-workspace.css", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/selected-instant-editor.js", import.meta.url), "utf8");

test("desktop Now uses balanced grid columns, never absolute positioning", () => {
  const rail = page.slice(page.indexOf('class="selected-instant-line"'));
  assert.ok(rail.indexOf('class="selected-instant-balance"') < rail.indexOf('id="instant-readout"'));
  assert.ok(rail.indexOf('id="instant-readout"') < rail.indexOf('id="now-button"'));
  const readhead = css.split("/* Now/read-head F2:")[1];
  assert.ok(readhead, "F2 structural read-head must exist");
  assert.ok(readhead.includes("grid-template-columns:60px minmax(0,max-content) 60px;"));
  assert.ok(readhead.includes(".selected-instant-line .selected-instant-balance"));
  assert.ok(readhead.includes(".selected-instant-line #now-button.readout-now"));
  assert.ok(readhead.includes("position:static;"));
  assert.ok(!readhead.includes("position:absolute"));
  assert.ok(!readhead.includes("left:calc(100%"));
  assert.ok(!rail.slice(0,350).includes("↺"), "Now does not need a lone floating reset glyph");
});

test("UTC basis is subordinate to, not inside, the centered timestamp", () => {
  const renderer = readFileSync(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8");
  assert.ok(page.includes('id="readout-timezone" class="readout-timezone"'));
  assert.ok(renderer.includes('setText("instant-readout", formatAtlasCivil(fields));'));
  assert.ok(renderer.includes('setText("readout-timezone", offsetLabel);'));
  assert.ok(renderer.includes('"readout-timezone",'), "subordinate zone must be registered in renderer text nodes");
  assert.ok(css.includes('.instrument-readout .readout-timezone'));
});

test("editing keeps the balanced read-head and reserved Now cell", () => {
  assert.ok(editor.includes('readout.closest(".selected-instant-line") ?? readout'));
  assert.ok(css.includes('data-instant-editor-open="true"] .selected-instant-line #now-button.readout-now'));
  assert.ok(css.includes("visibility:hidden;"));
  assert.ok(css.includes("@media (min-width:481px) and (max-width:820px)"));
});

test("visual CI proves geometry using a real browser and exact breakpoints", () => {
  const workflow = readFileSync(new URL("../.github/workflows/visual.yml", import.meta.url), "utf8");
  const browser = readFileSync(new URL("../scripts/check-now-readhead-geometry.mjs", import.meta.url), "utf8");
  const fixture = readFileSync(new URL("../scripts/fixtures/now-readhead-geometry.html", import.meta.url), "utf8");
  assert.ok(workflow.includes("run: node scripts/check-now-readhead-geometry.mjs"));
  for (const width of [481,820,821,1440,2047]) assert.ok(browser.includes("width:"+width));
  assert.ok(browser.includes("now-gap"));
  assert.ok(fixture.includes("getBoundingClientRect"));
});

test("phone time and Now are primary; Zodiac has its own information row", () => {
  const mobileActions = page.split('<div class="mobile-time-actions">')[1]?.split("</div>")[0];
  assert.ok(mobileActions);
  assert.ok(mobileActions.includes('id="mobile-time-apply"'));
  assert.ok(mobileActions.includes('id="mobile-now-button"'));
  assert.ok(!mobileActions.includes("mobile-zodiac-readout"));
  assert.ok(page.includes('class="mobile-time-context"'));
  assert.ok(page.indexOf('id="mobile-zodiac-readout"') > page.indexOf('class="mobile-time-context"'));
  assert.ok(css.includes(".mobile-time-dock .mobile-time-context"));
  assert.ok(css.includes("grid-column:1 / -1;"));
  assert.ok(css.includes(".mobile-time-context:has(#mobile-zodiac-readout[hidden])"));
});
