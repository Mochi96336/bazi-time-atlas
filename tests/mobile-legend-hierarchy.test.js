import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const layoutCss = readFileSync(new URL("../mobile-legend.css", import.meta.url), "utf8");

function mobile480Block(source) {
  const marker = "@media (max-width: 480px)";
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, "480px mobile hierarchy block must exist");
  return source.slice(index);
}

test("mobile legend keeps per-ring hierarchy ink instead of flattening every value", () => {
  assert.match(css, /\.ring-year strong\s*\{[^}]*color:\s*#dfe2e0;[^}]*font-weight:\s*800;/s);
  assert.match(css, /\.ring-month strong\s*\{[^}]*color:\s*#d4d7d5;[^}]*font-weight:\s*760;/s);
  assert.match(css, /\.ring-solar strong\s*\{[^}]*color:\s*#c4b394;[^}]*font-weight:\s*700;/s);
  assert.match(css, /\.ring-day strong,\s*\.ring-hour strong\s*\{[^}]*color:\s*#9ca19f;[^}]*font-weight:\s*660;/s);

  const mobile = mobile480Block(css);
  const strongRule = mobile.match(/\.ring-legend-row strong\s*\{([^}]*)\}/s);
  assert.ok(strongRule, "mobile legend value sizing rule must exist");
  assert.match(strongRule[1], /font-size:\s*9px;/);
  assert.doesNotMatch(strongRule[1], /\bcolor\s*:/, "mobile rule must not erase per-ring color hierarchy");
  assert.doesNotMatch(strongRule[1], /\bfont-weight\s*:/, "mobile rule must not erase per-ring weight hierarchy");
});

test("mobile Tools retires reference-frame and layer chrome while reading view keeps direct identities", () => {
  const mobile = mobile480Block(layoutCss);
  const analysis = "#kinetic-instrument\\[data-analysis-open=\\\"true\\\"\\]";
  assert.match(mobile, new RegExp(`${analysis} \\.ring-legend-row\\[data-ring-toggle\\],[^}]*${analysis} \\.reference-frame-control \\{\\s*display:\\s*none\\s*!important;`, "s"));
  assert.match(mobile, new RegExp(`${analysis} \\.instrument-toolbar \\{\\s*right:\\s*56px;`));
  assert.match(mobile, new RegExp(`${analysis} \\.analysis-close \\{[^}]*top:\\s*10px;[^}]*right:\\s*9px;[^}]*min-height:\\s*42px;`, "s"));
  assert.doesNotMatch(mobile, /^\s*\.ring-legend\s*\{/m, "mobile layout must not own normal reading legend geometry");
});
