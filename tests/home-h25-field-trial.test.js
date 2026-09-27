import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const atlas=readFileSync(new URL("../kinetic-atlas.css",import.meta.url),"utf8");
const shader=readFileSync(new URL("../src/wheel/material-prototype.js",import.meta.url),"utf8");
const h24=readFileSync(new URL("../scripts/fixtures/home-h24-responsive.html",import.meta.url),"utf8");
const classification=readFileSync(new URL("../classification-overlay.css",import.meta.url),"utf8");

test("H2.5 B2 reference field is one restrained pair with a bounded ambient gradient", () => {
  assert.match(atlas,/--field:\s*#0a0d13;/);
  assert.match(atlas,/--field-raised:\s*#0e121a;/);
  assert.match(atlas,/--bg:\s*var\(--field\);/);
  assert.match(atlas,/html \{ background: var\(--field\); \}/);
  assert.match(atlas,/radial-gradient\(circle at 50% -18%, rgba\(121, 145, 173, \.044\), transparent 30rem\)/);
  assert.match(atlas,/linear-gradient\(180deg, #0e141d 0%, var\(--field\) 68%, #080a10 100%\)/);
  assert.doesNotMatch(atlas,/--field:\s*#090b0f;|--field-raised:\s*#0e1116;/);
});

test("H2.5 B2 changes no ring or selected-instant palette and introduces no shader experiment", () => {
  for(const [name,value] of Object.entries({
    hour:"#555d62",day:"#646c71",month:"#777f84",year:"#90989d",
    solar:"#ac906e",zodiac:"#424b59",cursor:"#f4dda0"
  })) assert.match(atlas,new RegExp("--"+name+":\\s*"+value+";"));
  assert.match(shader,/reflectionTint = vec3\(0\.37, 0\.44, 0\.51\)/);
  assert.match(shader,/microLightTint = vec3\(0\.30, 0\.37, 0\.44\)/);
  assert.match(shader,/nebulaLightTint = vec3\(0\.18, 0\.26, 0\.35\)/);
  assert.doesNotMatch(shader,/h25ZodiacTint|h25ZodiacFragmentSource/);
  assert.match(classification,/--classification-zodiac-outline:\s*#8f999d;/);
});

test("responsive screenshot frame's unused outer gutter matches the production field", () => {
  const expected=atlas.match(/--field:\s*(#[0-9a-f]{6});/i)?.[1];
  assert.equal(expected,"#0a0d13");
  assert.equal((h24.match(/background:\s*#0a0d13;/g)||[]).length,2);
  assert.doesNotMatch(h24,/#090b0f/);
});
