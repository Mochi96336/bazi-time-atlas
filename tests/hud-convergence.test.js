import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analysisCss = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");
const mobileLegendCss = readFileSync(new URL("../mobile-legend.css", import.meta.url), "utf8");

test("normal reading view turns the layer legend into fixed ring identity labels", () => {
  assert.match(analysisCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.ring-legend \{[\s\S]*?inset:\s*0;[\s\S]*?display:\s*block;/);
  assert.match(analysisCss, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.ring-legend-row \{[\s\S]*?position:\s*absolute;/);
  assert.match(analysisCss, /\.ring-legend-row i,[\s\S]*?\.ring-legend-row strong \{\s*display:\s*none;/);

  for (const label of ["年 · YEAR", "月 · MONTH", "太陽 · SOLAR", "日 · DAY", "時 · HOUR"]) {
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
