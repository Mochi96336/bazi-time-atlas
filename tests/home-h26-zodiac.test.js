import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  H26_REFERENCE_SHA,H26_VARIANTS,H26_EXPECTED_TOKENS,
  H26_ZODIAC_STOP_OPACITY,h26OverrideCss
} from "../scripts/home-h26-zodiac-contract.js";

test("H2.6 optical study retains exact V0 and one isolated V1 stop-alpha change",()=>{
  assert.match(H26_REFERENCE_SHA,/^[a-f0-9]{40}$/);
  assert.deepEqual(Object.keys(H26_VARIANTS),["V0","V1"]);
  assert.equal(h26OverrideCss("V0"),"");
  assert.throws(()=>h26OverrideCss("not-a-case"));
  const css=h26OverrideCss("V1");
  const selectors=[
    "#m2-zodiac-hard-surface .m2-zodiac-light",
    "#m2-zodiac-hard-surface .m2-zodiac-mid",
    "#m2-zodiac-hard-surface .m2-zodiac-dark"
  ];
  for(const [i,s]of selectors.entries()){
    const at=css.indexOf(s);
    assert.ok(at>=0,"requires "+s);
    const match=css.slice(at+s.length).match(/^\s*\{\s*stop-opacity:\s*(\.[0-9]+);\s*\}/);
    assert.ok(match,"expected exact alpha-only CSS "+s);
    assert.equal(Number(match[1]),Number(Object.values(H26_ZODIAC_STOP_OPACITY.V1)[i]));
  }
  assert.equal((css.match(/stop-opacity:/g)||[]).length,3);
  assert.doesNotMatch(css,/stop-color|--zodiac|--field|--solar|filter|background|materialProbe|shader|gradient/i);
  assert.deepEqual(H26_ZODIAC_STOP_OPACITY.V0,{light:".25",mid:".19",dark:".18"});
  assert.equal(H26_EXPECTED_TOKENS.zodiac,"#424b59");
});

test("H2.6 code changes no production CSS, time/geometry or material shader",()=>{
  const css=readFileSync(new URL("../radial-hierarchy.css",import.meta.url),"utf8");
  const source=readFileSync(new URL("../src/wheel/material-prototype.js",import.meta.url),"utf8");
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  assert.match(css,/#m2-zodiac-hard-surface \.m2-zodiac-light \{\s*stop-color:[^\n]*;\s*stop-opacity: \.25;/);
  assert.match(css,/#m2-zodiac-hard-surface \.m2-zodiac-mid \{\s*stop-color:[^\n]*;\s*stop-opacity: \.19;/);
  assert.match(css,/#m2-zodiac-hard-surface \.m2-zodiac-dark \{\s*stop-color:[^\n]*;\s*stop-opacity: \.18;/);
  assert.match(source,/reflectionTint = vec3\(0\.37, 0\.44, 0\.51\)/);
  assert.doesNotMatch(source,/h26|h25ZodiacTint/);
  assert.doesNotMatch(html,/home-h26-zodiac|h26OverrideCss/);
});

test("H2.6 screenshots are native-width and proof includes screenshot-process CTM",()=>{
  const fixture=readFileSync(new URL("../scripts/fixtures/home-h26-zodiac-frame.html",import.meta.url),"utf8");
  const script=readFileSync(new URL("../scripts/visual-check-home-h26-zodiac.mjs",import.meta.url),"utf8");
  const workflow=readFileSync(new URL("../.github/workflows/home-h26-zodiac.yml",import.meta.url),"utf8");
  assert.match(fixture,/H2\.6 SCREENSHOT NOT READY/);
  assert.match(fixture,/stage\.style\.width=width\+"px"/);
  assert.match(fixture,/materialProbe","none"/);
  assert.match(fixture,/h26-zodiac-isolated-substrate/);
  assert.match(script,/readScreenshotCtm/);
  assert.match(script,/materialMasks/);
  assert.match(script,/baselineReplayIdentical/);
  assert.match(script,/noiseNonZodiac/);
  for(const width of ["320","390","1440","2047"])assert.ok(script.includes(width));
  for(const mode of ["roughness","svg","fallback"])assert.ok(script.includes('"'+mode+'"'));
  const prep=workflow.indexOf("npm run vendor:prepare");
  const capture=workflow.indexOf("run: node scripts/visual-check-home-h26-zodiac.mjs");
  assert.ok(prep>=0&&capture>prep);
});
