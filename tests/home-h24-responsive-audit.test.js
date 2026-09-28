import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture = readFileSync(new URL("../scripts/fixtures/home-h24-responsive.html", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/check-home-h24-responsive.mjs", import.meta.url), "utf8");
const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const controller = readFileSync(new URL("../src/mobile-time-control.js", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");

test("H2.4 tests actual iframe widths on both sides of the breakpoint", () => {
  assert.match(runner, /const mobileWidths = \[320, 360, 390, 430, 480\]/);
  assert.match(runner, /const widths = \[\.\.\.mobileWidths, 481\]/);
  assert.match(fixture, /stage\.style\.width = width \+ "px"/);
  assert.match(fixture, /win\.innerWidth/);
  assert.match(fixture, /matchMedia\("\(max-width: 480px\)"\)/);
});

test("H2.4 exercises the canonical selected-instant update instead of recalculating zodiac independently", () => {
  assert.match(fixture, /new win\.CustomEvent\("atlas:set-selected-instant"/);
  assert.match(fixture, /instrument\.dataset\.zodiac !== previous/);
  assert.match(fixture, /label\.textContent === "黃道 · " \+ instrument\.dataset\.zodiac/);
  assert.match(controller, /attributeFilter:\[[^\]]*"data-zodiac"\]/);
  assert.match(page, /id="mobile-zodiac-readout" aria-live="off" hidden/);
});

test("H2.4 detects real layout collisions and avoids reporting a subjective beauty score", () => {
  for (const key of ["no-overlap", "not-clipped", "input-usable", "future-no-overlap",
    "same-row", "now-visible", "now-fits", "now-aligned",
    "dirty-hidden", "classification-hidden", "analysis-hidden"]) {
    assert.ok(runner.includes('"' + key + '"'), key);
  }
  assert.match(mobileCss, /font-size:\s*12px/);
  assert.match(fixture, /const rDock = bounds\(dock\), rInput = bounds\(input\), rCaption = bounds\(label\), rNow = bounds\(nowButton\)/);
  assert.match(fixture, /rNow\.left >= rCaption\.right \+ 2/);
  assert.match(runner, /"home-h24-responsive-evidence\.json"/);
  assert.doesNotMatch(runner, /beautyScore|aestheticRating/);
});

test("H2.4 diagnostic is strictly opt-in and never changes the default screenshot session", () => {
  assert.match(fixture, /const runAudit = params\.get\("audit"\) === "1"/);
  assert.match(fixture, /if \(!runAudit\) return/);
  assert.match(runner, /targetUrl\(width, true\)/);
  assert.match(runner, /targetUrl\(width, false\)/);
});
