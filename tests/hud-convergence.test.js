import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analysisCss = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");
const atlasCss = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");
const mobileLegendCss = readFileSync(new URL("../mobile-legend.css", import.meta.url), "utf8");
const classificationCss = readFileSync(new URL("../classification-overlay.css", import.meta.url), "utf8");

test("small inner-ring identities keep a dedicated legibility floor without altering material color", () => {
  assert.ok(atlasCss.includes("--identity-hour: color-mix(in srgb, var(--hour) 50%, var(--ink))"));
  assert.ok(atlasCss.includes("--identity-day: color-mix(in srgb, var(--day) 57%, var(--ink))"));
});

test("normal reading view turns the layer legend into fixed ring identity labels", () => {
  assert.match(analysisCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.ring-legend \{[\s\S]*?inset:\s*0;[\s\S]*?display:\s*block;/);
  assert.match(analysisCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.ring-legend-row \{[\s\S]*?position:\s*absolute;/);
  assert.match(analysisCss, /\.ring-legend-row i,[\s\S]*?\.ring-legend-row strong \{\s*display:\s*none;/);

  for (const label of ["年", "月", "太陽", "日", "時"]) {
    assert.match(analysisCss, new RegExp(`content:\\s*"${label}"`));
  }
});

test("direct ring identities derive readable text from the same semantic material channels", () => {
  for (const role of ["year", "month", "solar", "day", "hour"]) {
    assert.match(
      analysisCss,
      new RegExp(`\\.ring-${role} span \\{ color: var\\(--identity-${role}, var\\(--${role},`),
      `${role} direct label must consume its readability token with the material role as fallback`
    );
  }
});

test("direct ring identities remain readable without becoming chips, leaders, or cards", () => {
  assert.match(
    analysisCss,
    /\.ring-legend-row span\s*\{[\s\S]*?display:\s*inline-block;[\s\S]*?opacity:\s*\.96;/
  );
  assert.match(
    analysisCss,
    /\.ring-legend-row span::after\s*\{[\s\S]*?font-size:\s*10px;[\s\S]*?font-weight:\s*850;/
  );
  assert.match(
    analysisCss,
    /\.ring-legend-row span::after\s*\{[\s\S]*?text-shadow:\s*0 0 3px var\(--field\),\s*0 1px 7px rgba\(0,0,0,\.94\);/,
    "fixed identities need a tight cardless halo where moving sector labels cross their spoke"
  );
  assert.doesNotMatch(
    analysisCss,
    /\.ring-legend-row span::before\s*\{/,
    "fixed identities must not grow leader chrome that reads like a sector tick"
  );
  assert.doesNotMatch(
    analysisCss,
    /\.ring-legend-row span\s*\{[^}]*background:/s,
    "fixed identities should not grow another card surface"
  );
  assert.match(
    analysisCss,
    /@media \(max-width: 480px\)[\s\S]*?\.ring-legend-row span::after\s*\{[\s\S]*?font-size:\s*10px;/
  );
});

test("mobile fixed identities use an inner-edge quiet lane away from moving values", () => {
  assert.match(
    analysisCss,
    /@media \(max-width: 480px\)[\s\S]*?#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.ring-legend-row \{[\s\S]*?transform:\s*rotate\(-9deg\);[\s\S]*?margin:\s*26px 0 0 4px;/,
    "mobile fixed identities need enough radial separation to stay off the moving sector-label midpoint"
  );
});

test("analysis mode retains the interactive layer legend instead of duplicating a second control surface", () => {
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend-row\[data-ring-toggle\] \{\s*pointer-events:\s*auto;/
  );
  assert.doesNotMatch(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend\s*\{[^}]*display:\s*none;/s
  );
});

test("mobile Tools retires reference-frame and layer chrome into one product row", () => {
  assert.match(
    mobileLegendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend-row\[data-ring-toggle\],[\s\S]*?#kinetic-instrument\[data-analysis-open="true"\] \.reference-frame-control \{\s*display:\s*none\s*!important;/
  );
  assert.match(
    mobileLegendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar \{\s*right:\s*56px;/
  );
  assert.match(
    mobileLegendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.analysis-close \{[\s\S]*?top:\s*10px;[\s\S]*?right:\s*9px;[\s\S]*?min-height:\s*42px;/
  );
  assert.doesNotMatch(mobileLegendCss, /^\s*\.ring-legend\s*\{/m);
});

test("mobile classification evidence is flat instead of another rounded card", () => {
  const mobile = classificationCss.match(/@media \(max-width: 480px\) \{([\s\S]*)\}\s*$/)?.[1] ?? "";
  assert.match(
    mobile,
    /\.classification-overlay-legend \{[\s\S]*?border:\s*0;[\s\S]*?border-top:\s*1px solid rgba\(238,242,237,\.10\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/
  );
  assert.match(mobile, /\.classification-keys i \{[\s\S]*?border-radius:\s*2px;/);
  assert.match(mobile, /\.classification-current \{\s*display:none;/);
  assert.match(mobile, /\.classification-row header span \{[^}]*font-size:\s*8\.5px;/);
  assert.match(mobile, /\.classification-row header small \{[^}]*font-size:\s*6\.5px;/);
  assert.match(mobile, /\.classification-keys i \{[\s\S]*?height:\s*17px;[\s\S]*?font-size:\s*7\.5px;/);
  assert.match(mobile, /\.classification-warning \{[\s\S]*?font-size:\s*7px;/);
  assert.match(mobile, /margin-bottom:\s*108px;/, "reserve enough scroll band for readable classification evidence");
});

test("duplicate state strip leaves ordinary reading but remains available in Analysis", () => {
  assert.match(
    analysisCss,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.state-strip \{\s*display:\s*none;/
  );
  assert.match(
    analysisCss,
    /#kinetic-instrument\[data-analysis-open="true"\] ~ \.state-strip \{\s*display:\s*grid;/
  );
});
