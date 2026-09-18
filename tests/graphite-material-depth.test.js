import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const material = readFileSync(new URL("../graphite-m2-material.css", import.meta.url), "utf8");
const inspector = readFileSync(new URL("../ganzhi-inspector.css", import.meta.url), "utf8");
const visibleTenGods = readFileSync(new URL("../atlas-visible-ten-gods.css", import.meta.url), "utf8");
const analysisPolish = readFileSync(new URL("../analysis-first-screen-polish.css", import.meta.url), "utf8");
const solarAnalysis = readFileSync(new URL("../atlas-solar-time-analysis.css", import.meta.url), "utf8");
const radialHierarchy = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const instrument = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");
const palette = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
const atlasHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8");

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

test("solar-time Analysis uses etched M2 structure without becoming another card", () => {
  assert.match(solarAnalysis, /^@import "\.\/graphite-m2-material\.css";/);
  assert.match(
    solarAnalysis,
    /\.atlas-solar-time-analysis \{[\s\S]*?border-top:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?border-bottom:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?box-shadow:[\s\S]*?inset 0 1px 0 var\(--m2-etched-light-soft\),[\s\S]*?inset 0 -1px 0 var\(--m2-etched-light-soft\);/
  );
  assert.match(
    solarAnalysis,
    /\.atlas-solar-longitude-field input \{[\s\S]*?border:\s*0;[\s\S]*?border-bottom:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*0 1px 0 var\(--m2-etched-light-soft\);/
  );
  assert.match(
    solarAnalysis,
    /\.atlas-solar-corrections \{[\s\S]*?border-top:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?box-shadow:\s*inset 0 1px 0 var\(--m2-etched-light-soft\);/
  );
  assert.match(
    solarAnalysis,
    /\.atlas-solar-basis-row \{[\s\S]*?border-top:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?box-shadow:\s*inset 0 1px 0 var\(--m2-etched-light-soft\);/
  );
  assert.doesNotMatch(solarAnalysis, /\.atlas-solar-time-analysis \{[^}]*background:/s);
  assert.doesNotMatch(solarAnalysis, /\.atlas-solar-time-analysis \{[^}]*border-radius:/s);
});

test("wheel structure uses etched M2 edges without beveling temporal sectors", () => {
  assert.match(radialHierarchy, /^@import "\.\/graphite-m2-material\.css";/);
  assert.match(
    radialHierarchy,
    /#hour-track \.ring-tick\.major,[\s\S]*?#year-track \.ring-tick\.major \{[\s\S]*?stroke:\s*rgba\(0,0,0,\.66\);[\s\S]*?filter:\s*drop-shadow\(0 1px 0 rgba\(236,239,239,\.075\)\);/
  );
  assert.match(
    radialHierarchy,
    /#guide-layer \.guide-arc:not\(\.annual-subdivide\) \{[\s\S]*?stroke:\s*url\(#m2-groove-stroke\);[\s\S]*?stroke-width:\s*2\.1;[\s\S]*?filter:\s*drop-shadow\(0 1\.35px 0 rgba\(236,239,239,\.085\)\);/
  );
  assert.match(radialHierarchy, /\.cycle-sector\.is-active \{\s*stroke:\s*none;/);
  assert.match(radialHierarchy, /#solar-track \.term-sector \{[\s\S]*?stroke:\s*none;/);
  assert.match(
    radialHierarchy,
    /#guide-layer \.guide-arc\.annual-subdivide \{[\s\S]*?stroke:\s*color-mix\(in srgb, var\(--solar\) 10%, transparent\);/
  );
});

test("material depth stays procedural and does not become visible texture chrome", () => {
  for (const source of [material, inspector, visibleTenGods, analysisPolish, solarAnalysis, radialHierarchy]) {
    assert.doesNotMatch(source, /feTurbulence|filter:\s*url\(|background(?:-image)?:\s*url\(/i);
    assert.doesNotMatch(source, /repeating-(?:linear|radial)-gradient/i);
  }
});

test("material hierarchy does not resurrect a card around the wheel", () => {
  assert.match(instrument, /\.instrument-shell\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.doesNotMatch(instrument, /#kinetic-wheel\s*\{[^}]*box-shadow:/s);
});
test("wheel surface depth comes from one light field and fixed material beds", () => {
  assert.match(
    instrument,
    /\.instrument-shell::before \{[\s\S]*?radial-gradient\(circle at 34% 12%, rgba\(236,239,239,\.035\), transparent 31rem\)[\s\S]*?linear-gradient\(145deg,[\s\S]*?rgba\(0,0,0,\.09\) 100%\);/
  );
  assert.match(instrument, /#kinetic-wheel \{ z-index:\s*1; \}/);
  assert.match(renderer, /function renderMaterialBeds\(\) \{[\s\S]*?SEXAGENARY_RING_IDS\.forEach\(id => \{[\s\S]*?annularSectorPath\(WHEEL_CENTER, model\.innerRadius, model\.outerRadius, FAN\.start, FAN\.end\)[\s\S]*?class: `m2-ring-bed m2-\$\{id\}-bed`/);
  assert.match(renderer, /function renderStatic\(\) \{\s*renderMaterialBeds\(\);\s*renderGuides\(\);/);
  for (const ring of ["hour", "day", "month", "year"]) {
    assert.match(radialHierarchy, new RegExp(`\\.m2-${ring}-bed \\{ fill: url\\(#m2-${ring}-surface\\); \\}`));
    assert.match(radialHierarchy, new RegExp(`\\.m2-${ring}-sheen \\{ opacity: \\.[0-9]+; \\}`));
    assert.match(atlasHtml, new RegExp(`id="m2-${ring}-surface"[^>]*gradientUnits="userSpaceOnUse"`));
    assert.doesNotMatch(atlasHtml, new RegExp(`id="m2-${ring}-active"`));
  }
  assert.match(renderer, /class: `m2-ring-sheen m2-\$\{id\}-sheen`/);
  assert.match(atlasHtml, /id="m2-surface-sheen"[\s\S]*?stop-opacity="\.16"[\s\S]*?stop-opacity="\.20"/);
  assert.match(atlasHtml, /id="m2-groove-stroke"[\s\S]*?stop-opacity="\.92"/);
  assert.match(radialHierarchy, /#m2-hour-surface \{[^}]*--m2-light-alpha:\s*\.24;/);
  assert.match(radialHierarchy, /#m2-year-surface \{[^}]*--m2-light-alpha:\s*\.36;/);
  assert.match(radialHierarchy, /#guide-layer \.guide-arc:not\(\.annual-subdivide\) \{[\s\S]*?stroke-width:\s*2\.1;/);
});


test("Graphite hierarchy leaves warm semantic channels untouched", () => {
  assert.match(palette, /--solar:\s*#bc9257;/);
  assert.match(palette, /--cursor:\s*#f4dda0;/);
  assert.match(
    solarAnalysis,
    /\.atlas-solar-longitude-field input:focus \{[\s\S]*?border-bottom-color:\s*color-mix\(in srgb, var\(--solar\) 72%, var\(--ink\)\);/
  );
  assert.match(
    solarAnalysis,
    /\.atlas-solar-basis-row b\[data-changed="1"\] \{[\s\S]*?color:\s*color-mix\(in srgb, var\(--solar\) 72%, var\(--ink\)\);/
  );
});
