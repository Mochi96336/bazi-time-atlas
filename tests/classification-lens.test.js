import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { MERGED_STYLESHEETS, cssSource } from "./helpers/css-source.js";

const root = new URL("../", import.meta.url);
const css = cssSource("classification-overlay.css");
const mobile = css.slice(css.indexOf("@media (max-width: 480px)"));
const desktop = css.slice(0, css.indexOf("@media (min-width: 481px)"));

function fontSizes(source) {
  return [...source.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/font-size:\s*([\d.]+)px/g)].map(match => Number(match[1]));
}

test("classification-overlay.css is the only owner of the legend", () => {
  // E5: merged stylesheets are checked per original section.
  const merged = new Set(Object.keys(MERGED_STYLESHEETS));
  const sources = [
    ...readdirSync(root).filter(name => name.endsWith(".css") && !merged.has(name)),
    ...Object.values(MERGED_STYLESHEETS).flat()
  ].filter(name => name !== "classification-overlay.css");
  for (const file of sources) {
    // Find Time may hide the legend while it owns the instrument; that is
    // mode behaviour, not legend styling.
    const source = cssSource(file)
      .replace(/#kinetic-instrument\[data-inverse-time-search="active"\] \.classification-overlay-legend,?/g, "");
    assert.doesNotMatch(source, /\.classification-(overlay-legend|row|keys|current|warning)\b/, `${file} restyles the classification legend`);
  }
});

test("legend text keeps the 12px floor on desktop and an 11px annotation floor on mobile", () => {
  for (const size of fontSizes(desktop)) assert.ok(size >= 12, `desktop legend font-size ${size}px`);
  for (const size of fontSizes(mobile)) assert.ok(size >= 11, `mobile legend font-size ${size}px`);
});

test("only the read-head sectors carry strong classification colour", () => {
  assert.match(css, /--classification-rest-fill:\s*16%;/);
  assert.match(css, /--classification-active-fill:\s*46%;/);
  assert.match(css, /\.cycle-sector\[data-stem-element\]\s*\{\s*fill:\s*color-mix\(in srgb, var\(--stem-color\) var\(--classification-rest-fill\), transparent\);/);
  assert.match(css, /\.cycle-sector\[data-stem-element\]\.is-active\s*\{\s*fill:\s*color-mix\(in srgb, var\(--stem-color\) var\(--classification-active-fill\), transparent\);/);
  assert.match(css, /\.zodiac-sector\[data-zodiac-element\]\.is-active\s*\{[^}]*stroke-opacity:\s*1;/);
});

test("classification sectors use no CSS filters (4K drag cost)", () => {
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /filter:\s*brightness/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /backdrop-filter:\s*blur/);
});

test("legend keys show the encoding itself: element swatches and modality line samples", () => {
  assert.match(css, /\.classification-keys i::before\s*\{[^}]*background:\s*var\(--key-color, transparent\);/);
  assert.match(css, /\[data-zodiac-modality-key="固定"\]::before \{ border-top-style: dotted; \}/);
  assert.match(css, /\[data-zodiac-modality-key="變動"\]::before \{ border-top-style: dashed; \}/);
});

test("tablet and mobile move the legend below the wheel instead of over the Four Pillars card", () => {
  const tablet = css.slice(css.indexOf("@media (min-width: 481px) and (max-width: 820px)"), css.indexOf("@media (max-width: 480px)"));
  assert.match(tablet, /top:\s*calc\(100% \+ 10px\);/);
  assert.match(mobile, /top:\s*calc\(100% \+ 8px\);/);
  assert.match(mobile, /margin-bottom:\s*108px;/);
});
