import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mobileCss = readFileSync(new URL("../mobile-time.css", import.meta.url), "utf8");
const instrumentCss = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");
const solarAnalysis = readFileSync(new URL("../src/atlas-solar-time-analysis.js", import.meta.url), "utf8");
const mobileController = readFileSync(new URL("../src/mobile-time-control.js", import.meta.url), "utf8");
const mobileFixture = readFileSync(new URL("../scripts/fixtures/mobile-390.html", import.meta.url), "utf8");
const mobileProbe = readFileSync(new URL("../scripts/check-mobile-zodiac-datum.mjs", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("ordinary mobile reading has one textual exact-time surface", () => {
  assert.match(
    mobileCss,
    /@media \(max-width: 480px\)[\s\S]*?#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.instrument-readout\s*\{\s*display:\s*none;/
  );
  assert.match(html, /id="mobile-time-dock"[^>]*data-dirty="false"[\s\S]*?id="mobile-instant-input"[\s\S]*?id="mobile-time-apply"/);
  assert.match(
    instrumentCss,
    /\.mobile-time-dock\[data-dirty="false"\]\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?\.mobile-time-dock\[data-dirty="false"\] #mobile-time-apply\s*\{\s*display:\s*none;/
  );
});

test("mobile ordinary Zodiac classification joins existing exact-time rail without duplicating it", () => {
  assert.match(html, /id="mobile-time-dock"[\s\S]*?id="mobile-instant-input"[\s\S]*?id="mobile-time-apply"[\s\S]*?id="mobile-zodiac-readout" aria-live="off" hidden/);
  assert.match(mobileController, /const activeZodiac = instrument\.dataset\.zodiac\?\.trim\(\) \?\? ""/);
  assert.match(mobileController, /zodiacReadout\.textContent = activeZodiac \? `黃道 · \$\{activeZodiac\}`/);
  assert.match(mobileController, /attributeFilter:\[[^\]]*"data-zodiac"\]/);
  assert.match(instrumentCss, /#mobile-zodiac-readout \{ display: none; \}/);
  assert.match(instrumentCss, /:not\(\[data-classification-overlay="on"\]\)[\s\S]*?\.mobile-time-dock\[data-dirty="false"\] #mobile-zodiac-readout:not\(\[hidden\]\)/);
  assert.match(instrumentCss, /#mobile-zodiac-readout:not\(\[hidden\]\)[\s\S]*?font-size:\s*12px/);
  assert.equal((html.match(/id="mobile-zodiac-readout"/g) ?? []).length, 1);
});

test("real 390 browser fixture tests applied, dirty and categorical visibility states", () => {
  assert.match(mobileFixture, /exerciseZodiac = params\.get\("exerciseZodiac"\) === "1"/);
  for (const field of ["zodiacInitialMatches", "zodiacInitialVisible", "zodiacDirtyHidden",
    "zodiacApplyRestored", "zodiacClassificationHidden", "zodiacAnalysisHidden"]) {
    assert.ok(mobileFixture.includes("probe.dataset." + field), field);
    const htmlAttribute = field.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
    assert.ok(mobileProbe.includes('"' + htmlAttribute + '"'), htmlAttribute);
  }
});

test("ordinary rail flattening survives Analysis siblings inserted after the instrument", () => {
  assert.match(
    mobileCss,
    /\.mobile-time-dock\s*\{[\s\S]*?border:\s*1px solid var\(--hairline\);[\s\S]*?border-radius:\s*15px;[\s\S]*?background:\s*rgba\(255,255,255,\.022\);/
  );
  assert.match(
    solarAnalysis,
    /instrument\.insertAdjacentElement\("afterend",\s*panel\)/,
    "Analysis is allowed to insert a sibling between the instrument and downstream docks"
  );
  assert.match(
    instrumentCss,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.mobile-time-dock\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;/
  );
  assert.doesNotMatch(
    instrumentCss,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \+ \.mobile-time-dock/,
    "ordinary rail styling must not require direct adjacency"
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
