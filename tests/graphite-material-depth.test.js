import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const material = readFileSync(new URL("../graphite-m2-material.css", import.meta.url), "utf8");
const inspector = readFileSync(new URL("../ganzhi-inspector.css", import.meta.url), "utf8");
const visibleTenGods = readFileSync(new URL("../atlas-visible-ten-gods.css", import.meta.url), "utf8");
const analysisPolish = readFileSync(new URL("../analysis-first-screen-polish.css", import.meta.url), "utf8");
const radialHierarchy = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const instrument = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");
const palette = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");

test("Graphite M2 exposes one semantic material hierarchy", () => {
  assert.match(material, /--m2-base-surface:\s*transparent;/);
  assert.match(material, /--m2-base-shadow:\s*none;/);
  assert.match(material, /--m2-raised-surface:\s*#121415;/);
  assert.match(material, /--m2-raised-gradient:[\s\S]*?linear-gradient\(180deg,/);
  assert.match(material, /--m2-raised-shadow:[\s\S]*?0 30px 76px rgba\(0,0,0,\.42\),[\s\S]*?inset 0 1px 0 rgba\(236,239,239,\.055\)/);
  assert.match(material, /--m2-recessed-surface:\s*rgba\(9,11,12,\.62\);/);
  assert.match(material, /--m2-recessed-gradient:[\s\S]*?linear-gradient\(180deg,/);
  assert.match(material, /--m2-recessed-shadow:[\s\S]*?inset 0 2px 5px rgba\(0,0,0,\.34\)/);
  assert.match(material, /--m2-recessed-rail-shadow:[\s\S]*?inset 0 2px 4px rgba\(0,0,0,\.30\)/);
  assert.match(material, /--m2-etched-dark:\s*rgba\(0,0,0,\.62\);/);
  assert.match(material, /--m2-etched-light:\s*rgba\(236,239,239,\.03\);/);
});

test("Graphite M2 reserves raised depth for the floating inspector", () => {
  assert.match(inspector, /^@import "\.\/graphite-m2-material\.css";/);
  assert.match(
    inspector,
    /\.ganzhi-inspector \{[\s\S]*?border:\s*1px solid var\(--m2-raised-border\);[\s\S]*?background:\s*var\(--m2-raised-surface\);[\s\S]*?background-image:\s*var\(--m2-raised-gradient\);[\s\S]*?box-shadow:\s*var\(--m2-raised-shadow\);[\s\S]*?backdrop-filter:\s*none;/
  );
  assert.doesNotMatch(inspector, /backdrop-filter:\s*blur\(/i);
});

test("compact evidence consumes the recessed graphite surface tokens", () => {
  assert.match(
    visibleTenGods,
    /\.atlas-visible-ten-gods \{[\s\S]*?border:\s*1px solid var\(--m2-recessed-border\);[\s\S]*?background:\s*var\(--m2-recessed-surface\);[\s\S]*?background-image:\s*var\(--m2-recessed-gradient\);[\s\S]*?box-shadow:\s*var\(--m2-recessed-shadow\);/
  );
});

test("desktop Analysis consumes recessed rails and etched edges without floating chrome", () => {
  assert.match(
    analysisPolish,
    /@media \(min-width: 821px\)[\s\S]*?#kinetic-instrument\[data-analysis-open="true"\] \.atlas-visible-ten-gods\s*\{[\s\S]*?border-top:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*var\(--m2-recessed-rail-gradient\);[\s\S]*?box-shadow:\s*var\(--m2-recessed-rail-shadow\);[\s\S]*?backdrop-filter:\s*none;/
  );
  assert.match(
    analysisPolish,
    /\.classification-overlay-legend\s*\{[\s\S]*?border-left:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?background:\s*var\(--m2-recessed-rail-gradient\);[\s\S]*?box-shadow:\s*var\(--m2-recessed-side-shadow\);/
  );
});

test("wheel structure uses etched M2 edges without beveling temporal sectors", () => {
  assert.match(radialHierarchy, /^@import "\.\/graphite-m2-material\.css";/);
  assert.match(
    radialHierarchy,
    /#hour-track \.ring-tick\.major,[\s\S]*?#year-track \.ring-tick\.major \{[\s\S]*?stroke:\s*var\(--m2-etched-dark-soft\);[\s\S]*?filter:\s*drop-shadow\(0 1px 0 var\(--m2-etched-light\)\);/
  );
  assert.match(
    radialHierarchy,
    /#guide-layer \.guide-arc:not\(\.annual-subdivide\) \{[\s\S]*?stroke:\s*var\(--m2-etched-dark-soft\);[\s\S]*?filter:\s*drop-shadow\(0 1px 0 var\(--m2-etched-light-soft\)\);/
  );
  assert.match(radialHierarchy, /\.cycle-sector\.is-active \{\s*stroke:\s*none;/);
  assert.match(radialHierarchy, /#solar-track \.term-sector \{[\s\S]*?stroke:\s*none;/);
  assert.match(
    radialHierarchy,
    /#guide-layer \.guide-arc\.annual-subdivide \{[\s\S]*?stroke:\s*color-mix\(in srgb, var\(--solar\) 10%, transparent\);/
  );
});

test("material depth stays procedural and does not become visible texture chrome", () => {
  for (const source of [material, inspector, visibleTenGods, analysisPolish, radialHierarchy]) {
    assert.doesNotMatch(source, /feTurbulence|filter:\s*url\(|background(?:-image)?:\s*url\(/i);
    assert.doesNotMatch(source, /repeating-(?:linear|radial)-gradient/i);
  }
});

test("material hierarchy does not resurrect a card around the wheel", () => {
  assert.match(instrument, /\.instrument-shell\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.doesNotMatch(instrument, /#kinetic-wheel\s*\{[^}]*box-shadow:/s);
});

test("Graphite hierarchy leaves warm semantic channels untouched", () => {
  assert.match(palette, /--solar:\s*#bc9257;/);
  assert.match(palette, /--cursor:\s*#f4dda0;/);
});
