import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analysisCss = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");
const mobileLegendCss = readFileSync(new URL("../mobile-legend.css", import.meta.url), "utf8");

test("normal reading view turns the layer legend into fixed ring identity labels", () => {
  assert.match(analysisCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.ring-legend \{[\s\S]*?inset:\s*0;[\s\S]*?display:\s*block;/);
  assert.match(analysisCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.ring-legend-row \{[\s\S]*?position:\s*absolute;/);
  assert.match(analysisCss, /\.ring-legend-row i,[\s\S]*?\.ring-legend-row strong \{\s*display:\s*none;/);

  for (const label of ["年", "月", "太陽", "日", "時"]) {
    assert.match(analysisCss, new RegExp(`content:\\s*"${label}"`));
  }
});

test("direct ring identities consume the same semantic palette as the instrument", () => {
  for (const role of ["year", "month", "solar", "day", "hour"]) {
    assert.match(
      analysisCss,
      new RegExp(`\\.ring-${role} span \\{ color: var\\(--${role},`),
      `${role} direct label must consume its semantic color variable`
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
    /\.ring-legend-row span::after\s*\{[\s\S]*?text-shadow:\s*0 0 3px #0b0f0c,\s*0 1px 7px rgba\(0,0,0,\.94\);/,
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
    /@media \(max-width: 480px\)[\s\S]*?\.ring-legend-row span::after\s*\{[\s\S]*?font-size:\s*8px;/
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

test("mobile structured legend grid belongs to Analysis only", () => {
  assert.match(
    mobileLegendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-legend \{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/
  );
  assert.match(
    mobileLegendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.ring-solar \{\s*grid-column:\s*1 \/ -1;\s*grid-row:\s*2;/
  );
  assert.match(
    mobileLegendCss,
    /#kinetic-instrument\[data-analysis-open="true"\] \.reference-frame-control \{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?grid-row:\s*3;/
  );
  assert.doesNotMatch(mobileLegendCss, /^\s*\.ring-legend\s*\{/m);
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
