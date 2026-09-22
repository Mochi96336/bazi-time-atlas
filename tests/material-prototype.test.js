import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FIXED_LIGHT_DIRECTION,
  MATERIAL_MODES,
  MATERIAL_RING_IDS,
  ROUGHNESS_FIELD_SIZE,
  buildRoughnessField,
  fillRenderedRotations,
  materialGeometry,
  resolveMaterialMode
} from "../src/wheel/material-prototype.js";
import { ringModel } from "../src/wheel/ring-model.js";

test("roughness is the production default while explicit invalid modes fail closed to SVG", () => {
  assert.equal(resolveMaterialMode(""), MATERIAL_MODES.ROUGHNESS);
  assert.equal(resolveMaterialMode("?material=svg"), MATERIAL_MODES.SVG);
  assert.equal(resolveMaterialMode("?material=roughness"), MATERIAL_MODES.ROUGHNESS);
  assert.equal(resolveMaterialMode("?material=roughness-normal"), MATERIAL_MODES.SVG);
  assert.equal(resolveMaterialMode("?material=glitter"), MATERIAL_MODES.SVG);
});

test("material geometry is borrowed from the canonical ring model and excludes Solar/Zodiac", () => {
  const geometry = materialGeometry();
  assert.deepEqual(geometry.map(item => item.id), ["hour", "day", "month", "year"]);
  assert.deepEqual(MATERIAL_RING_IDS, ["hour", "day", "month", "year"]);
  for (const item of geometry) {
    const canonical = ringModel(item.id);
    assert.equal(item.innerRadius, canonical.innerRadius);
    assert.equal(item.outerRadius, canonical.outerRadius);
  }
  assert.equal(geometry.some(item => item.id === "solar" || item.id === "zodiac"), false);
});

test("roughness field is deterministic, dense, bounded, and seed-sensitive", () => {
  const a = buildRoughnessField();
  const b = buildRoughnessField();
  const c = buildRoughnessField(ROUGHNESS_FIELD_SIZE, 0x12345678);
  assert.equal(a.length, ROUGHNESS_FIELD_SIZE ** 2);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);

  let min = 255;
  let max = 0;
  let sum = 0;
  for (const value of a) {
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
  }
  const mean = sum / a.length;
  assert.ok(min < 64, "expected a broad scalar field, min=" + min);
  assert.ok(max > 192, "expected a broad scalar field, max=" + max);
  assert.ok(mean > 118 && mean < 138, "expected centered deterministic field, mean=" + mean);
});

test("rendered rotation bridge reuses caller storage and does not derive another authority", () => {
  const rotations = new Map([
    ["hour", 11.25],
    ["day", -37.5],
    ["month", 145.75],
    ["year", 301.125],
    ["solar", 88]
  ]);
  const target = new Float32Array(4);
  const returned = fillRenderedRotations(rotations, target);
  assert.equal(returned, target);
  assert.deepEqual(Array.from(target), [11.25, -37.5, 145.75, 301.125]);

  const missing = fillRenderedRotations(new Map([["hour", 9]]), target);
  assert.deepEqual(Array.from(missing), [9, 0, 0, 0]);
  assert.deepEqual(FIXED_LIGHT_DIRECTION, [-0.42, -0.56, 0.714]);
});

test("canvas stays pointer-inert and renderer owns the only runtime pose bridge", async () => {
  const [html, css, renderer, material, radial] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../instrument-first.css", import.meta.url), "utf8"),
    readFile(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8"),
    readFile(new URL("../src/wheel/material-prototype.js", import.meta.url), "utf8"),
    readFile(new URL("../radial-hierarchy.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /<canvas id="material-wheel-layer" class="material-wheel-layer" aria-hidden="true"><\/canvas>/);
  const grainPattern = html.match(/<pattern id="m2-rotating-micrograin"[\s\S]*?<\/pattern>/)?.[0] ?? "";
  assert.match(grainPattern, /width="43" height="37"/);
  assert.equal((grainPattern.match(/<circle /g) ?? []).length, 10);
  assert.match(css, /\.material-wheel-layer\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /data-material-prototype="roughness"\] \.material-wheel-layer\s*\{[\s\S]*?opacity:\s*1;/);
  assert.doesNotMatch(css, /data-material-prototype="roughness"\] \.m2-ring-bed/);
  assert.doesNotMatch(css, /data-material-prototype="roughness"\] \.m2-ring-material-face/);
  assert.match(renderer, /materialPrototype\.updateFrame\(renderedRotations\)/);
  assert.match(material, /localPoint = rotation\(-ringRotation\) \* point/);
  assert.match(material, /const float FIELD_PERIOD = 96\.0/);
  assert.match(material, /environmentCoordinate = dot\(point \/ vec2\(600\.0, 380\.0\), environmentDirection\)/);
  assert.match(material, /reflectionBand = exp\(-pow\(\(environmentCoordinate \+ 0\.08\) \/ 0\.68, 2\.0\)\)/);
  assert.match(material, /environmentResponse = 0\.06 \+ reflectionBand \* 0\.94/);
  assert.match(material, /grainResponse = clamp\(1\.0 \+ fieldCentered \* 0\.90, 0\.55, 1\.45\)/);
  assert.match(material, /overlayAlpha = edgeMask \* clamp\(\(0\.005 \+ environmentResponse \* 0\.080\) \* grainResponse, 0\.0, 0\.110\)/);
  assert.match(material, /vec3 reflectionTint = vec3\(0\.80, 0\.84, 0\.86\)/);
  assert.match(material, /out_color = vec4\(reflectionTint \* overlayAlpha, overlayAlpha\)/);
  assert.match(radial, /\.m2-hour-material-face \{ opacity: \.115; \}/);
  assert.match(radial, /\.m2-day-material-face \{ opacity: \.128; \}/);
  assert.match(radial, /\.m2-month-material-face \{ opacity: \.144; \}/);
  assert.match(radial, /\.m2-year-material-face \{ opacity: \.16; \}/);
  assert.doesNotMatch(material, /vec3 base =|bodyResponse/);
  assert.doesNotMatch(material, /fieldDx|fieldDy|microSlope/);
  assert.doesNotMatch(material, /crownSlope|float diffuse|lightAlignment|broadSheen/);
  assert.doesNotMatch(material, /scatterEnergy|outerCatch|innerCatch|bevelEnergy|microSheen/);
  assert.match(material, /lightDirection = normalize\(vec3\(-0\.42, -0\.56, 0\.714\)\)/);
  assert.match(material, /environmentDirection = normalize\(lightDirection\.xy\)/);
  assert.doesNotMatch(material, /specularPower|surfaceSheen|environmentLift|float roughness|viewDirection|halfVector|vec3 normal/);
  assert.match(material, /materialWasExplicit = new URLSearchParams\(search\)\.has\("material"\)/);
  assert.match(material, /requestIdleCallback\(activate, \{ timeout: 1800 \}\)/);
  assert.match(material, /globalThis\.addEventListener\?\.\("load", scheduleIdleActivation, \{ once:true \}\)/);
  assert.match(material, /svg\.getScreenCTM\?\.\(\)/);
  assert.match(material, /screenToSvg = screenCtm\.inverse\(\)/);
  assert.match(material, /uniform vec2 u_fan_degrees/);
  assert.match(material, /gl\.uniform2f\(uniforms\.fanDegrees, FAN\.start, FAN\.end\)/);
  assert.match(material, /angleDegrees < u_fan_degrees\.x \|\| angleDegrees > u_fan_degrees\.y/);
  assert.doesNotMatch(material, /viewWidth|viewHeight|contentOrigin|u_svg_scale/);
  assert.doesNotMatch(material, /selectedMs|Selected Instant|solarLongitude|temporalCycleRotation|setModelRotation|effectiveRotation/);
  assert.doesNotMatch(material, /<img|https?:\/\/|feTurbulence|repeating-(?:linear|radial)-gradient/i);
});
