import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../inverse-time-search.css", import.meta.url), "utf8");
const view = readFileSync(new URL("../src/inverse-time-search-view.js", import.meta.url), "utf8");

test("find-time has no detached form panel or range picker", () => {
  assert.doesNotMatch(css, /inverse-time-search-panel|inverse-search-constraints|inverse-search-range/);
  assert.doesNotMatch(view, /data-inverse-pillar|data-inverse-range|搜尋範圍/);
  assert.doesNotMatch(view, /<select|<input/);
});

test("the wheel-native result is one compact instrument readout", () => {
  assert.match(
    css,
    /\.inverse-time-search-readout\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?width:\s*min\(620px, calc\(100% - 32px\)\);[\s\S]*?grid-template-columns:/
  );
  assert.doesNotMatch(css, /\.inverse-time-search-readout\s*\{[^}]*border-radius:/s);
  assert.doesNotMatch(css, /\.inverse-time-search-readout\s*\{[^}]*box-shadow:/s);
});

test("390px find-time stays a compact two-row overlay rather than a control wall", () => {
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(
    css,
    /@media \(max-width: 480px\) \{[\s\S]*?\.inverse-time-search-readout\s*\{[\s\S]*?width:\s*calc\(100% - 20px\);[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/
  );
  assert.match(css, /\.inverse-time-search-readout strong\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/);
});

test("the annual solar band is visually demoted while four pillar rings stay direct-manipulation targets", () => {
  assert.match(css, /data-inverse-time-search="active"\] #solar-track,[\s\S]*?#zodiac-track[\s\S]*?opacity:\s*\.38/);
  for (const id of ["year", "month", "day", "hour"]) {
    assert.match(css, new RegExp(`#${id}-track`));
  }
  assert.match(css, /cursor:\s*grab/);
});
