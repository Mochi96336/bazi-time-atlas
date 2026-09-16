import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mobileCss = readFileSync(new URL("../mobile-time.css", import.meta.url), "utf8");
const instrumentCss = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("ordinary mobile reading has one textual exact-time surface", () => {
  assert.match(
    mobileCss,
    /@media \(max-width: 480px\)[\s\S]*?#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.instrument-readout\s*\{\s*display:\s*none;/
  );
  assert.match(html, /id="mobile-time-dock"[\s\S]*?id="mobile-instant-input"[\s\S]*?id="mobile-time-apply"/);
});

test("ordinary rail flattening stays with instrument-first while Analysis keeps the structured mobile dock", () => {
  assert.match(
    mobileCss,
    /\.mobile-time-dock\s*\{[\s\S]*?border:\s*1px solid var\(--hairline\);[\s\S]*?border-radius:\s*15px;[\s\S]*?background:\s*rgba\(255,255,255,\.022\);/
  );
  assert.match(
    instrumentCss,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \+ \.mobile-time-dock\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;/
  );
});

test("mobile delegates Selected Instant caption ownership to instrument-first", () => {
  assert.doesNotMatch(mobileCss, /\.cursor-note/);
  assert.match(
    instrumentCss,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #cursor-layer \.cursor-note\s*\{\s*display:\s*none;/
  );
});

test("Analysis retains the diagnostic instrument readout on mobile", () => {
  assert.doesNotMatch(
    mobileCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-readout\s*\{[^}]*display:\s*none;/s
  );
});
