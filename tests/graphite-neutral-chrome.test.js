import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const boundaries = readFileSync(new URL("../kinetic-boundaries.css", import.meta.url), "utf8");
const inspector = readFileSync(new URL("../ganzhi-inspector.css", import.meta.url), "utf8");
const visibleTenGods = readFileSync(new URL("../atlas-visible-ten-gods.css", import.meta.url), "utf8");
const instrumentFirst = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");
const analysisFirst = readFileSync(new URL("../analysis-first-screen.css", import.meta.url), "utf8");
const palette = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");

function rejectLegacy(source, legacyValues) {
  for (const legacy of legacyValues) {
    assert.doesNotMatch(source, new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
}

test("Graphite M2 boundary chrome is neutral rather than moss-green", () => {
  rejectLegacy(boundaries, [
    "#7f8982",
    "#d7ddd8",
    "#111512",
    "#68726b",
    "#5f6962",
    "#778078",
    "#778179",
    "#cbd1cc",
    "rgba(15,19,16,.78)",
    "rgba(238, 242, 237, .13)",
    "rgba(238, 242, 237, .27)"
  ]);

  assert.match(boundaries, /\.boundary-meta \{[\s\S]*?color:\s*#85898a;/);
  assert.match(boundaries, /#guide-layer \.guide-arc \{ stroke: rgba\(236, 239, 239, \.13\); \}/);
  assert.match(boundaries, /\.reference-frame-control \{[\s\S]*?color:\s*#7a7f80;/);
  assert.match(boundaries, /\.reference-frame-control select \{[\s\S]*?background:\s*rgba\(15,17,18,\.78\);/);
});

test("Analysis-only inspector and visible-stem chrome consume neutral M2 surfaces", () => {
  rejectLegacy(inspector, [
    "#313b34",
    "rgba(19, 25, 21, .97)",
    "rgba(19, 25, 21, .96)",
    "#28312b",
    "#758078",
    "#77837b",
    "#87968c",
    "rgba(151, 168, 157, .09)",
    "#8b9b90",
    "#9eada3",
    "#2a332d"
  ]);
  rejectLegacy(visibleTenGods, [
    "rgba(199,217,205,.14)",
    "rgba(12,16,13,.46)",
    "#758077",
    "#778179",
    "#aab6ae",
    "#707b73"
  ]);

  assert.match(inspector, /\.ganzhi-inspector \{[\s\S]*?border:\s*1px solid var\(--m2-raised-border\);[\s\S]*?background:\s*var\(--m2-raised-surface\);/);
  assert.match(inspector, /\.ganzhi-inspector-grid > span\.active \{[\s\S]*?background:\s*rgba\(157, 162, 163, \.09\);/);
  assert.match(visibleTenGods, /\.atlas-visible-ten-gods \{[\s\S]*?border:\s*1px solid var\(--m2-recessed-border\);[\s\S]*?background:\s*var\(--m2-recessed-surface\);/);
});

test("instrument-first and Analysis controls keep neutral Graphite M2 chrome", () => {
  rejectLegacy(instrumentFirst, [
    "rgba(199, 217, 205, .08)",
    "#68726b",
    "#707a73",
    "#b9c3bc",
    "#e5ece7",
    "rgba(199, 217, 205, .68)",
    "#77817a",
    "#d7dfd9"
  ]);

  assert.match(instrumentFirst, /data-analysis-open="true"\]\s*\{[\s\S]*?box-shadow:\s*inset 0 0 0 1px rgba\(236, 239, 239, \.055\);/);
  assert.match(instrumentFirst, /\.instant-field \{[\s\S]*?color:\s*#6f7475;/);
  assert.match(
    instrumentFirst,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.scale-button,[\s\S]*?display:\s*none;/
  );
  assert.match(
    analysisFirst,
    /#kinetic-instrument\[data-analysis-open="true"\] \.control-button,[\s\S]*?#kinetic-instrument\[data-analysis-open="true"\] \.scale-button\s*\{[\s\S]*?color:\s*#85898a;[\s\S]*?background:\s*transparent;/
  );
  assert.match(
    analysisFirst,
    /#kinetic-instrument\[data-analysis-open="true"\] \.scale-button\.active,[\s\S]*?color:\s*#e2e4e3;[\s\S]*?box-shadow:\s*inset 0 -1px rgba\(235,238,236,\.48\);/
  );
  assert.match(instrumentFirst, /#now-button \{[\s\S]*?color:\s*#7a7f80;/);
});

test("neutral chrome does not disturb the matte material or warm semantic channels", () => {
  assert.doesNotMatch(boundaries, /filter:\s*url\(|feTurbulence|background-image:\s*url\(/);
  assert.match(boundaries, /#kinetic-wheel\[data-active-ring="solar"\][\s\S]*?rgba\(244, 230, 183, \.58\)/);
  assert.match(palette, /--solar:\s*#ac906e;/);
  assert.match(palette, /--cursor:\s*#f4dda0;/);
});
