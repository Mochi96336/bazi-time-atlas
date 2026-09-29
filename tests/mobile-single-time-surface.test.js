import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mobileCss = readFileSync(new URL("../mobile-time.css", import.meta.url), "utf8");
const instrumentCss = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");
const navCss = readFileSync(new URL("../navigation-workspace.css", import.meta.url), "utf8");
const mobileController = readFileSync(new URL("../src/mobile-time-control.js", import.meta.url), "utf8");
const mobileFixture = readFileSync(new URL("../scripts/fixtures/mobile-390.html", import.meta.url), "utf8");
const mobileProbe = readFileSync(new URL("../scripts/check-mobile-zodiac-datum.mjs", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("ordinary mobile and Analysis share one real time-control row", () => {
  assert.match(mobileCss, /\.mobile-time-dock\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 48px;[\s\S]*?row-gap:\s*0;/);
  assert.match(mobileCss, /#mobile-time-status\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?clip-path:\s*inset\(50%\);/);
  assert.match(html, /id="mobile-time-dock"[\s\S]*?id="mobile-instant-input"[\s\S]*?id="mobile-time-apply"[\s\S]*?id="mobile-now-button"[\s\S]*?id="mobile-time-status"/);
  assert.doesNotMatch(html, /id="mobile-zodiac-readout"|class="mobile-time-heading"/);
  assert.match(mobileCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.instrument-readout\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(mobileCss, /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-readout\s*\{[^}]*display:\s*none;/s);
});

test("dirty input swaps Now for Apply within the same width and Escape can cancel", () => {
  assert.match(navCss, /\.mobile-time-dock\[data-dirty="false"\] \.mobile-time-actions #mobile-time-apply,[\s\S]*?\.mobile-time-dock\[data-dirty="true"\] \.mobile-time-actions #mobile-now-button\s*\{\s*display:\s*none;/);
  assert.match(mobileController, /event\.key === "Escape"[\s\S]*?input\.blur\(\);[\s\S]*?syncFromInstrument\(\);/);
  assert.match(mobileController, /event\.key === "Enter"[\s\S]*?applyExactTime\(\)/);
  assert.match(mobileCss, /#mobile-instant-input\[aria-invalid="true"\]/);
});

test("invalid mobile input provides on-demand visible feedback without another row", () => {
  assert.match(mobileController, /function showInputError\(message\)[\s\S]*?input\.setCustomValidity\(message\);[\s\S]*?input\.reportValidity\(\);/);
  assert.match(mobileController, /if \(instantMs === null\)\s*\{\s*showInputError\(/);
  assert.match(mobileController, /function clearInputError\(\)[\s\S]*?input\.setCustomValidity\(""\)/);
  assert.match(mobileController, /input\?\.addEventListener\("input", \(\) => \{\s*clearInputError\(\);/);
  assert.match(mobileCss, /\.mobile-time-dock #mobile-time-status\s*\{[\s\S]*?clip-path:\s*inset\(50%\);/);
});

test("Zodiac remains canonical wheel data, not a repeated second row", () => {
  assert.doesNotMatch(html, /id="mobile-zodiac-readout"/);
  assert.doesNotMatch(mobileController, /zodiacReadout/);
  assert.match(mobileFixture, /probe\.dataset\.wheelZodiacIdentity/);
  assert.match(mobileFixture, /doc\.querySelector\("#zodiac-track"\)/);
  for (const field of ["wheelZodiacIdentity", "singleRowInitial", "dirtySwapsAction",
    "restoreOneRow", "classificationOneRow", "analysisOneRow"]) {
    assert.ok(mobileFixture.includes("probe.dataset." + field), field);
    const htmlAttribute = field.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
    assert.ok(mobileProbe.includes('"' + htmlAttribute + '"'), htmlAttribute);
  }
});

test("mobile layout is flattened through shared instrument owner without duplicate rail cards", () => {
  assert.match(instrumentCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.mobile-time-dock\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-top:/);
  assert.doesNotMatch(instrumentCss, /#mobile-zodiac-readout/);
  assert.doesNotMatch(instrumentCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \+ \.mobile-time-dock/);
  assert.doesNotMatch(mobileCss, /\.cursor-note/);
  assert.match(instrumentCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #cursor-layer \.cursor-note\s*\{\s*display:\s*none;/);
});
