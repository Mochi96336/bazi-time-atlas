import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const fixture = readFileSync(new URL("../scripts/fixtures/home-h24-responsive.html",import.meta.url),"utf8");
const runner = readFileSync(new URL("../scripts/check-home-h24-responsive.mjs",import.meta.url),"utf8");
const page = readFileSync(new URL("../index.html",import.meta.url),"utf8");
const controller = readFileSync(new URL("../src/mobile-time-control.js",import.meta.url),"utf8");

test("H2.4 uses real iframe widths across 480/481 hand-off",()=>{
  assert.match(runner,/const mobileWidths = \[320, 360, 390, 430, 480\]/);
  assert.match(runner,/const widths = \[\.\.\.mobileWidths, 481\]/);
  assert.match(fixture,/stage\.style\.width = width \+ "px"/);
  assert.match(fixture,/win\.innerWidth/);
  assert.match(fixture,/matchMedia\("\(max-width: 480px\)"\)/);
});

test("H2.4 probes one time/action row with dirty action swap and no Zodiac duplicate",()=>{
  assert.doesNotMatch(page,/id="mobile-zodiac-readout"/);
  assert.doesNotMatch(controller,/zodiacReadout/);
  assert.match(fixture,/doc\.querySelector\("#state-zodiac"\)/);
  assert.match(fixture,/new win\.CustomEvent\("atlas:set-selected-instant"/);
  assert.match(fixture,/instrument\.dataset\.zodiac!==previous/);
  assert.match(fixture,/wheelZodiac\.textContent\.trim\(\)===instrument\.dataset\.zodiac/);
  for(const key of [
    "same-row","now-fits","status-offscreen","no-duplicate-zodiac",
    "dirty-swap","reapplied","future-wheel-synced","classification-one-row","analysis-one-row"
  ]) assert.ok(runner.includes('"'+key+'"'),key);
  assert.match(fixture,/sameRow\(input,apply\)/);
  assert.match(fixture,/!visible\(win,now\) && visible\(win,apply\)/);
  assert.match(runner,/"home-h24-responsive-evidence\.json"/);
  assert.doesNotMatch(runner,/beautyScore|aestheticRating/);
});

test("H2.4 mutation audit never changes the default screenshot session",()=>{
  assert.match(fixture,/const runAudit = params\.get\("audit"\) === "1"/);
  assert.match(fixture,/if \(!runAudit\) return/);
  assert.match(runner,/targetUrl\(width, true\)/);
  assert.match(runner,/targetUrl\(width, false\)/);
});
