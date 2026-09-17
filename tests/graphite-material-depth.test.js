import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inspector = readFileSync(new URL("../ganzhi-inspector.css", import.meta.url), "utf8");
const visibleTenGods = readFileSync(new URL("../atlas-visible-ten-gods.css", import.meta.url), "utf8");
const analysisPolish = readFileSync(new URL("../analysis-first-screen-polish.css", import.meta.url), "utf8");
const instrument = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");
const palette = readFileSync(new URL("../kinetic-atlas.css", import.meta.url), "utf8");

test("Graphite M2 floating and compact surfaces gain restrained optical depth", () => {
  assert.match(inspector, /\.ganzhi-inspector \{[\s\S]*?background:\s*rgba\(18, 20, 21, \.97\);[\s\S]*?background-image:\s*linear-gradient\(180deg,[\s\S]*?box-shadow:[\s\S]*?0 28px 72px rgba\(0,0,0,\.38\),[\s\S]*?inset 0 1px 0 rgba\(236,239,239,\.035\),[\s\S]*?inset 0 -1px 0 rgba\(0,0,0,\.32\);/);
  assert.match(visibleTenGods, /\.atlas-visible-ten-gods \{[\s\S]*?background:\s*rgba\(12,14,15,\.46\);[\s\S]*?background-image:\s*linear-gradient\(180deg,[\s\S]*?box-shadow:[\s\S]*?0 10px 26px rgba\(0,0,0,\.10\),[\s\S]*?inset 0 1px 0 rgba\(236,239,239,\.025\),[\s\S]*?inset 0 -1px 0 rgba\(0,0,0,\.24\);/);
});

test("desktop Analysis keeps the Ten-Gods evidence rail flat", () => {
  assert.match(
    analysisPolish,
    /@media \(min-width: 821px\)[\s\S]*?#kinetic-instrument\[data-analysis-open="true"\] \.atlas-visible-ten-gods\s*\{[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;[\s\S]*?backdrop-filter:\s*none;/
  );
});

test("material depth stays procedural and does not become visible texture chrome", () => {
  for (const source of [inspector, visibleTenGods]) {
    assert.doesNotMatch(source, /feTurbulence|filter:\s*url\(|background(?:-image)?:\s*url\(/i);
    assert.doesNotMatch(source, /repeating-(?:linear|radial)-gradient/i);
  }
});

test("material polish does not resurrect a card around the wheel", () => {
  assert.match(instrument, /\.instrument-shell\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.doesNotMatch(instrument, /#kinetic-wheel\s*\{[^}]*box-shadow:/s);
});

test("Graphite depth leaves warm semantic channels untouched", () => {
  assert.match(palette, /--solar:\s*#bc9257;/);
  assert.match(palette, /--cursor:\s*#f4dda0;/);
});
