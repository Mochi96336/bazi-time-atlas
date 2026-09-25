import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FIXED_LIGHT_DIRECTION,
  MATERIAL_PROBES,
  MATERIAL_MODES,
  MATERIAL_RING_IDS,
  ROUGHNESS_FIELD_SIZE,
  buildRoughnessField,
  fillRenderedRotations,
  materialGeometry,
  renderedSolarRotation,
  resolveMaterialProbe,
  resolveMaterialMode,
  solarMaterialGeometry,
  zodiacMaterialGeometry
} from "../src/wheel/material-prototype.js";
import { ringModel } from "../src/wheel/ring-model.js";

test("roughness is the production default while explicit invalid modes fail closed to SVG", () => {
  assert.equal(resolveMaterialMode(""), MATERIAL_MODES.ROUGHNESS);
  assert.equal(resolveMaterialMode("?material=svg"), MATERIAL_MODES.SVG);
  assert.equal(resolveMaterialMode("?material=roughness"), MATERIAL_MODES.ROUGHNESS);
  assert.equal(resolveMaterialMode("?material=roughness-normal"), MATERIAL_MODES.SVG);
  assert.equal(resolveMaterialMode("?material=glitter"), MATERIAL_MODES.SVG);
});

test("H2.0 material ablations are explicit roughness-only diagnostics", () => {
  const labels = [
    "none", "solar-no-oxidation", "solar-no-scratches", "solar-no-reflection",
    "zodiac-no-patina", "zodiac-no-reflection", "graphite-no-response",
    "solar-no-scratch-light"
  ];
  assert.deepEqual(Object.keys(MATERIAL_PROBES), labels);
  assert.deepEqual(Object.values(MATERIAL_PROBES), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(resolveMaterialProbe(""), null);
  assert.equal(resolveMaterialProbe("?material=roughness"), null);
  assert.equal(resolveMaterialProbe("?material=svg&materialProbe=solar-no-scratches"), null);
  assert.equal(resolveMaterialProbe("?materialProbe=solar-no-scratches"), null);
  assert.equal(resolveMaterialProbe("?material=roughness&materialProbe=bogus"), null);
  assert.equal(resolveMaterialProbe("?material=roughness&materialProbe=__proto__"), null);
  for (const label of labels) {
    assert.equal(resolveMaterialProbe("?material=roughness&materialProbe=" + label), MATERIAL_PROBES[label]);
  }
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

test("Solar material borrows the annual-band geometry and final rendered pose", () => {
  const solar = ringModel("solar");
  const zodiac = ringModel("zodiac");
  const geometry = solarMaterialGeometry();
  assert.deepEqual(geometry, {
    id: "solar",
    innerRadius: solar.innerRadius,
    outerRadius: zodiac.innerRadius
  });

  const rotations = new Map([
    ["solar", 87.625],
    ["year", 12]
  ]);
  assert.equal(renderedSolarRotation(rotations), 87.625);
  assert.equal(renderedSolarRotation(new Map()), 0);

  const zodiacGeometry = zodiacMaterialGeometry();
  assert.deepEqual(zodiacGeometry, {
    id: zodiac.id,
    innerRadius: zodiac.innerRadius,
    outerRadius: zodiac.outerRadius
  });
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

test("material sampling sign is the inverse of SVG y-down ring rotation", () => {
  const radians = 37 * Math.PI / 180;
  const c = Math.cos(radians);
  const sin = Math.sin(radians);
  const local = { x: 31.5, y: -14.25 };

  // SVG rotate(+a) in y-down user space.
  const world = {
    x: c * local.x - sin * local.y,
    y: sin * local.x + c * local.y
  };
  // GLSL mat2(c,-s,s,c) is column-major, so rotation(+a) numerically
  // performs the inverse mapping needed by world -> local sampling.
  const recovered = {
    x: c * world.x + sin * world.y,
    y: -sin * world.x + c * world.y
  };

  assert.ok(Math.abs(recovered.x - local.x) < 1e-10);
  assert.ok(Math.abs(recovered.y - local.y) < 1e-10);
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
  assert.match(html, /<g id="material-base-layer" aria-hidden="true"><\/g>\s*<g id="material-reflection-layer" aria-hidden="true"><\/g>\s*<g id="guide-layer"><\/g>\s*<g id="hour-track"><\/g>/);
  assert.match(html, /<radialGradient id="m2-visible-metal-reflection"[^>]*gradientUnits="userSpaceOnUse"/);
  assert.doesNotMatch(html, /id="m2-visible-metal-reflection"[^>]*gradientTransform=/);
  assert.doesNotMatch(html, /<linearGradient id="m2-visible-metal-reflection"/);
  assert.match(html, /id="m2-solar-brass-surface"[^>]*gradientUnits="userSpaceOnUse"/);
  assert.match(html, /id="m2-zodiac-hard-surface"[^>]*gradientUnits="userSpaceOnUse"/);
  assert.doesNotMatch(html, /m2-rotating-micrograin|<pattern[^>]*micrograin|<circle[^>]*fill-opacity=/);
  assert.match(css, /\.material-wheel-layer\s*\{[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /data-material-prototype="roughness"\] \.material-wheel-layer\s*\{[\s\S]*?opacity:\s*1;/);
  assert.doesNotMatch(css, /data-material-prototype="roughness"\] \.m2-ring-bed/);
  assert.doesNotMatch(css, /data-material-prototype="roughness"\] \.m2-ring-material-face/);
  assert.match(radial, /\.m2-solar-brass-response\s*\{[^}]*opacity:\s*\.72;/);
  assert.match(radial, /#kinetic-instrument\[data-material-prototype="roughness"\] \.m2-zodiac-hard-response\s*\{[^}]*opacity:\s*\.08;/);
  assert.match(renderer, /const materialBaseLayer = svg\.querySelector\("#material-base-layer"\)/);
  assert.match(renderer, /const materialReflectionLayer = svg\.querySelector\("#material-reflection-layer"\)/);
  assert.match(renderer, /class: `m2-ring-reflection m2-\$\{id\}-reflection`[\s\S]*?"data-material-reflection-ring": id[\s\S]*?\}, surfaceLayer\);/);
  assert.match(renderer, /materialPrototype\.updateFrame\(renderedRotations\)/);
  assert.match(renderer, /id:"solar"[\s\S]*?m2-solar-brass-bed[\s\S]*?id:"zodiac"[\s\S]*?m2-zodiac-hard-bed/);
  assert.match(renderer, /id:"solar"[\s\S]*?materialOuterRadius:RADII\.solarTermOuter/);
  assert.match(renderer, /const outerRadius = Number\.isFinite\(materialOuterRadius\) \? materialOuterRadius : model\.outerRadius/);
  assert.match(material, /localPoint = rotation\(ringRotation\) \* point/);
  assert.match(material, /uniform float u_solar_inner_radius/);
  assert.match(material, /uniform float u_solar_outer_radius/);
  assert.match(material, /uniform float u_solar_rotation/);
  assert.match(material, /uniform float u_zodiac_inner_radius/);
  assert.match(material, /uniform float u_zodiac_outer_radius/);
  assert.match(material, /renderSolarBrass\(point, u_solar_rotation, pixelFootprint\)/);
  assert.match(material, /renderZodiacMicroResponse\(point, u_solar_rotation\)/);
  assert.ok(material.includes("uniform int u_material_probe;"));
  assert.ok(material.includes("gl.uniform1i(uniforms.materialProbe, probeOverride ?? requestedProbe ?? 0)"));
  for (const id of [1, 2, 3, 4, 5, 6]) {
    assert.ok(material.includes("u_material_probe == " + id), "ablation shader branch " + id);
  }
  assert.ok(material.includes("u_material_probe != 7"), "new probe disables only groove lighting");
  // Material K4.3 keeps the K2 procedural language, but removes the remaining
  // broad oxide-island read in favor of high-frequency low-contrast variation.
  // repeating 128×128 graphite texture for oxidation. It owns a deterministic
  // value-noise/fBm field, then applies the demo's domain-warped low/mid/fine
  // hierarchy in ring-local coordinates.
  assert.match(material, /float solarValueNoise\(vec2 p, float seed\)/);
  assert.match(material, /float solarFbm\(vec2 p, float seed\)/);
  assert.match(material, /for \(int octave = 0; octave < 3; octave \+= 1\)/);
  assert.match(material, /vec3 solarOxidation\(vec2 localPoint\)/);
  assert.match(material, /wx = \(solarFbm\(p \* 2\.10, 51\.0\) - 0\.5\) \* 0\.55/);
  assert.match(material, /wy = \(solarFbm\(p \* 1\.95 \+ vec2\(17\.0, -9\.0\), 73\.0\) - 0\.5\) \* 0\.48/);
  assert.match(material, /low = solarFbm\(warped \* 2\.60, 11\.0\)/);
  assert.match(material, /mid = solarFbm\(vec2\(warped\.x \* 5\.00, warped\.y \* 4\.65\)/);
  assert.match(material, /fine = solarFbm\(warped \* 8\.50/);
  assert.match(material, /combined = low \* 0\.18 \+ mid \* 0\.46 \+ fine \* 0\.36/);
  assert.match(material, /oxidePatch = smoothstep\(0\.58, 0\.76, combined\)/);
  assert.match(material, /deep = smoothstep\(0\.72, 0\.86, solarFbm\(p \* vec2\(4\.00, 3\.50\)/);
  assert.match(material, /cool = smoothstep\(0\.75, 0\.89, solarValueNoise\(p \* vec2\(3\.20, 2\.90\)/);

  // Scratch generation mirrors demo v3 instead of the previous tangent-cell
  // hatch: dense jittered cells, near-radial primary marks, ±12° variation,
  // 8–143 unit short-biased lengths, bend, light/dark polarity and separate
  // sparse all-angle handling marks.
  assert.match(material, /scratchFromCell\(vec2 uv, float cell, float cellSize, float handling, float circumference, float phase\)/);
  assert.match(material, /for \(int offset = -1; offset <= 1; offset \+= 1\)/);
  assert.match(material, /float exists = step\(mix\(0\.17, 0\.52, handling\), r0\)/);
  assert.match(material, /shortBias = pow\(r3, 2\.2\)/);
  assert.match(material, /demoScale = clamp\(bandWidth \/ 240\.0, 0\.28, 0\.50\)/);
  assert.match(material, /8\.0 \+ shortBias \* 135\.0[\s\S]*?\* demoScale \* 0\.46/);
  assert.match(material, /bend = bendWindow[\s\S]*?\* demoScale \* 0\.52/);
  assert.match(material, /1\.675516 \+ \(angleRandom - 0\.5\) \* 0\.418879/);
  assert.match(material, /angleRandom \* PI, handling/);
  assert.match(material, /vec4 primaryScratchField\(vec2 localPoint\)/);
  assert.match(material, /scratchLayer\(localPoint, 0\.0, 0\.0\)/);
  assert.match(material, /scratchLayer\(localPoint, 0\.0, 1\.0\)/);
  assert.match(material, /vec4 handlingScratchField\(vec2 localPoint\)/);
  assert.match(material, /scratchLayer\(localPoint, 1\.0, 2\.0\)/);
  assert.match(material, /fwidth\(distanceToScratch\)/);
  assert.match(material, /return vec4\(mask \* polarity, mask, normal\.x \* bevel, normal\.y \* bevel\)/);
  assert.match(material, /grooveWorld = rotation\(-ringRotation\) \* grooveLocal/);
  assert.match(material, /u_material_probe != 7 && primaryScratch\.y \+ handlingScratch\.y > 0\.001/);
  assert.match(material, /body = clamp\(body \+ vec3\(0\.60, 0\.53, 0\.44\) \* localReflection, 0\.0, 1\.0\)/);
  assert.match(material, /fineAttenuation = mix\(0\.34, 1\.0, 1\.0 - smoothstep\(1\.15, 2\.85, pixelFootprint\)\)/);

  // The body is no longer a nearly-transparent response layer. The shader
  // carries the same gold/brown body family as the approved demo and then
  // applies oxidation/scratches before compositing beneath SVG semantics.
  assert.match(material, /vec3 brassBody\(vec2 worldPoint\)/);
  assert.match(material, /brassLight = vec3\(0\.328, 0\.282, 0\.230\)/);
  assert.match(material, /brassMid = vec3\(0\.286, 0\.241, 0\.198\)/);
  assert.match(material, /brassDark = vec3\(0\.138, 0\.105, 0\.085\)/);
  assert.match(material, /worldAngleDegrees = atan\(worldPoint\.y, worldPoint\.x\) \* 180\.0 \/ PI/);
  assert.match(material, /warmCatch \* 0\.047/);
  assert.match(material, /bodyCoordinate = clamp\(\(worldAngleDegrees - u_fan_degrees\.x\) \/ fanSpan, 0\.0, 1\.0\)/);
  assert.match(material, /oxideStrength = clamp\(aging\.x \* 0\.10 \+ aging\.y \* 0\.045 \+ aging\.z \* 0\.005, 0\.0, 0\.14\)/);
  assert.match(material, /body = mix\(body, body \* oxideMultiplier, oxideStrength\)/);
  assert.match(material, /primaryStrength = abs\(primaryScratch\.x\) \* 0\.012 \* fineAttenuation/);
  assert.match(material, /handlingStrength = abs\(handlingScratch\.x\) \* 0\.007 \* fineAttenuation/);
  assert.match(material, /bodyAlpha = edgeMask \* 0\.90/);
  assert.match(material, /return vec4\(body \* bodyAlpha, bodyAlpha\)/);
  assert.match(material, /solarRotation = renderedSolarRotation\(renderedRotations\)/);
  assert.match(material, /SURFACE_PERIOD_LARGE = 108\.0/);
  assert.match(material, /SURFACE_PERIOD_MEDIUM = 38\.0/);
  assert.match(material, /SURFACE_PERIOD_FINE = 15\.0/);
  assert.match(material, /surfaceField\(vec2 localPoint\)[\s\S]*?large \* 0\.10 \+ medium \* 0\.28 \+ fine \* 0\.62/);
  assert.match(material, /roughness = clamp\(0\.810 \+ fieldCentered \* 0\.090, 0\.770, 0\.850\)/);
  assert.match(material, /fieldDx = \([\s\S]*?fieldDy = \(/);
  assert.match(material, /slopeLocal = vec2\(fieldDx, fieldDy\) \* 0\.44/);
  assert.match(material, /slopeWorld = rotation\(-ringRotation\) \* slopeLocal/);
  assert.match(material, /microNormal = normalize\(vec3\(-slopeWorld\.x, -slopeWorld\.y, 1\.0\)\)/);
  assert.match(material, /microLightDelta = clamp\(dot\(microNormal, lightDirection\) - baseLight, -0\.060, 0\.060\)/);
  assert.match(material, /specularPower = mix\(18\.0, 6\.0, roughness\)/);
  assert.match(material, /environmentResponse = clamp\([\s\S]*?point \/ vec2\(760\.0, 500\.0\)[\s\S]*?0\.80,[\s\S]*?1\.00/);
  assert.match(material, /microAlpha = clamp\(abs\(microLightDelta\) \* 0\.39 \+ abs\(fieldCentered\) \* 0\.013, 0\.0, 0\.034\)/);
  assert.match(material, /overlayAlpha = edgeMask \* clamp\(specularAlpha \+ microAlpha, 0\.0, 0\.044\)/);
  assert.match(material, /out_color = vec4\(overlayColor \* edgeMask, overlayAlpha\)/);
  assert.match(material, /vec4 renderZodiacMicroResponse\(vec2 worldPoint, float rotationDegrees\)/);
  assert.match(material, /edgeDistance = min\(radius - u_zodiac_inner_radius, u_zodiac_outer_radius - radius\)/);
  assert.match(material, /specularAlpha = u_material_probe == 5 \? 0\.0 : clamp\(specular \* environmentResponse \* 0\.22, 0\.0, 0\.006\)/);
  assert.match(material, /microAlpha = u_material_probe == 5 \? 0\.0 : clamp\(abs\(microLightDelta\) \* 0\.31 \+ abs\(fieldCentered\) \* 0\.009, 0\.0, 0\.024\)/);
  // Night-indigo pigment tints are owned by the Zodiac renderer; do not reintroduce blue glow.
  assert.ok(material.includes("reflectionTint = vec3(0.37, 0.44, 0.51)"));
  assert.ok(material.includes("microLightTint = vec3(0.30, 0.37, 0.44)"));
  assert.ok(material.includes("nebulaLightTint = vec3(0.18, 0.26, 0.35)"));
  assert.match(material, /float zodiacNebulaField\(vec2 localPoint\)/);
  assert.match(material, /localPoint\.x \/ 128\.0, localPoint\.y \/ 112\.0/);
  assert.match(material, /low \* 0\.24 \+ mid \* 0\.50 \+ fine \* 0\.26/);
  assert.match(material, /nebulaLightAlpha = smoothstep\(0\.57, 0\.76, nebula\) \* 0\.060/);
  assert.match(material, /nebulaDarkAlpha = smoothstep\(0\.58, 0\.77, 1\.0 - nebula\) \* 0\.080/);
  assert.match(material, /overlayAlpha = edgeMask \* clamp\(specularAlpha \+ microAlpha \+ nebulaAlpha, 0\.0, 0\.110\)/);
  assert.match(radial, /#kinetic-instrument\[data-material-prototype="roughness"\] \.m2-solar-brass-bed\s*\{[^}]*opacity:\s*0;/);
  assert.match(radial, /#kinetic-instrument\[data-material-prototype="roughness"\] \.m2-solar-brass-response\s*\{[^}]*opacity:\s*\.012;/);
  assert.doesNotMatch(radial, /data-material-prototype="roughness"\] \.m2-solar-brass-bed\s*\{[^}]*opacity:\s*\.(?:0?[1-9]|[1-9]\d*)/);
  assert.match(radial, /\.m2-solar-brass-response\s*\{[^}]*opacity:\s*\.72;/);
  assert.match(radial, /#kinetic-instrument\[data-material-prototype="roughness"\] \.m2-zodiac-hard-response\s*\{[^}]*opacity:\s*\.08;/);
  assert.doesNotMatch(radial, /#kinetic-instrument\[data-material-prototype="roughness"\] \.m2-zodiac-hard-bed\s*\{[^}]*opacity:\s*0;/);
  assert.match(radial, /\.m2-ring-material-face \{[\s\S]*?fill:\s*none;[\s\S]*?opacity:\s*0;/);
  assert.doesNotMatch(radial, /\.m2-(?:hour|day|month|year)-material-face \{[^}]*opacity:/);
  assert.doesNotMatch(material, /vec3 base =|bodyResponse|crownSlope|float diffuse|lightAlignment|broadSheen/);
  assert.doesNotMatch(material, /scatterEnergy|outerCatch|innerCatch|bevelEnergy|microSheen|surfaceSheen|environmentLift/);
  assert.match(material, /lightDirection = normalize\(vec3\(-0\.42, -0\.56, 0\.714\)\)/);
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
  assert.doesNotMatch(material, /selectedMs|Selected Instant|solarLongitude|temporalCycleRotation|effectiveRotation/);
  assert.doesNotMatch(material, /for \(int i = 0; i < 500/);
});

