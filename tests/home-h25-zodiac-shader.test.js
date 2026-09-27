import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveH25ZodiacTintStudy, h25ZodiacFragmentSource,
  FIXED_LIGHT_DIRECTION
} from "../src/wheel/material-prototype.js";

test("H2.5 GLSL color study is opt-in for exact roughness and exact parameter only", () => {
  for(const bad of [
    "", "?material=roughness", "?h25ZodiacTint=indigo",
    "?material=svg&h25ZodiacTint=indigo",
    "?material=roughness&h25ZodiacTint=Indigo",
    "?material=roughness&h25ZodiacTint=nebula",
    "?material=bogus&h25ZodiacTint=indigo"
  ]) assert.equal(resolveH25ZodiacTintStudy(bad),false,bad);
  assert.equal(resolveH25ZodiacTintStudy("?material=roughness&h25ZodiacTint=indigo"),true);
});

test("exact default fragment source remains unchanged and opt-in changes only three Zodiac RGB tints", () => {
  const original=h25ZodiacFragmentSource();
  assert.equal(h25ZodiacFragmentSource(false),original);
  const study=h25ZodiacFragmentSource(true);
  assert.notEqual(study,original);
  const pairs=[
    ["vec3 reflectionTint = vec3(0.37, 0.44, 0.51);",
     "vec3 reflectionTint = vec3(0.34, 0.42, 0.54);"],
    ["vec3 microLightTint = vec3(0.30, 0.37, 0.44);",
     "vec3 microLightTint = vec3(0.275, 0.36, 0.47);"],
    ["vec3 nebulaLightTint = vec3(0.18, 0.26, 0.35);",
     "vec3 nebulaLightTint = vec3(0.16, 0.25, 0.39);"]
  ];
  let restored=study;
  for(const [before,after] of pairs) {
    assert.equal(original.split(before).length,2,"original tint must occur only once");
    assert.equal(study.split(after).length,2,"replacement tint must occur only once");
    restored=restored.replace(after,before);
  }
  assert.equal(restored,original,"all remaining shader bytes, including alpha and light, must match");
  assert.deepEqual(FIXED_LIGHT_DIRECTION,[-0.42,-0.56,0.714]);
});

test("runtime study has no default URL, CSS or production camera side effects", () => {
  const file=readFileSync(new URL("../src/wheel/material-prototype.js",import.meta.url),"utf8");
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  const fixture=readFileSync(new URL("../scripts/fixtures/home-h25-zodiac-shader-frame.html",import.meta.url),"utf8");
  const workflow=readFileSync(new URL("../.github/workflows/home-h25-zodiac-shader.yml",import.meta.url),"utf8");
  assert.match(file,/createProgram\(gl, h25ZodiacFragmentSource\(h25ZodiacStudy\)\)/);
  assert.match(file,/if \(h25ZodiacStudy\) shell\.dataset\.h25ZodiacTintProbe/);
  assert.doesNotMatch(html,/h25ZodiacTint|home-h25-zodiac-shader/);
  assert.match(fixture,/materialProbe", "none"/);
  assert.match(fixture,/opt-in shader activated incorrectly/);
  assert.match(workflow,/npm run vendor:prepare/);
  assert.match(workflow,/visual-check-home-h25-zodiac-shader/);
});
