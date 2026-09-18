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

test("the wheel-native result is one compact recessed M2 instrument readout", () => {
  assert.match(css, /^@import "\.\/graphite-m2-material\.css";/);
  assert.match(
    css,
    /\.inverse-time-search-readout\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?width:\s*min\(620px, calc\(100% - 32px\)\);[\s\S]*?grid-template-columns:/
  );
  assert.match(
    css,
    /\.inverse-time-search-readout\s*\{[\s\S]*?border-top:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?border-bottom:\s*1px solid var\(--m2-etched-light-soft\);[\s\S]*?background:\s*var\(--m2-recessed-surface\);[\s\S]*?background-image:\s*var\(--m2-recessed-rail-gradient\);[\s\S]*?box-shadow:\s*var\(--m2-recessed-rail-shadow\);[\s\S]*?backdrop-filter:\s*none;/
  );
  assert.doesNotMatch(css, /\.inverse-time-search-readout\s*\{[^}]*border-radius:/s);
  assert.doesNotMatch(css, /\.inverse-time-search-readout\s*\{[^}]*backdrop-filter:\s*blur\(/s);
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


test("390px find-time owns the mobile tool surface instead of inheriting Tools chrome", () => {
  assert.match(
    css,
    /data-inverse-time-search="active"\] \.instrument-toolbar\s*\{[\s\S]*?justify-content:\s*flex-end;/
  );
  for (const selector of [
    ".instrument-toolbar > .toolbar-group:first-child",
    "#classification-overlay-button",
    "#now-button",
    "#play-button",
    ".ring-legend",
    ".classification-overlay-legend",
    ".atlas-visible-ten-gods",
    ".analysis-close"
  ]) {
    assert.match(
      css,
      new RegExp(`#kinetic-instrument\\[data-inverse-time-search="active"\\] ${selector.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")}`)
    );
  }
  assert.match(
    css,
    /data-inverse-time-search="active"\] \.instrument-toolbar > \.toolbar-group:last-child\s*\{[\s\S]*?margin-left:\s*auto;/
  );
  assert.match(
    css,
    /data-inverse-time-search="active"\] \.inverse-time-search-readout\s*\{[\s\S]*?top:\s*42px;/
  );
});
