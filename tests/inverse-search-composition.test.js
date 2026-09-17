import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../inverse-time-search.css", import.meta.url), "utf8");

test("inverse search is a centered working rail rather than a full-width control wall", () => {
  assert.match(
    css,
    /\.inverse-time-search-panel\s*\{[\s\S]*?width:\s*min\(960px,\s*calc\(100% - 40px\)\);[\s\S]*?margin:\s*26px auto 12px;[\s\S]*?padding:\s*20px 0 8px;/
  );
  assert.doesNotMatch(css, /\.inverse-time-search-panel\s*\{[^}]*background:/s);
  assert.doesNotMatch(css, /\.inverse-time-search-panel\s*\{[^}]*border-radius:/s);
});

test("desktop separates constraints, utility actions and search authority", () => {
  assert.match(
    css,
    /\.inverse-search-constraints\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);[\s\S]*?gap:\s*14px 20px;[\s\S]*?margin-top:\s*20px;/
  );
  assert.match(
    css,
    /\.inverse-search-actions\s*\{[\s\S]*?grid-template-columns:\s*auto auto minmax\(150px, 1fr\) auto;[\s\S]*?gap:\s*10px 18px;[\s\S]*?margin-top:\s*18px;/
  );
  assert.match(css, /\.inverse-search-range\s*\{[\s\S]*?width:\s*160px;[\s\S]*?justify-self:\s*end;/);
});

test("390px composition uses a deliberate two-column control rhythm", () => {
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(
    css,
    /@media \(max-width: 480px\) \{[\s\S]*?\.inverse-search-constraints\s*\{[\s\S]*?gap:\s*12px 14px;[\s\S]*?margin-top:\s*16px;/
  );
  assert.match(
    css,
    /@media \(max-width: 480px\) \{[\s\S]*?\.inverse-search-actions\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*?gap:\s*10px 12px;[\s\S]*?margin-top:\s*16px;/
  );
  assert.match(css, /\[data-inverse-current\]\s*\{\s*grid-column:\s*1;/);
  assert.match(css, /\[data-inverse-clear\]\s*\{\s*grid-column:\s*2;/);
  assert.match(css, /\.inverse-search-range\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?width:\s*100%;/);
  assert.match(css, /\[data-inverse-run\]\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?min-width:\s*76px;/);
});

test("result rows gain readable separation without becoming cards", () => {
  assert.match(
    css,
    /\.inverse-search-result\s*\{[\s\S]*?gap:\s*14px;[\s\S]*?padding:\s*11px 4px;[\s\S]*?background:\s*transparent;/
  );
  assert.doesNotMatch(css, /\.inverse-search-result\s*\{[^}]*border-radius:/s);
  assert.doesNotMatch(css, /\.inverse-search-result\s*\{[^}]*box-shadow:/s);
});
